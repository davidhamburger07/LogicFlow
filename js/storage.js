// ============================================================
// storage.js — the single home for all persisted state.
//
// Wraps localStorage. Everything is guarded with try/catch and
// falls back to a sane default, so the game never crashes if
// storage is unavailable (private mode, blocked cookies, quota,
// JSON corruption, etc.).
//
// Persists:
//   - premium flag        (bool)      — dormant; no longer gates access
//   - volume preference   (0–100)
//   - per-topic progress  (topicStats keyed by phase id)
//   - unresolved misses   (set of (phaseId, questionIndex) not yet re-passed)
//
// Mastery is a ROLLING WINDOW of the most recent attempts (not all-time
// accuracy) so a student can visibly recover from early mistakes.
// ============================================================

import { gcseGrade } from './units.js';

const KEY = {
  premium: 'logicflow.premium',
  volume: 'logicflow.volume',
  theme: 'logicflow.theme',
  uiScale: 'logicflow.uiscale',
  board: 'logicflow.board',
  topicStats: 'logicflow.topicStats',
  schedule: 'logicflow.schedule',
  campaign: 'logicflow.campaign',
};

const BOARDS = ['AQA', 'OCR', 'Eduqas', 'WJEC'];   // WJEC (Wales) uses Python, like Eduqas (its English sibling)

const DEFAULT_VOLUME = 70;            // matches the HUD slider default

// ---- mastery tuning (single source of truth) ---------------
export const MASTERY_WINDOW = 15;     // rolling window of recent attempts per topic
export const REVIEW_THRESHOLD = 60;   // mastery % below this flags "needs review"

// ---- spaced-repetition scheduler (Leitner boxes) -----------
// growing review intervals per box, in ms. box 0 = due immediately;
// each successful review promotes the item to the next (longer) box.
const BOX_INTERVALS = [0, 10 * 60e3, 24 * 3600e3, 3 * 24 * 3600e3, 7 * 24 * 3600e3, 16 * 24 * 3600e3];
const MAX_BOX = BOX_INTERVALS.length - 1;   // a correct answer at the top box graduates the item
const SCHEDULE_CAP = 500;

// ---- low-level helpers -------------------------------------
function readRaw(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function writeRaw(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* unavailable / quota */ }
}
function readJSON(key, fallback) {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try { const v = JSON.parse(raw); return v === null ? fallback : v; }
  catch (e) { return fallback; }
}
function writeJSON(key, value) {
  try { writeRaw(key, JSON.stringify(value)); } catch (e) { /* not serialisable */ }
}

// ============================================================
// premium flag (dormant — kept for the future depth model; never gates access)
// ============================================================
export function getPremium() { return readRaw(KEY.premium) === 'true'; }
export function setPremium(on) { writeRaw(KEY.premium, on ? 'true' : 'false'); }

// ============================================================
// volume preference (0–100)
// ============================================================
export function getVolume() {
  const raw = readRaw(KEY.volume);
  if (raw === null) return DEFAULT_VOLUME;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_VOLUME;
  return Math.min(100, Math.max(0, n));
}
export function setVolume(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return;
  writeRaw(KEY.volume, String(Math.min(100, Math.max(0, n))));
}

// ============================================================
// theme preference ('light' | 'dark'). Stored as a raw string so the
// tiny inline <head> script can read it before modules load (no flash).
// ============================================================
export function getTheme() {
  return readRaw(KEY.theme) === 'dark' ? 'dark' : 'light';
}
export function setTheme(t) {
  writeRaw(KEY.theme, t === 'dark' ? 'dark' : 'light');
}

// ============================================================
// UI size ('sm' | 'md' | 'lg'). Raw string so the inline <head> script can
// apply the zoom before first paint (no flash). Default 'md'.
// ============================================================
export function getUiScale() {
  const v = readRaw(KEY.uiScale);
  return (v === 'sm' || v === 'lg') ? v : 'md';
}
export function setUiScale(s) {
  writeRaw(KEY.uiScale, (s === 'sm' || s === 'lg') ? s : 'md');
}

