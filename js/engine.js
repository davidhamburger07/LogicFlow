// ============================================================
// engine.js — game state + question flow.
//
// Owns: score, streak, lives, hints, and all the "chrome" around a
// question (question card, hint bar, feedback, explanation, next
// button, the phase intro / phase complete / game-over views).
//
// A NAVIGATION LAYER (js/screens.js) sits above this: the main menu,
// the Campaign map and the Revision hub. The engine does not know how
// those screens look — it just exposes launch entry points and calls
// registered nav handlers when a session ends.
//
// LAUNCH CONTEXT — set when a screen starts questions; decides what
// happens when the session ends:
//   'campaign'      lives on; mark phase cleared; offer next / map
//   'revision'      no lives; back to the Revision hub (no clear)
//   'spaced-review' no lives; serve a cross-topic miss queue; back to hub
//
// MASTERY HOOK — every answer is recorded to storage (per topic),
// regardless of which screen launched it. That is the foundation the
// whole hub is built on.
//
// Question-module contract (unchanged):
//   module.render(answerHost, question, ctx)
//   ctx.isAnswered() -> bool ; ctx.onSubmit(correct, details) ; ctx.sfx
// ============================================================

import { SFX } from './sound.js';
import { PHASES } from './content.js';
import * as store from './storage.js';
import { initVisual, showVisual, markAnswered, hideVisual } from './visual.js';
import { mc } from './questions/mc.js';
import { binary } from './questions/binary.js';
import { circuit } from './questions/circuit.js';
import { cipher } from './questions/cipher.js';
import { trace } from './questions/trace.js';
import { fde } from './questions/fde.js';
import { packet } from './questions/packet.js';
import { exam } from './questions/exam.js';
import { generateQuestion } from './generators.js';

const REGISTRY = { MC: mc, BINARY: binary, CIRCUIT: circuit, CIPHER: cipher, TRACE: trace, FDE: fde, PACKET: packet, EXAM: exam };

// ---- session state -----------------------------------------
let score = 0, streak = 0, lives = 3;
let currentPhaseIdx = 0, questionIdx = 0;     // of the question on screen now
let currentQuestion = null, answered = false;
let hintsLeft = 3, hintsUsedThisPhase = 0, hintLevel = 0;
let phaseStartScore = 0, hintRefilledFlag = false;

let launchContext = 'campaign';               // 'campaign' | 'revision' | 'spaced-review' | 'timed'
let sessionPhaseIdx = 0;                       // the phase a single-phase session launched
let playlist = [];                             // [{ phaseIdx, qIndex }] questions to serve
let playlistPos = 0;
let survivedCount = 0;                          // correct answers in a Survival run
let paperMarks = 0, paperTotal = 0;             // marks tally in a Past Paper run

// Timed / Exam Rush — a per-question countdown, length by question type.
let timerInt = null, timeLeft = 0, timeTotal = 0;
const TIME_FOR = { MC: 15, BINARY: 20, CIRCUIT: 35, CIPHER: 30, TRACE: 30, FDE: 35, PACKET: 30 };
const DEFAULT_TIME = 20;

