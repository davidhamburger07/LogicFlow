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
  topicStats: 'logicflow.topicStats',
  misses: 'logicflow.misses',
};

const DEFAULT_VOLUME = 70;            // matches the HUD slider default

// ---- mastery tuning (single source of truth) ---------------
export const MASTERY_WINDOW = 15;     // rolling window of recent attempts per topic
export const REVIEW_THRESHOLD = 60;   // mastery % below this flags "needs review"
const MISS_CAP = 500;                 // cap the unresolved-misses set

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
// record EVERY answer (called from the engine result handler, every screen).
// Updates the rolling mastery window AND the unresolved-misses set.
// A question's identity is (phaseId, questionIndex).
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

  // 2) unresolved-misses set
  const misses = getMisses();
  const same = e => e.phaseId === phaseId && e.qIndex === questionIndex;
  if (correct) {
    const filtered = misses.filter(e => !same(e));      // resolved -> drop
    if (filtered.length !== misses.length) writeJSON(KEY.misses, filtered);
  } else if (!misses.some(same)) {
    misses.push({ phaseId, qIndex: questionIndex, ts: Date.now() });
    writeJSON(KEY.misses, misses.length > MISS_CAP ? misses.slice(misses.length - MISS_CAP) : misses);
  }
}

export function getMisses() {
  const m = readJSON(KEY.misses, []);
  return Array.isArray(m) ? m : [];
}

// full progress reset (handy for testing / a future settings screen)
export function resetProgress() {
  try { localStorage.removeItem(KEY.topicStats); localStorage.removeItem(KEY.misses); } catch (e) {}
}