// ============================================================
// exam-board preference ('AQA' | 'OCR' | 'Eduqas'). Decides which
// notation programming code is shown in. Default AQA.
// ============================================================
export function getBoard() {
  const b = readRaw(KEY.board);
  return BOARDS.includes(b) ? b : 'AQA';
}
export function setBoard(b) {
  writeRaw(KEY.board, BOARDS.includes(b) ? b : 'AQA');
}

// ============================================================
// per-topic progress
//   topicStats[phaseId] = { recent: bool[], cleared: bool, lastPlayed: number }
//     recent = outcomes of the last MASTERY_WINDOW attempts (newest last)
// All other fields (started/mastery/needsReview/…) are DERIVED on read.
// ============================================================
function allStatsRaw() {
  const s = readJSON(KEY.topicStats, {});
  return (s && typeof s === 'object' && !Array.isArray(s)) ? s : {};
}
function blankTopic() { return { recent: [], cleared: false, lastPlayed: 0 }; }

function derive(phaseId, raw) {
  const t = raw || blankTopic();
  const recent = Array.isArray(t.recent) ? t.recent : [];
  const started = recent.length > 0;
  const trueCount = recent.reduce((n, b) => n + (b ? 1 : 0), 0);
  const mastery = started ? Math.round(100 * trueCount / recent.length) : null;
  const lastAttemptCorrect = started ? !!recent[recent.length - 1] : null;
  const needsReview = started && (mastery < REVIEW_THRESHOLD || lastAttemptCorrect === false);
  return {
    phaseId: Number(phaseId),
    recent, started,
    cleared: !!t.cleared,
    lastPlayed: t.lastPlayed || 0,
    mastery, lastAttemptCorrect, needsReview,
  };
}

export function getTopicStats(phaseId) {
  return derive(phaseId, allStatsRaw()[phaseId]);
}

// storage stays decoupled from content.js — pass the ordered phase ids.
export function getAllTopicStats(phaseIds) {
  return (phaseIds || []).map(id => getTopicStats(id));
}

export function markPhaseCleared(phaseId) {
  const s = allStatsRaw();
  const t = s[phaseId] || blankTopic();
  t.cleared = true;
  s[phaseId] = t;
  writeJSON(KEY.topicStats, s);
}

// frontier = lowest non-cleared phase id (in the given order); null if all cleared.
export function getCampaignFrontier(phaseIds) {
  const s = allStatsRaw();
  for (const id of (phaseIds || [])) {
    if (!(s[id] && s[id].cleared)) return id;
  }
  return null;
}

// ============================================================
// record EVERY answer (called from the engine result handler, every
// screen except Past Paper). Updates the rolling mastery window AND the
// spaced-repetition schedule. Identity = (phaseId, questionIndex).
// ============================================================
export function recordAttempt(phaseId, questionIndex, isCorrect) {
  const correct = !!isCorrect;

  // 1) rolling mastery window + lastPlayed
  const s = allStatsRaw();
  const t = s[phaseId] || blankTopic();
  const recent = (Array.isArray(t.recent) ? t.recent : []).concat(correct);
  t.recent = recent.slice(-MASTERY_WINDOW);
  t.lastPlayed = Date.now();
  s[phaseId] = t;
  writeJSON(KEY.topicStats, s);

  // 2) spaced-repetition schedule
  scheduleAttempt(phaseId, questionIndex, correct);
}

// Leitner scheduling. A WRONG answer (re)schedules the item at box 0
// (due now). A CORRECT answer promotes a scheduled item to the next
// (longer) box, and GRADUATES it (removes it) once answered right at the
// top box. A correct answer to a never-missed question schedules nothing.
function scheduleAttempt(phaseId, qIndex, correct) {
  const sch = readSchedule();
  const key = phaseId + ':' + qIndex;
  if (!correct) {
    sch[key] = { phaseId, qIndex, box: 0, due: Date.now() };
  } else if (sch[key]) {
    const it = sch[key];
    if (it.box >= MAX_BOX) { delete sch[key]; }
    else { it.box += 1; it.due = Date.now() + BOX_INTERVALS[it.box]; }
  } else {
    return;
  }
  const keys = Object.keys(sch);
  if (keys.length > SCHEDULE_CAP) {
    keys.sort((a, b) => sch[b].due - sch[a].due);        // drop those due furthest in the future
    keys.slice(0, keys.length - SCHEDULE_CAP).forEach(k => delete sch[k]);
  }
  writeSchedule(sch);
}