function maxHints() { return 3; }
function usesLives() { return launchContext === 'campaign' || launchContext === 'survival'; }
function isTimed() { return launchContext === 'timed'; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// nav handlers registered by screens.js (no import cycle)
let nav = { toMenu() {}, toCampaign() {}, toRevision() {}, toArcade() {} };
export function setNavHandlers(h) { nav = { ...nav, ...h }; }

// abandon the current session and return to the main menu (the EXIT button).
export function exitToMenu() {
  stopTimer();
  answered = true;     // stop any in-flight question module from submitting late
  nav.toMenu();
}

// ---- cached DOM refs ---------------------------------------
const el = {};
function cache() {
  [
    'score-disp', 'streak-disp', 'score-stat', 'streak-stat', 'lives-display', 'lives-stat', 'phase-badge',
    'question-card', 'q-badge', 'q-board', 'q-prog', 'q-title', 'q-desc',
    'prog-fill', 'answer-area', 'timer-wrap', 'timer-fill', 'timer-num',
    'hint-bar', 'hint-btn', 'hint-icons', 'no-hint-note', 'hint-box',
    'feedback-box', 'explanation-box', 'expl-text', 'next-btn',
    'start-screen', 'main-menu', 'campaign-map', 'revision-hub', 'arcade-modes', 'arcade-topics', 'question-bank',
    'phase-intro', 'phase-complete', 'gameover-screen',
    'pi-eyebrow', 'pi-title', 'pi-sub', 'pi-board-tags', 'pi-body', 'pi-meta', 'hint-refill-note',
    'pc-num', 'pc-score', 'pc-hint-bonus', 'pc-hint-bonus-label', 'pc-sub', 'pc-next-btn', 'pc-map-btn',
    'go-score', 'go-msg', 'go-label', 'go-eyebrow', 'go-restart-btn', 'go-modes-btn',
  ].forEach(id => { el[id] = document.getElementById(id); });
}

const SCREENS = ['start-screen', 'main-menu', 'campaign-map', 'revision-hub', 'arcade-modes', 'arcade-topics', 'question-bank',
  'phase-intro', 'phase-complete', 'gameover-screen'];
export function showScreen(id) {
  SCREENS.forEach(s => el[s] && el[s].classList.toggle('show', s === id));
}
export function getEl(id) { return el[id]; }   // screens.js renders into its own divs

// ---- ctx handed to question modules ------------------------
const ctx = {
  isAnswered: () => answered,
  onSubmit: (correct, details) => handleResult(correct, details || {}),
  sfx: SFX,
};

// ============================================================
// boot
// ============================================================
export function initEngine() {
  cache();
  initVisual();
  showScreen('start-screen');
}

// ============================================================
// launch entry points (called by screens.js)
// ============================================================
export function launchPhase(phaseIdx, context, skipIntro = false) {
  launchContext = context;
  sessionPhaseIdx = phaseIdx;
  currentPhaseIdx = phaseIdx;
  const src = (context === 'pastpaper') ? (PHASES[phaseIdx].paper || []) : PHASES[phaseIdx].questions;
  playlist = src.map((_, qi) => ({ phaseIdx, qIndex: qi }));
  playlistPos = 0;
  if (context === 'pastpaper') { paperMarks = 0; paperTotal = 0; }
  resetSession();
  applyContextUI();
  // Campaign node tap teaches first (intro -> questions); Continue / revision /
  // past-paper go straight into the questions.
  if (context === 'campaign' && !skipIntro) showPhaseIntro();
  else startPlaylist();
}

export function startSpacedReview(queue) {
  // queue: [{ phaseIdx, qIndex }]; filter to entries that still exist
  const valid = (queue || []).filter(e =>
    PHASES[e.phaseIdx] && PHASES[e.phaseIdx].questions[e.qIndex]);
  if (valid.length === 0) { nav.toRevision(); return; }
  launchContext = 'spaced-review';
  playlist = valid;
  playlistPos = 0;
  resetSession();
  applyContextUI();
  startPlaylist();
}

// Survival / Streak — an endless cross-topic sudden-death run of
// quick-recall questions (MC + binary). One wrong answer ends it.
export function startSurvival() {
  launchContext = 'survival';
  const pool = [];
  PHASES.forEach((p, pi) => p.questions.forEach((q, qi) => {
    if (q.type === 'MC' || q.type === 'BINARY') pool.push({ phaseIdx: pi, qIndex: qi });
  }));
  shuffle(pool);
  playlist = pool;
  playlistPos = 0;
  sessionPhaseIdx = 0;
  survivedCount = 0;
  resetSession();
  applyContextUI();
  startPlaylist();
}

function resetSession() {
  score = 0; streak = 0;
  lives = (launchContext === 'survival') ? 1 : 3;   // Survival = sudden death
  hintsLeft = maxHints(); hintsUsedThisPhase = 0; hintRefilledFlag = false;
  phaseStartScore = 0;
  updateHUD();
}
function applyContextUI() {
  const paper = (launchContext === 'pastpaper');
  el['lives-stat'].style.display = usesLives() ? 'flex' : 'none';
  el['timer-wrap'].style.display = isTimed() ? 'flex' : 'none';
  // Past Paper tracks marks, not score/streak — hide those stats.
  el['score-stat'].style.display = paper ? 'none' : 'flex';
  el['streak-stat'].style.display = paper ? 'none' : 'flex';
}

// ---- phase intro (campaign only) ---------------------------
function showPhaseIntro() {
  const phase = PHASES[currentPhaseIdx];
  el['question-card'].style.display = 'none';
  hideVisual();

  document.documentElement.style.setProperty('--phase-color', phase.color);
  document.documentElement.style.setProperty('--phase-color-light', hexToRgba(phase.color, 0.08));

  el['pi-eyebrow'].textContent = `PHASE ${phase.id} OF ${PHASES.length}`;
  el['pi-title'].innerHTML = emphasise(phase.name);
  el['pi-sub'].textContent = phase.sub;
  el['pi-meta'].textContent = phase.intro.meta;
  el['pi-board-tags'].innerHTML = phase.boards.map(b => `<span class="pi-board-tag">${b}</span>`).join('');

  const intro = phase.intro;
  let body = '';
  body += section('WHAT IS IT', `<div class="pi-text">${intro.what}</div>`);
  body += section('IN THE EXAM', `<div class="pi-text">${intro.how}</div>`);
  body += section('EXAMPLES', `<div class="pi-examples">${intro.examples.map(e => `<div class="pi-example">${e}</div>`).join('')}</div>`);
  body += section('REMEMBER', `<div class="pi-tip">${intro.tip}</div>`);
  el['pi-body'].innerHTML = body;

  el['hint-refill-note'].style.display = hintRefilledFlag ? 'block' : 'none';
  hintRefilledFlag = false;

  SFX.phaseIntro();
  showScreen('phase-intro');
}

// pi-start-btn -> begin the question playlist
export function startPhaseQuestions() { startPlaylist(); }
function startPlaylist() {
  hintsUsedThisPhase = 0;
  phaseStartScore = score;
  showScreen(null);
  loadQuestion();
}

// ---- question ----------------------------------------------
function loadQuestion() {
  stopTimer();
  const entry = playlist[playlistPos];
  currentPhaseIdx = entry.phaseIdx;
  questionIdx = entry.qIndex;
  const phase = PHASES[currentPhaseIdx];
  const list = (launchContext === 'pastpaper') ? (phase.paper || []) : phase.questions;
  const slot = list[questionIdx];
  // a generated slot builds a FRESH instance on every load (so its answer
  // can't be memorised); a static slot is used as-is.
  currentQuestion = slot && slot.gen ? generateQuestion(slot.gen, slot.opts) : slot;
  answered = false;
  hintLevel = 0;

  // accent for this question's phase (matters when spaced-review crosses topics)
  document.documentElement.style.setProperty('--phase-color', phase.color);
  document.documentElement.style.setProperty('--phase-color-light', hexToRgba(phase.color, 0.08));

  el['question-card'].style.display = 'flex';
  el['q-badge'].textContent = currentQuestion.badge;
  el['q-board'].textContent = currentQuestion.board;
  el['q-prog'].textContent = progressLabel();
  el['q-title'].textContent = currentQuestion.title;

  if (currentQuestion.desc) {
    el['q-desc'].style.display = 'block';
    el['q-desc'].textContent = currentQuestion.desc;
  } else {
    el['q-desc'].style.display = 'none';
  }

  el['prog-fill'].style.width = ((playlistPos + 1) / playlist.length * 100) + '%';
  updateHUD();

  el['hint-box'].classList.remove('show');
  el['feedback-box'].className = '';
  el['explanation-box'].classList.remove('show');
  el['next-btn'].classList.remove('show');

  const hints = currentQuestion.hints || [];
  el['hint-bar'].style.display = 'flex';
  el['no-hint-note'].style.display = hintsUsedThisPhase === 0 ? 'inline' : 'none';
  updateHintIcons();
  el['hint-btn'].disabled = hintsLeft <= 0 || hints.length === 0;
  if (launchContext === 'pastpaper') el['hint-bar'].style.display = 'none';   // no hints in an exam

  showVisual(phase, currentQuestion);
  REGISTRY[currentQuestion.type].render(el['answer-area'], currentQuestion, ctx);

  if (isTimed()) startTimer(TIME_FOR[currentQuestion.type] || DEFAULT_TIME);
}

function progressLabel() {
  if (launchContext === 'spaced-review') return `REVIEW ${playlistPos + 1} of ${playlist.length}`;
  if (launchContext === 'timed') return `RUSH ${playlistPos + 1} of ${playlist.length}`;
  if (launchContext === 'survival') return `SURVIVED ${survivedCount}`;
  if (launchContext === 'pastpaper') return `PAPER · Q${playlistPos + 1} of ${playlist.length}`;
  return `Q${playlistPos + 1} of ${playlist.length}`;
}

// ---- Timed / Exam Rush countdown ---------------------------
function startTimer(seconds) {
  stopTimer();
  timeTotal = seconds; timeLeft = seconds;
  paintTimer();
  timerInt = setInterval(() => {
    timeLeft -= 0.1;
    if (timeLeft <= 0) { timeLeft = 0; paintTimer(); handleTimeout(); return; }
    paintTimer();
  }, 100);
}
function stopTimer() { if (timerInt) { clearInterval(timerInt); timerInt = null; } }
function paintTimer() {
  el['timer-num'].textContent = Math.ceil(timeLeft);
  el['timer-fill'].style.width = (timeTotal > 0 ? timeLeft / timeTotal * 100 : 0) + '%';
  el['timer-wrap'].classList.toggle('urgent', timeLeft <= 5);
}
function handleTimeout() {
  stopTimer();
  if (answered) return;
  handleResult(false, { feedbackOnWrong: 'TIME\'S UP — no answer in time.' });
}

function updateHUD() {
  el['score-disp'].textContent = score;
  el['streak-disp'].textContent = streak + '×';
  el['lives-display'].textContent = '♥'.repeat(Math.max(0, lives));
  el['phase-badge'].textContent = launchContext === 'spaced-review' ? 'REVIEW'
    : launchContext === 'survival' ? 'SURVIVAL'
      : launchContext === 'pastpaper' ? 'PAST PAPER'
        : 'PHASE ' + (currentPhaseIdx + 1);
}

function updateHintIcons() { el['hint-icons'].textContent = '💡'.repeat(Math.max(0, hintsLeft)); }

export function useHint() {
  if (answered) return;
  const hints = currentQuestion.hints || [];
  if (hintLevel >= hints.length || hintsLeft <= 0) return;
  el['hint-box'].innerHTML = '💡 ' + hints[hintLevel];
  el['hint-box'].classList.add('show');
  hintLevel++; hintsLeft--; hintsUsedThisPhase++;
  SFX.hint();
  el['no-hint-note'].style.display = 'none';
  updateHintIcons();
  if (hintsLeft <= 0 || hintLevel >= hints.length) el['hint-btn'].disabled = true;
}

// ---- result (THE MASTERY HOOK lives here) ------------------
function handleResult(correct, details) {
  if (answered) return;     // guard against a late module submit racing the timer
  answered = true;
  stopTimer();
  el['hint-bar'].style.display = 'none';
  markAnswered();

  // Past Paper: self-marked, score by marks (not points/lives); no mastery record.
  if (launchContext === 'pastpaper') {
    const m = details.marks || 0, mx = details.maxMarks || 0;
    paperMarks += m; paperTotal += mx;
    el['feedback-box'].className = (mx > 0 && m > 0) ? 'ok' : 'fail';
    el['feedback-box'].textContent = `${m} / ${mx} MARK${mx === 1 ? '' : 'S'} AWARDED`;
    showExplanation();
    el['next-btn'].textContent = 'NEXT →';
    el['next-btn'].classList.add('show');
    return;
  }

  const phase = PHASES[currentPhaseIdx];
  // record EVERY answer to the per-topic store (drives mastery + misses)
  store.recordAttempt(phase.id, questionIdx, correct);

  if (correct) {
    streak++;
    if (launchContext === 'survival') survivedCount++;
    const pts = 100 * (streak + 1) * phase.id;
    score += pts;
    SFX.correct();
    if (streak === 3 || streak === 5 || streak >= 10) SFX.streakSound(streak);
    spawnPopup('+' + pts);
    el['feedback-box'].className = 'ok';
    el['feedback-box'].textContent = `CORRECT ✓  +${pts} PTS`;
  } else {
    streak = 0;
    if (usesLives()) lives--;          // only Campaign costs lives
    SFX.wrong();
    el['feedback-box'].className = 'fail';
    el['feedback-box'].textContent = details.feedbackOnWrong
      ? `INCORRECT ✗  ${details.feedbackOnWrong}`
      : 'INCORRECT ✗  See the explanation below';
  }

  updateHUD();
  showExplanation();
  el['next-btn'].textContent = (usesLives() && lives <= 0) ? 'SEE RESULTS →' : 'NEXT →';
  el['next-btn'].classList.add('show');
}

function showExplanation() {
  if (!currentQuestion.explain) { el['explanation-box'].classList.remove('show'); return; }
  el['expl-text'].innerHTML = currentQuestion.explain;
  el['explanation-box'].classList.add('show');
}

export function nextQuestion() {
  SFX.next();
  if (usesLives() && lives <= 0) {
    if (launchContext === 'survival') survivalResults(false); else gameOver();
    return;
  }
  playlistPos++;
  if (playlistPos >= playlist.length) { endOfPlaylist(); return; }
  loadQuestion();
}

function endOfPlaylist() {
  if (launchContext === 'spaced-review') { nav.toRevision(); return; }
  if (launchContext === 'survival') { survivalResults(true); return; }   // survived every question
  if (launchContext === 'pastpaper') { paperResults(); return; }
  if (launchContext === 'campaign') {
    store.markPhaseCleared(PHASES[sessionPhaseIdx].id);   // advances the frontier
  }
  showPhaseComplete();
}

// ---- phase complete (campaign + revision) ------------------
function showPhaseComplete() {
  stopTimer();
  const phase = PHASES[sessionPhaseIdx];
  el['question-card'].style.display = 'none';
  hideVisual();
  el['next-btn'].classList.remove('show');

  let phasePts = score - phaseStartScore;
  if (hintsUsedThisPhase === 0) {
    score += 500; phasePts += 500;
    el['pc-hint-bonus'].style.display = 'block';
    el['pc-hint-bonus-label'].style.display = 'block';
    el['pc-hint-bonus'].textContent = '+500';
    updateHUD();
  } else {
    el['pc-hint-bonus'].style.display = 'none';
    el['pc-hint-bonus-label'].style.display = 'none';
  }

  el['pc-num'].textContent = phase.id;
  el['pc-score'].textContent = '+' + phasePts;
  el['pc-sub'].textContent = phaseEncouragement();

  // context-aware buttons
  if (launchContext === 'revision') {
    el['pc-next-btn'].textContent = 'BACK TO REVISION →';
    el['pc-next-btn'].onclick = () => nav.toRevision();
    el['pc-map-btn'].style.display = 'none';
  } else if (launchContext === 'timed') {
    el['pc-next-btn'].textContent = 'BACK TO ARCADE →';
    el['pc-next-btn'].onclick = () => nav.toArcade();
    el['pc-map-btn'].style.display = 'none';
  } else {
    const nextIdx = sessionPhaseIdx + 1;
    if (nextIdx < PHASES.length) {
      el['pc-next-btn'].textContent = 'NEXT PHASE →';
      el['pc-next-btn'].onclick = () => launchPhase(nextIdx, 'campaign');
      el['pc-map-btn'].style.display = 'inline-block';
      el['pc-map-btn'].textContent = 'CAMPAIGN MAP';
      el['pc-map-btn'].onclick = () => nav.toCampaign();
    } else {
      el['pc-next-btn'].textContent = 'CAMPAIGN MAP →';
      el['pc-next-btn'].onclick = () => nav.toCampaign();
      el['pc-map-btn'].style.display = 'none';
    }
  }

  SFX.phaseComplete();
  showScreen('phase-complete');
}

// ---- game over (campaign only: out of lives) ---------------
function gameOver() {
  stopTimer();
  el['question-card'].style.display = 'none';
  hideVisual();
  el['next-btn'].classList.remove('show');

  el['go-eyebrow'].textContent = 'CIRCUIT OVERLOADED';
  el['go-label'].textContent = 'FINAL SCORE';
  el['go-score'].textContent = score;
  el['go-msg'].textContent = finalMessage();
  el['go-restart-btn'].textContent = 'TRY AGAIN';
  el['go-restart-btn'].onclick = () => launchPhase(sessionPhaseIdx, 'campaign');
  el['go-modes-btn'].textContent = 'CAMPAIGN MAP';
  el['go-modes-btn'].onclick = () => nav.toCampaign();

  SFX.gameOver();
  showScreen('gameover-screen');
}

// ---- survival results (sudden death / survived everything) --
function survivalResults(cleared) {
  stopTimer();
  el['question-card'].style.display = 'none';
  hideVisual();
  el['next-btn'].classList.remove('show');

  el['go-eyebrow'].textContent = cleared ? 'FLAWLESS RUN' : 'STREAK BROKEN';
  el['go-label'].textContent = 'QUESTIONS SURVIVED';
  el['go-score'].textContent = survivedCount;
  el['go-msg'].textContent = cleared
    ? `Flawless — you answered all ${survivedCount} questions without a single slip. Final score ${score}.`
    : `You answered ${survivedCount} in a row before the streak broke. Final score ${score}.`;
  el['go-restart-btn'].textContent = 'PLAY AGAIN';
  el['go-restart-btn'].onclick = () => startSurvival();
  el['go-modes-btn'].textContent = 'BACK TO ARCADE';
  el['go-modes-btn'].onclick = () => nav.toArcade();

  if (cleared) SFX.phaseComplete(); else SFX.gameOver();
  showScreen('gameover-screen');
}

// ---- past paper results (graded) ---------------------------
function paperResults() {
  stopTimer();
  el['question-card'].style.display = 'none';
  hideVisual();
  el['next-btn'].classList.remove('show');

  const pct = paperTotal > 0 ? Math.round(100 * paperMarks / paperTotal) : 0;
  const band = pct >= 70 ? 'Strong — you look exam-ready on this topic.'
    : pct >= 50 ? 'A solid pass. Review the marking points you missed.'
      : 'Keep practising — revisit the mark schemes and retake the paper.';
  el['go-eyebrow'].textContent = 'PAPER COMPLETE';
  el['go-label'].textContent = `MARKS AWARDED · ${pct}%`;
  el['go-score'].textContent = `${paperMarks}/${paperTotal}`;
  el['go-msg'].textContent = `You awarded yourself ${paperMarks} out of ${paperTotal} marks (${pct}%). ${band}`;
  el['go-restart-btn'].textContent = 'RETAKE PAPER';
  el['go-restart-btn'].onclick = () => launchPhase(sessionPhaseIdx, 'pastpaper');
  el['go-modes-btn'].textContent = 'BACK TO ARCADE';
  el['go-modes-btn'].onclick = () => nav.toArcade();

  SFX.phaseComplete();
  showScreen('gameover-screen');
}

// ============================================================
// helpers
// ============================================================
function spawnPopup(text) {
  const p = document.createElement('div');
  p.className = 'score-popup';
  p.textContent = text;
  p.style.left = (window.innerWidth / 2 - 20 + (Math.random() - 0.5) * 80) + 'px';
  p.style.top = (window.innerHeight / 2 - 40) + 'px';
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 1000);
}
function section(label, inner) {
  return `<div class="pi-section"><div class="pi-section-label">${label}</div>${inner}</div>`;
}
function emphasise(name) {
  const parts = name.split(' ');
  if (parts.length === 1) return `<em>${name}</em>`;
  return `${parts[0]} <em>${parts.slice(1).join(' ')}</em>`;
}
function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function phaseEncouragement() {
  const msgs = [
    'Nicely done. Each correct answer is a memory you\'ve strengthened.',
    'Phase cleared. Spaced practice like this is what makes revision stick.',
    'Solid work. Keep the streak going into the next topic.',
    'That\'s the way. Active recall beats re-reading every time.',
  ];
  return msgs[currentPhaseIdx % msgs.length];
}
function finalMessage() {
  if (score >= 5000) return 'Excellent run. You\'re handling these questions like the real exam.';
  if (score >= 2000) return 'Good progress. Run it back and push your streak further.';
  return 'Every attempt builds recall. Try again and beat your score.';
}
