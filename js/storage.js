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

const KEY = {
  premium: 'logicflow.premium',
  volume: 'logicflow.volume',
  theme: 'logicflow.theme',
  topicStats: 'logicflow.topicStats',
  schedule: 'logicflow.schedule',
};

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

// full progress reset (handy for testing / a future settings screen)
export function resetProgress() {
  try { localStorage.removeItem(KEY.topicStats); localStorage.removeItem(KEY.schedule); } catch (e) {}
}