function readSchedule() {
  const s = readJSON(KEY.schedule, {});
  return (s && typeof s === 'object' && !Array.isArray(s)) ? s : {};
}
function writeSchedule(s) { writeJSON(KEY.schedule, s); }

// items due for review now — Spaced Review serves these.
export function getDueReviews(now = Date.now()) {
  return Object.values(readSchedule())
    .filter(it => it.due <= now)
    .map(it => ({ phaseId: it.phaseId, qIndex: it.qIndex }));
}
// total items currently in the schedule (due or not yet due).
export function getScheduleSize() { return Object.keys(readSchedule()).length; }
// all scheduled items, regardless of due date (kept for compatibility).
export function getMisses() {
  return Object.values(readSchedule()).map(it => ({ phaseId: it.phaseId, qIndex: it.qIndex }));
}

// ============================================================
// CAMPAIGN PROGRESSION (Duolingo-style units -> lessons -> tests)
//
// The locked path. A LESSON is one phase (its `cleared` flag lives in
// topicStats above). On top of that we persist, in `logicflow.campaign`:
//   - crowns[phaseId]      0–3, the lesson's "stars" (monotonic best)
//   - tests[unitId]        { passed, best }  the Unit Test result
//   - mocks[mockId]        { best, grade }   the cumulative Mock result
//
// Unlock rules (computed in getCampaignState, which takes the UNITS
// topology so storage stays decoupled from units.js's specific data):
//   - a unit unlocks when the previous unit is COMPLETE
//   - lessons in a unit unlock in order (each needs the previous cleared)
//   - a Unit Test unlocks once every lesson in its unit is cleared
//   - a unit is COMPLETE when all its lessons are cleared AND its test
//     is passed  (the test is the mandatory gate to the next unit)
//   - a Mock unlocks when its unit completes; Mocks are OPTIONAL — they
//     never gate progress and are not the "you are here" pointer
// ============================================================
export const UNIT_TEST_PASS = 70;   // % needed to pass a Unit Test (gates next unit)
export const MOCK_PASS = 50;        // % at/above which a Mock is shown as "passed"
const CROWN_SILVER = 80;            // lesson mastery for a 2nd crown
const CROWN_GOLD = 95;              // lesson mastery (or a flawless run) for the 3rd crown

function readCampaign() {
  const c = readJSON(KEY.campaign, null);
  const base = { crowns: {}, tests: {}, mocks: {} };
  if (!c || typeof c !== 'object' || Array.isArray(c)) return base;
  return {
    crowns: (c.crowns && typeof c.crowns === 'object') ? c.crowns : {},
    tests: (c.tests && typeof c.tests === 'object') ? c.tests : {},
    mocks: (c.mocks && typeof c.mocks === 'object') ? c.mocks : {},
  };
}
function writeCampaign(c) { writeJSON(KEY.campaign, c); }

function crownFromRun(mastery, flawless) {
  if (flawless || (mastery != null && mastery >= CROWN_GOLD)) return 3;
  if (mastery != null && mastery >= CROWN_SILVER) return 2;
  return 1;   // cleared at all = at least one crown
}

// a lesson's crown level (0 = never cleared)
export function getCrown(phaseId) {
  const c = readCampaign();
  const v = c.crowns[phaseId];
  return Number.isFinite(v) ? v : 0;
}

// called when a CAMPAIGN lesson is finished: marks it cleared AND bumps
// its crown (monotonic — a worse later run can't take a crown away).
// `opts.mastery` (0–100) + `opts.flawless` (no wrong answers) decide the
// crown earned this run; falls back to the rolling mastery if omitted.
export function recordLessonClear(phaseId, opts = {}) {
  markPhaseCleared(phaseId);
  const mastery = (opts.mastery != null) ? opts.mastery : getTopicStats(phaseId).mastery;
  const earned = crownFromRun(mastery, !!opts.flawless);
  const c = readCampaign();
  c.crowns[phaseId] = Math.max(c.crowns[phaseId] || 0, earned);
  writeCampaign(c);
  return c.crowns[phaseId];
}

export function getUnitTest(unitId) {
  const t = readCampaign().tests[unitId];
  return { passed: !!(t && t.passed), best: (t && Number.isFinite(t.best)) ? t.best : 0 };
}
// record a Unit Test attempt (pct 0–100). Passing is sticky; best is kept.
export function recordUnitTest(unitId, pct) {
  const c = readCampaign();
  const cur = c.tests[unitId] || { passed: false, best: 0 };
  const best = Math.max(cur.best || 0, Math.round(Number(pct) || 0));
  c.tests[unitId] = { passed: cur.passed || best >= UNIT_TEST_PASS, best };
  writeCampaign(c);
  return c.tests[unitId];
}

export function getMockResult(mockId) {
  const m = readCampaign().mocks[mockId];
  return m ? { best: m.best || 0, grade: m.grade || gcseGrade(m.best || 0) } : null;
}
// record a Mock attempt (pct 0–100). Keeps the best % + its GCSE grade.
export function recordMock(mockId, pct) {
  const c = readCampaign();
  const cur = c.mocks[mockId] || { best: 0 };
  const best = Math.max(cur.best || 0, Math.round(Number(pct) || 0));
  c.mocks[mockId] = { best, grade: gcseGrade(best) };
  writeCampaign(c);
  return c.mocks[mockId];
}

function coversUpTo(units, unitId) {
  const ids = [];
  for (const u of units) { ids.push(u.id); if (u.id === unitId) break; }
  return ids;
}

// THE campaign read API: turns the UNITS topology + saved progress into a
// fully-annotated, ordered structure the path UI renders directly.
// Returns { units: [...], current } where `current` = the single "you are
// here" node (first unlocked-but-unfinished lesson or unit test), or null.
export function getCampaignState(units) {
  const list = Array.isArray(units) ? units : [];
  const out = [];
  let current = null;
  let prevComplete = true;          // unit 1 has no predecessor → unlocked

  for (const u of list) {
    const unitUnlocked = prevComplete;
    const lessons = [];
    let allCleared = true;
    let priorCleared = true;        // the previous lesson in THIS unit is cleared

    for (const pid of (u.lessons || [])) {
      const ts = getTopicStats(pid);
      const cleared = ts.cleared;
      let state;
      if (!unitUnlocked) state = 'locked';
      else if (cleared) state = 'cleared';
      else if (priorCleared) state = 'unlocked';
      else state = 'locked';
      const node = { phaseId: pid, state, crown: getCrown(pid), mastery: ts.mastery, started: ts.started };
      if (state === 'unlocked' && !current) { current = { kind: 'lesson', unitId: u.id, phaseId: pid }; node.current = true; }
      lessons.push(node);
      if (!cleared) { allCleared = false; priorCleared = false; }
    }

    const tr = getUnitTest(u.id);
    let testState;
    if (!unitUnlocked) testState = 'locked';
    else if (tr.passed) testState = 'passed';
    else if (allCleared) testState = 'unlocked';
    else testState = 'locked';
    const test = { state: testState, best: tr.best };
    if (testState === 'unlocked' && !current) { current = { kind: 'unit-test', unitId: u.id }; test.current = true; }

    const unitComplete = allCleared && tr.passed;

    let mock = null;
    if (u.mock) {
      const mr = getMockResult(u.mock.id);
      const passed = !!(mr && mr.best >= MOCK_PASS);
      mock = {
        id: u.mock.id, name: u.mock.name, covers: coversUpTo(list, u.id),
        state: !unitComplete ? 'locked' : (passed ? 'passed' : 'unlocked'),
        best: mr ? mr.best : null, grade: mr ? mr.grade : null,
      };
    }

    out.push({
      id: u.id, name: u.name, color: u.color, blurb: u.blurb,
      state: unitComplete ? 'complete' : (unitUnlocked ? 'unlocked' : 'locked'),
      lessons, test, mock,
    });
    prevComplete = unitComplete;
  }

  return { units: out, current };
}

// full progress reset (handy for testing / a future settings screen)
export function resetProgress() {
  try {
    localStorage.removeItem(KEY.topicStats);
    localStorage.removeItem(KEY.schedule);
    localStorage.removeItem(KEY.campaign);
  } catch (e) {}
}
