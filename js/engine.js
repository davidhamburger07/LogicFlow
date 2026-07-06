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
import { UNITS, gcseGrade } from './units.js';
import * as store from './storage.js';
import { renderWalkthrough } from './lessons.js';
import { initVisual, showVisual, markAnswered, hideVisual } from './visual.js';
import { mc } from './questions/mc.js';
import { binary } from './questions/binary.js';
import { circuit } from './questions/circuit.js';
import { cipher } from './questions/cipher.js';
import { trace } from './questions/trace.js';
import { fde } from './questions/fde.js';
import { packet } from './questions/packet.js';
import { exam } from './questions/exam.js';
import { codetrace } from './questions/codetrace.js';
import { codefill } from './questions/codefill.js';
import { codebuild } from './questions/codebuild.js';
import { codebug } from './questions/codebug.js';
import { codefix } from './questions/codefix.js';
import { codewrite } from './questions/codewrite.js';
import { number } from './questions/number.js';
import { placevalue } from './questions/placevalue.js';
import { binadd } from './questions/binadd.js';
import { shift } from './questions/shift.js';
import { flipadd } from './questions/flipadd.js';
import { binsub } from './questions/binsub.js';
import { hexpick } from './questions/hexpick.js';
import { swatch } from './questions/swatch.js';
import { calc } from './questions/calc.js';
import { typein } from './questions/typein.js';
import { order } from './questions/order.js';
import { categorise } from './questions/categorise.js';
import { recall } from './questions/recall.js';
import { examcoach } from './questions/examcoach.js';
import { truthtable } from './questions/truthtable.js';
import { match } from './questions/match.js';
import { searchtrace } from './questions/searchtrace.js';
import { sqlbuild } from './questions/sqlbuild.js';
import { dbdetective } from './questions/dbdetective.js';
import { sqledit } from './questions/sqledit.js';
import { argue } from './questions/argue.js';
import { cpusim } from './questions/cpusim.js';
import { hwstore } from './questions/hwstore.js';
import { imgslider } from './questions/imgslider.js';
import { rle } from './questions/rle.js';
import { iproute } from './questions/iproute.js';
import { phish } from './questions/phish.js';
import { osmem } from './questions/osmem.js';
import { translate } from './questions/translate.js';
import { aitrain } from './questions/aitrain.js';
import { serverroom } from './questions/serverroom.js';
import { overflowdoor } from './questions/overflowdoor.js';
import { hexlock } from './questions/hexlock.js';
import { signalrestore } from './questions/signalrestore.js';
import { binbuild } from './questions/binbuild.js';
import { workings } from './questions/workings.js';
import { stepadd } from './questions/stepadd.js';
import { gridmul } from './questions/gridmul.js';
import { busstop } from './questions/busstop.js';
import { bitmap } from './questions/bitmap.js';
import { gateout } from './questions/gateout.js';
import { ttwalk } from './questions/ttwalk.js';
import { notate } from './questions/notate.js';
import { circtable } from './questions/circtable.js';
import { binread } from './questions/binread.js';
import { hexread } from './questions/hexread.js';
import { signbuild } from './questions/signbuild.js';
import { rangecheck } from './questions/rangecheck.js';
import { inserttrace } from './questions/inserttrace.js';
import { mergetrace } from './questions/mergetrace.js';
import { qatest } from './questions/qatest.js';
import { generateQuestion } from './generators.js';
import { initSketchpad, toggleSketchpad, closeSketchpad } from './sketchpad.js';
import { initWorkpad, showWorkpad, hideWorkpad } from './workpad.js';
import { SVG_DIAGRAMS } from './diagrams.js';
import { notationTableHtml } from './notation.js';

export const REGISTRY = { MC: mc, BINARY: binary, CIRCUIT: circuit, CIPHER: cipher, TRACE: trace, FDE: fde, PACKET: packet, EXAM: exam, CODE_TRACE: codetrace, CODE_FILL: codefill, CODE_BUILD: codebuild, CODE_BUG: codebug, CODE_FIX: codefix, CODE_WRITE: codewrite, NUMBER: number, PLACEVALUE: placevalue, BINADD: binadd, SHIFT: shift, FLIPADD: flipadd, BINSUB: binsub, HEXPICK: hexpick, SWATCH: swatch, CALC: calc, TYPEIN: typein, ORDER: order, CATEGORISE: categorise, RECALL: recall, EXAMCOACH: examcoach, TRUTHTABLE: truthtable, MATCH: match, SEARCHTRACE: searchtrace, SQLBUILD: sqlbuild, DBDETECTIVE: dbdetective, SQLEDIT: sqledit, ARGUE: argue, CPUSIM: cpusim, HWSTORE: hwstore, IMGSLIDER: imgslider, RLE: rle, IPROUTE: iproute, PHISH: phish, OSMEM: osmem, TRANSLATE: translate, AITRAIN: aitrain, SERVERROOM: serverroom, OVERFLOW: overflowdoor, HEXLOCK: hexlock, SIGNAL: signalrestore, BINBUILD: binbuild, WORKINGS: workings, STEPADD: stepadd, GRIDMUL: gridmul, BUSSTOP: busstop, BITMAP: bitmap, GATEOUT: gateout, TTWALK: ttwalk, NOTATE: notate, CIRCTABLE: circtable, BINREAD: binread, HEXREAD: hexread, SIGNBUILD: signbuild, RANGECHECK: rangecheck, INSERTTRACE: inserttrace, MERGETRACE: mergetrace, QATEST: qatest };

// phase id -> index in PHASES (for building unit-test playlists by lesson id)
const PHASE_IDX_BY_ID = {};
PHASES.forEach((p, i) => { PHASE_IDX_BY_ID[p.id] = i; });

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
let testCorrect = 0, testTotal = 0, testUnitId = null;  // Unit Test / Mock tally
let currentMockId = null, currentMockName = '';  // the running Mock Exam
let runWrong = 0;                               // wrong answers this lesson run (drives crowns)

// Timed / Exam Rush — a per-question countdown, length by question type.
let timerInt = null, timeLeft = 0, timeTotal = 0;
const TIME_FOR = { MC: 15, BINARY: 20, CIRCUIT: 35, CIPHER: 30, TRACE: 30, FDE: 35, PACKET: 30, SQLBUILD: 45, DBDETECTIVE: 75, SQLEDIT: 45, ARGUE: 150, CPUSIM: 90, HWSTORE: 90, IMGSLIDER: 60, RLE: 60, IPROUTE: 75, PHISH: 75, OSMEM: 75, TRANSLATE: 60, AITRAIN: 75 };
const DEFAULT_TIME = 20;

function maxHints() { return 3; }
function usesLives() { return launchContext === 'campaign' || launchContext === 'survival'; }
function isTimed() { return launchContext === 'timed'; }
function isUnitTest() { return launchContext === 'unit-test'; }
function isMock() { return launchContext === 'mock'; }
function noHints() { return launchContext === 'pastpaper' || launchContext === 'unit-test' || launchContext === 'mock'; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Is this question off the current board's spec (→ show the optional-extension
// banner)? Two ways a question opts in:
//   • writeCommand: true          → SQL modification (required for AQA/Eduqas)
//   • reqBoards: ['OCR', …]       → required for those boards, optional for others
//     (pair with enrichLabel for the banner wording)
// Returns { label, req } when it should be marked optional here, else null.
function boardEnrich(q) {
  if (!q) return null;
  if (q.writeCommand && !store.boardRequiresSqlWrite()) return { label: 'INSERT / UPDATE / DELETE', req: store.sqlWriteBoards() };
  if (Array.isArray(q.reqBoards) && !q.reqBoards.includes(store.getBoard())) return { label: q.enrichLabel || 'This topic', req: q.reqBoards };
  return null;
}

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
    'question-card', 'q-badge', 'q-board', 'q-prog', 'q-title', 'q-desc', 'q-enrich',
    'prog-fill', 'answer-area', 'workings-bar', 'workings-btn', 'timer-wrap', 'timer-fill', 'timer-num',
    'hint-bar', 'hint-btn', 'hint-icons', 'no-hint-note', 'hint-box',
    'feedback-box', 'explanation-box', 'expl-text', 'next-btn',
    'main-menu', 'campaign-map', 'revision-hub', 'arcade-modes', 'arcade-topics', 'question-bank', 'stats', 'settings', 'tutorial',
    'phase-intro', 'phase-complete', 'gameover-screen',
    'pi-eyebrow', 'pi-title', 'pi-sub', 'pi-board-tags', 'pi-body', 'pi-meta', 'hint-refill-note',
    'pc-num', 'pc-score', 'pc-hint-bonus', 'pc-hint-bonus-label', 'pc-sub', 'pc-crown', 'pc-next-btn', 'pc-map-btn',
    'go-score', 'go-msg', 'go-label', 'go-eyebrow', 'go-restart-btn', 'go-modes-btn',
  ].forEach(id => { el[id] = document.getElementById(id); });
}

const SCREENS = ['main-menu', 'campaign-map', 'revision-hub', 'arcade-modes', 'arcade-topics', 'question-bank', 'stats', 'settings', 'tutorial',
  'phase-intro', 'phase-complete', 'gameover-screen'];
let curScreenId = null;   // the full-screen overlay showing now (null = graded gameplay / game area)
export function getCurrentScreen() { return curScreenId; }
export function showScreen(id) {
  curScreenId = id;
  if (id) closeSketchpad();   // the scratch pad is only for the question view
  if (id && id !== 'phase-intro') hideWorkpad();   // leaving the lesson flow hides the working layer
  // HUD shows during a level (phase-intro) and graded gameplay (id === null);
  // hidden on the menu and other nav screens. Lessons are formative, so the
  // score/streak/lives stats are hidden there (controls only).
  const hud = document.getElementById('hud');
  if (hud) {
    const onLevel = id === 'phase-intro';
    hud.classList.toggle('hud-active', onLevel || id === null);
    hud.classList.toggle('hud-controls-only', onLevel);
  }
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
  initSketchpad();
  initWorkpad();
  // no power-on screen — main.js boots straight into the main menu
}

// ============================================================
// launch entry points (called by screens.js)
// ============================================================
export function launchPhase(phaseIdx, context, skipIntro = false) {
  launchContext = context;
  lessonReview = false;
  sessionPhaseIdx = phaseIdx;
  currentPhaseIdx = phaseIdx;
  const src = (context === 'pastpaper') ? (PHASES[phaseIdx].paper || []) : PHASES[phaseIdx].questions;
  let pl = src.map((_, qi) => ({ phaseIdx, qIndex: qi }));
  // EXAM (extended-answer) questions don't suit a per-question countdown — skip them in Timed
  if (context === 'timed') pl = pl.filter(e => { const t = PHASES[phaseIdx].questions[e.qIndex].type; return t !== 'EXAM' && t !== 'CODE_WRITE' && t !== 'EXAMCOACH'; });
  // (the "from the video" watch-check is now rendered inline between the learn
  // pages by the multi-page lesson player, not injected into the playlist.)
  playlist = pl;
  playlistPos = 0;
  if (context === 'pastpaper') { paperMarks = 0; paperTotal = 0; }
  resetSession();
  applyContextUI();
  // Campaign node tap teaches first (intro -> questions); Continue / revision /
  // past-paper go straight into the questions. A continuous-flow topic IS the
  // lesson (no separate test), so it always plays the flow in campaign — even
  // from "Continue" (skipIntro), which would otherwise run the old test.
  if (context === 'campaign' && (!skipIntro || PHASES[phaseIdx].intro.continuous)) showPhaseIntro();
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

// Practical Coding — a cross-topic run of just the WRITE-A-PROGRAM
// (CODE_WRITE) challenges, in phase order (easy -> hard). Each is
// self-marked against its mark scheme; no lives, no timer. The dedicated
// "write real code" workout for the programming strand.
export function startPractical() {
  launchContext = 'practical';
  const pl = [];
  PHASES.forEach((p, pi) => p.questions.forEach((q, qi) => {
    if (q.type === 'CODE_WRITE') pl.push({ phaseIdx: pi, qIndex: qi });
  }));
  if (!pl.length) { nav.toArcade(); return; }
  playlist = pl;
  playlistPos = 0;
  sessionPhaseIdx = pl[0].phaseIdx;
  paperMarks = 0; paperTotal = 0;     // reuse the marks accumulators
  resetSession();
  applyContextUI();
  startPlaylist();
}

// Unit Test — a no-hints mixed assessment drawn from a unit's lessons.
// Passing (>= 70%, see storage UNIT_TEST_PASS) completes the unit and
// unlocks the next. Called by screens.js when a test node is tapped.
export function launchUnitTest(unitId) {
  const unit = UNITS.find(u => u.id === unitId);
  if (!unit) return;
  const pl = buildUnitTestPlaylist(unit);
  if (!pl.length) return;
  launchContext = 'unit-test';
  testUnitId = unitId;
  testCorrect = 0; testTotal = 0;
  playlist = pl;
  playlistPos = 0;
  sessionPhaseIdx = PHASE_IDX_BY_ID[unit.lessons[0]] || 0;
  resetSession();
  applyContextUI();
  startPlaylist();
}

// a balanced sample (<= TEST_SIZE questions) across the unit's lessons,
// round-robined so each lesson is represented, then shuffled.
function buildUnitTestPlaylist(unit) {
  const TEST_SIZE = 10;
  const byLesson = unit.lessons.map(pid => {
    const phaseIdx = PHASE_IDX_BY_ID[pid];
    const phase = PHASES[phaseIdx];
    const qs = (phase && phase.questions) ? phase.questions.map((_, qi) => ({ phaseIdx, qIndex: qi })) : [];
    return shuffle(qs);
  });
  const out = [];
  let added = true;
  while (out.length < TEST_SIZE && added) {
    added = false;
    for (const lesson of byLesson) {
      if (lesson.length && out.length < TEST_SIZE) { out.push(lesson.pop()); added = true; }
    }
  }
  return shuffle(out);
}

// Mock Exam — a bigger CUMULATIVE assessment across every unit the mock
// covers (all units up to and including the one it sits after), graded
// 1–9. Optional: it records a result but never gates progress.
export function launchMock(mockId) {
  const unitIdx = UNITS.findIndex(u => u.mock && u.mock.id === mockId);
  if (unitIdx < 0) return;
  const coveredUnits = UNITS.slice(0, unitIdx + 1);
  const pl = buildMockPlaylist(coveredUnits);
  if (!pl.length) return;
  launchContext = 'mock';
  currentMockId = mockId;
  currentMockName = UNITS[unitIdx].mock.name;
  testCorrect = 0; testTotal = 0;
  playlist = pl;
  playlistPos = 0;
  sessionPhaseIdx = PHASE_IDX_BY_ID[coveredUnits[0].lessons[0]] || 0;
  resetSession();
  applyContextUI();
  startPlaylist();
}

// a balanced sample (<= MOCK_SIZE) across every lesson in the covered units.
function buildMockPlaylist(units) {
  const MOCK_SIZE = 20;
  const lessons = [];
  units.forEach(u => u.lessons.forEach(pid => {
    const phaseIdx = PHASE_IDX_BY_ID[pid];
    const phase = PHASES[phaseIdx];
    if (phase && phase.questions) lessons.push(shuffle(phase.questions.map((_, qi) => ({ phaseIdx, qIndex: qi }))));
  }));
  const out = [];
  let added = true;
  while (out.length < MOCK_SIZE && added) {
    added = false;
    for (const l of lessons) { if (l.length && out.length < MOCK_SIZE) { out.push(l.pop()); added = true; } }
  }
  return shuffle(out);
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

// ---- phase intro: MULTI-PAGE lesson (campaign only) --------
// The learn screen is paged: each topic auto-paginates its standard blocks
// (why+watch · what+facts · one worked example per page · exam tips), with a
// quick formative check (e.g. the watch-check) between pages. A topic can
// override with an authored `intro.pages` sequence for bespoke depth.
let lessonPages = [], lessonPos = 0, lessonCheckPending = false, lessonDone = new Set();
let lessonReview = false;   // true when the lesson is opened for review (learn-only)
let lessonContinuous = false;   // true for the "one continuous flow" topics (teach + practise +
                                // solo exam, no separate scored test) — finishing clears the topic

// show ONLY the learn pages for a topic (no questions), returning to the
// campaign map at the end. The campaign map's green LEARN node calls this so
// the learn section is separate from the questions and easy to revisit.
export function viewLesson(phaseIdx) {
  currentPhaseIdx = phaseIdx;
  lessonReview = true;
  showPhaseIntro();
}

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

  lessonContinuous = !lessonReview && !!phase.intro.continuous;
  lessonPages = buildLessonPages(phase);
  lessonPos = 0; lessonDone = new Set();
  renderLessonPage();

  el['hint-refill-note'].style.display = hintRefilledFlag ? 'block' : 'none';
  hintRefilledFlag = false;
  SFX.phaseIntro();
  showScreen('phase-intro');
}

// a standard learn block by key (used by the authored-page `use` array + auto-paginate)
function standardBlock(k, intro) {
  switch (k) {
    case 'task': return intro.task ? taskCard(intro.task) : '';
    case 'realWorld': return intro.realWorld ? realWorldCard(intro.realWorld) : '';
    case 'video': return intro.video ? videoBlock(intro.video) : '';
    case 'what': return intro.what ? section('WHAT IS IT', `<div class="pi-text">${intro.what}</div>`) : '';
    case 'walkthrough': return intro.walkthrough ? `<div class="pi-walk-host" data-walk="${intro.walkthrough}"></div>` : '';
    case 'diagram': return (intro.visual && DIAGRAMS[intro.visual]) ? `<div class="pi-diagram">${DIAGRAMS[intro.visual]}</div>` : '';
    case 'keyFacts': return (intro.keyFacts && intro.keyFacts.length) ? keyFactsBlock(intro.keyFacts) : '';
    case 'how': return intro.how ? section('IN THE EXAM', `<div class="pi-text">${intro.how}</div>`) : '';
    case 'tip': return intro.tip ? section('REMEMBER', `<div class="pi-tip">${intro.tip}</div>`) : '';
    default: return '';
  }
}
function exampleBlock(intro, i, label) {
  if (!intro.examples || !intro.examples[i]) return '';
  return section(label || `WORKED EXAMPLE ${i + 1}`, `<div class="pi-examples"><div class="pi-example">${intro.examples[i]}</div></div>`);
}

// build the page list — authored (intro.pages) or auto-paginated from the fields.
function buildLessonPages(phase) {
  const intro = phase.intro;
  if (Array.isArray(intro.pages) && intro.pages.length) {
    return intro.pages.filter(p => !p.onlyBoards || p.onlyBoards.includes(store.getBoard())).map(p => {
      const parts = [];
      // board-conditional spec flag: content for a gate the player's board doesn't require
      if (p.specGate && !store.boardRequiresGate(p.specGate)) {
        const withGate = store.boardsWithGate(p.specGate).join(', ');
        parts.push(`<div class="pi-specnote">⚠ <strong>${p.specGate}</strong> is not on your <strong>${store.getBoard()}</strong> spec — treat this as <strong>optional enrichment</strong> (it's required for ${withGate}). You can skip it, or learn it for extra confidence.</div>`);
      }
      (p.use || []).forEach(k => { const b = standardBlock(k, intro); if (b) parts.push(b); });
      if (p.example != null) parts.push(exampleBlock(intro, p.example, p.heading));
      else if (p.html) parts.push(p.heading ? `<div class="pi-section"><div class="pi-heading">${p.heading}</div>${p.html}</div>` : p.html);
      else if (p.heading) parts.push(`<div class="pi-heading">${p.heading}</div>`);
      // dynamic board-shorthand reference table (adapts to the player's exam board)
      if (p.boardNotation) parts.push(`<div class="pi-diagram">${notationTableHtml()}</div>`);
      // per-page SVG diagram(s) (more visual content): `diagram: '<key>'` or an array
      if (p.diagram) [].concat(p.diagram).forEach(key => { const d = SVG_DIAGRAMS[key] || DIAGRAMS[key]; if (d) parts.push(`<div class="pi-diagram">${d}</div>`); });
      return { html: parts.join(''), check: p.check, q: p.q, part: p.part };
    }).filter(pg => pg.html || pg.check || pg.q);
  }
  // auto-paginate: why+watch · what+facts · one example per page · exam tips
  const pages = [];
  const hook = ['task', 'realWorld', 'video'].map(k => standardBlock(k, intro)).filter(Boolean);
  if (hook.length) pages.push({ html: hook.join(''), check: intro.watchCheck });
  const explainKeys = intro.walkthrough ? ['what', 'walkthrough', 'keyFacts'] : ['what', 'diagram', 'keyFacts'];
  const explain = explainKeys.map(k => standardBlock(k, intro)).filter(Boolean);
  if (explain.length) pages.push({ html: explain.join('') });
  (intro.examples || []).forEach((_, i) => pages.push({ html: exampleBlock(intro, i) }));
  const exam = ['how', 'tip'].map(k => standardBlock(k, intro)).filter(Boolean);
  if (exam.length) pages.push({ html: exam.join('') });
  if (!pages.length) pages.push({ html: standardBlock('what', intro) || '<div class="pi-text">Ready when you are.</div>' });
  return pages;
}

function wireLessonMedia(host) {
  const walkHost = host.querySelector('.pi-walk-host');
  if (walkHost) renderWalkthrough(walkHost, walkHost.dataset.walk);
  host.querySelectorAll('.pi-video-frame[data-vid]').forEach(frame => {
    const play = () => { frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${frame.dataset.vid}?autoplay=1&rel=0&modestbranding=1" title="Educational video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`; frame.classList.add('playing'); };
    frame.addEventListener('click', play);
    frame.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
  });
}

// a quick formative check between pages — immediate feedback, no lives. NEXT
// is gated until it's attempted (so the page is actually engaged with).
function renderLessonCheck(host, check, alreadyDone) {
  const startBtn = document.getElementById('pi-start-btn');
  const box = document.createElement('div'); box.className = 'pi-check';
  box.innerHTML = `<div class="pi-check-badge">✓ QUICK CHECK</div><div class="pi-check-q">${check.title}</div>`;
  const opts = document.createElement('div'); opts.className = 'pi-check-opts';
  let done = false;
  shuffle(check.options.slice()).forEach(o => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pi-check-opt'; b.textContent = o;
    b.addEventListener('click', () => {
      if (done) return; done = true;
      const correct = o === check.answer;
      [...opts.children].forEach(c => { c.disabled = true; if (c.textContent === check.answer) c.classList.add('correct'); else if (c === b) c.classList.add('wrong'); });
      if (correct) SFX.correct(); else SFX.wrong();
      if (check.explain) { const ex = document.createElement('div'); ex.className = 'pi-check-explain'; ex.innerHTML = check.explain; box.appendChild(ex); }
      lessonDone.add(lessonPos); lessonCheckPending = false;
      if (startBtn) startBtn.disabled = false;
    });
    opts.appendChild(b);
  });
  box.appendChild(opts);
  host.appendChild(box);
  if (alreadyDone) lessonCheckPending = false;   // revisited via BACK — don't re-gate
}

// a real interactive question rendered INSIDE a learn page (the "we do" step):
// the working surfaces (place-value adder, denary->binary walkthrough, step
// calculator) appear in the flow as guided practice. Formative — no lives;
// it gates NEXT until answered, then shows the explanation.
function renderLessonQuestion(host, q) {
  const already = lessonDone.has(lessonPos);
  lessonCheckPending = !already;
  const reg = REGISTRY[q.type];
  if (!reg) { lessonCheckPending = false; return; }
  const box = document.createElement('div'); box.className = 'pi-q' + (q.exam ? ' pi-q-exam' : '');
  box.innerHTML = `<div class="pi-check-badge${q.exam ? ' pi-exam-badge' : ''}">${q.exam ? '🎓 EXAM QUESTION · work it out on your own' : (q.walk ? '▶ STEP THROUGH IT' : '▶ YOUR TURN')}</div>`
    + (q.title ? `<div class="pi-q-prompt">${q.title}</div>` : '');
  const qhost = document.createElement('div'); qhost.className = 'pi-q-host';
  box.appendChild(qhost);
  host.appendChild(box);
  let answered = already;
  reg.render(qhost, q, {
    isAnswered: () => answered,
    onSubmit: (correct, details) => {
      if (answered) return;
      answered = true; lessonDone.add(lessonPos); lessonCheckPending = false;
      // continuous-flow questions feed topic mastery (but not the per-question
      // Leitner scheduler — they have no stable phase.questions index).
      if (lessonContinuous) store.recordAttempt(PHASES[currentPhaseIdx].id, 'L' + lessonPos, correct, { schedule: false });
      const sb = document.getElementById('pi-start-btn'); if (sb) sb.disabled = false;
      if (correct) SFX.correct(); else SFX.wrong();
      // a walkthrough (STEPADD) shows its own answer — no need for a "Correct" line
      if (!q.walk) {
        const ex = document.createElement('div');
        ex.className = 'pi-q-explain ' + (correct ? 'ok' : 'no');
        ex.innerHTML = (correct ? '✓ ' : '✗ ') + (q.explain || (details && details.feedbackOnWrong) || (correct ? 'Correct.' : 'Not quite.'));
        box.appendChild(ex);
      }
    },
    sfx: SFX,
  });
}

function renderLessonPage() {
  const page = lessonPages[lessonPos];
  closeSketchpad();   // fresh page — hide any working layer / scratch pad
  const partHtml = page.part ? `<div class="pi-part">${page.part}</div>` : '';
  el['pi-body'].innerHTML = partHtml + `<div class="pi-reveal" style="--i:0">${page.html}</div>`;
  const body = el['pi-body'].querySelector('.pi-reveal');
  wireLessonMedia(body);
  lessonCheckPending = false;
  if (page.check) { lessonCheckPending = !lessonDone.has(lessonPos); renderLessonCheck(body, page.check, lessonDone.has(lessonPos)); }
  if (page.q) renderLessonQuestion(body, page.q);
  // the on-page WORKING OUT layer is offered on the working questions
  if (page.q) showWorkpad(); else hideWorkpad();
  const dots = document.getElementById('pi-dots');
  if (dots) dots.innerHTML = lessonPages.map((_, i) => `<span class="pi-dot${i === lessonPos ? ' on' : (i < lessonPos ? ' done' : '')}"></span>`).join('');
  const back = document.getElementById('pi-back-btn');
  if (back) back.style.visibility = lessonPos > 0 ? 'visible' : 'hidden';
  const start = document.getElementById('pi-start-btn');
  if (start) {
    const last = lessonPos >= lessonPages.length - 1;
    start.textContent = last ? (lessonReview ? '← BACK TO MAP' : (lessonContinuous ? 'FINISH →' : 'START PHASE →')) : 'NEXT →';
    start.disabled = lessonCheckPending;
  }
  const pi = document.getElementById('phase-intro'); if (pi) pi.scrollTop = 0;
}

// returns true when the player is on the LAST page (→ start the phase),
// false after advancing to the next page. (Wired by main.js's NEXT/START button.)
export function lessonAdvance() {
  if (lessonCheckPending) return false;
  if (lessonPos >= lessonPages.length - 1) {
    // review mode (opened from the green LEARN node) -> back to the map,
    // not into the questions. Return false so main.js skips the read-confirm.
    if (lessonReview) { lessonReview = false; nav.toCampaign(); return false; }
    // continuous-flow topic: the flow IS the whole topic (teach + practise +
    // solo exam), so finishing it clears the topic — there's no separate test.
    if (lessonContinuous) { finishContinuousFlow(); return false; }
    return true;
  }
  lessonPos++; renderLessonPage(); SFX.uiClick();
  return false;
}
export function lessonBack() {
  if (lessonPos > 0) { lessonPos--; renderLessonPage(); SFX.uiClick(); }
}

// finish a continuous-flow topic: mark it cleared and return to the campaign
// map. Formative — there are no lives, so completion (not a flawless run) is
// what clears it; mastery comes from the in-flow questions already recorded.
function finishContinuousFlow() {
  lessonContinuous = false;
  closeSketchpad(); hideWorkpad();
  store.recordLessonClear(PHASES[sessionPhaseIdx].id, { flawless: false });
  SFX.zap();
  nav.toCampaign();
}

// pi-start-btn -> begin the question playlist
export function startPhaseQuestions() { startPlaylist(); }
function startPlaylist() {
  hintsUsedThisPhase = 0;
  runWrong = 0;
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
  if (entry.watchCheck) {
    currentQuestion = watchCheckQuestion(phase);
  } else {
    const list = (launchContext === 'pastpaper') ? (phase.paper || []) : phase.questions;
    const slot = list[questionIdx];
    // a generated slot builds a FRESH instance on every load (so its answer
    // can't be memorised); a static slot is used as-is.
    currentQuestion = slot && slot.gen ? generateQuestion(slot.gen, slot.opts, launchContext) : slot;
    // a "solo" slot strips the scaffolding (hint bar + method desc) so a topic
    // can END on a genuinely zero-help question — the help fades as you progress.
    if (currentQuestion && slot && slot.solo) currentQuestion = { ...currentQuestion, solo: true };
  }
  answered = false;
  hintLevel = 0;

  // accent for this question's phase (matters when spaced-review crosses topics)
  document.documentElement.style.setProperty('--phase-color', phase.color);
  document.documentElement.style.setProperty('--phase-color-light', hexToRgba(phase.color, 0.08));

  el['question-card'].style.display = 'flex';
  el['q-badge'].textContent = currentQuestion.solo ? `${currentQuestion.badge} · SOLO` : currentQuestion.badge;
  el['q-board'].textContent = currentQuestion.board;
  el['q-prog'].textContent = progressLabel();
  el['q-title'].textContent = currentQuestion.title;

  if (currentQuestion.desc && !currentQuestion.solo) {
    el['q-desc'].style.display = 'block';
    el['q-desc'].textContent = currentQuestion.desc;
  } else {
    el['q-desc'].style.display = 'none';
  }

  // Board slider — some content is on one board's spec but only optional
  // enrichment for others (SQL INSERT/UPDATE/DELETE for AQA/Eduqas; OCR-only
  // Freedom of Information / Creative Commons; AQA's open-source emphasis). The
  // question is NEVER hidden: off-spec boards get a clear "optional extension"
  // banner + a SKIP button so it's genuinely opt-in.
  el['q-enrich'].innerHTML = '';
  const enrich = boardEnrich(currentQuestion);
  if (enrich) {
    el['q-enrich'].style.display = 'block';
    const note = document.createElement('div');
    note.className = 'q-enrich-note';
    note.innerHTML = `⚠ <strong>${enrich.label}</strong> isn't on the <strong>${store.getBoard()}</strong> spec — this is an <strong>optional extension task</strong> (required for ${enrich.req.join(', ')}). Have a go for extra confidence, or skip it.`;
    const skip = document.createElement('button');
    skip.type = 'button'; skip.className = 'q-enrich-skip'; skip.textContent = 'SKIP — not on my spec →';
    skip.addEventListener('click', () => { if (!answered) nextQuestion(); });
    el['q-enrich'].append(note, skip);
  } else {
    el['q-enrich'].style.display = 'none';
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
  if (noHints() || currentQuestion.solo || currentQuestion.type === 'EXAM' || currentQuestion.type === 'CODE_WRITE' || currentQuestion.type === 'EXAMCOACH' || currentQuestion.type === 'ARGUE') el['hint-bar'].style.display = 'none';   // no hints in an exam / unit test / code-write / coached exam / argument-builder / solo (zero-help) question

  showVisual(phase, currentQuestion);
  REGISTRY[currentQuestion.type].render(el['answer-area'], currentQuestion, ctx);

  // the scratch pad is offered on EVERY question — like exam paper, always
  // available for working out (the persistent #sketchpad keeps your drawing).
  el['workings-bar'].style.display = 'flex';

  if (isTimed()) startTimer(TIME_FOR[currentQuestion.type] || DEFAULT_TIME);
}

// toggle the global scratch pad (wired to #workings-btn in main.js)
export function toggleWorkings() {
  const open = toggleSketchpad();
  el['workings-btn'].textContent = open ? '✏ HIDE SCRATCH PAD' : '✏ SCRATCH PAD';
}

function progressLabel() {
  if (launchContext === 'spaced-review') return `REVIEW ${playlistPos + 1} of ${playlist.length}`;
  if (launchContext === 'timed') return `RUSH ${playlistPos + 1} of ${playlist.length}`;
  if (launchContext === 'practical') return `CODE ${playlistPos + 1} of ${playlist.length}`;
  if (launchContext === 'unit-test') return `TEST ${playlistPos + 1} of ${playlist.length}`;
  if (launchContext === 'mock') return `MOCK ${playlistPos + 1} of ${playlist.length}`;
  if (launchContext === 'survival') return `SURVIVED ${survivedCount}`;
  if (launchContext === 'pastpaper') return `PAPER · Q${playlistPos + 1} of ${playlist.length}`;
  return `Q${playlistPos + 1} of ${playlist.length}`;
}

// ---- Timed / Exam Rush countdown ---------------------------
let timerPaused = false;
function runTimer() {
  timerInt = setInterval(() => {
    timeLeft -= 0.1;
    if (timeLeft <= 0) { timeLeft = 0; paintTimer(); handleTimeout(); return; }
    paintTimer();
  }, 100);
}
function startTimer(seconds) {
  stopTimer();
  timeTotal = seconds; timeLeft = seconds;
  paintTimer();
  runTimer();
}
function stopTimer() { if (timerInt) { clearInterval(timerInt); timerInt = null; } }
// pause/resume the countdown for an in-game settings overlay (so a Timed
// question can't expire while the player is in settings).
export function pauseTimer() { if (timerInt) { stopTimer(); timerPaused = true; } }
export function resumeTimer() {
  if (!timerPaused) return;
  timerPaused = false;
  if (isTimed() && timeLeft > 0 && !answered) { paintTimer(); runTimer(); }
}
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
        : launchContext === 'unit-test' ? 'UNIT TEST'
          : launchContext === 'mock' ? 'MOCK EXAM'
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

  // EXAM-style (mark-based) question woven into a normal lesson / test.
  // It is SELF-marked, so it never costs a life; scoring half marks or
  // more counts as "correct" for mastery, crowns, score and the test tally.
  if (details && details.maxMarks != null) {
    const m = details.marks || 0, mx = details.maxMarks || 0;
    const passed = mx > 0 && m >= Math.ceil(mx / 2);
    if (launchContext === 'practical') { paperMarks += m; paperTotal += mx; }
    store.recordAttempt(phase.id, questionIdx, passed);
    if (isUnitTest() || isMock()) { testTotal++; if (passed) testCorrect++; }
    if (passed) streak++; else { streak = 0; runWrong++; }
    const pts = m * 60 * phase.id;
    score += pts;
    if (passed) SFX.correct(); else SFX.wrong();
    el['feedback-box'].className = passed ? 'ok' : 'fail';
    el['feedback-box'].textContent = `${m} / ${mx} MARK${mx === 1 ? '' : 'S'} AWARDED` + (pts ? `  +${pts} PTS` : '');
    updateHUD();
    showExplanation();
    const lastInRun = playlistPos >= playlist.length - 1;
    el['next-btn'].textContent = ((usesLives() && lives <= 0) || (launchContext === 'practical' && lastInRun)) ? 'SEE RESULTS →' : 'NEXT →';
    el['next-btn'].classList.add('show');
    return;
  }

  // record EVERY answer to the per-topic store (drives mastery + misses) —
  // except the synthetic video watch-check, which has no real question index.
  if (!currentQuestion.watchCheck) store.recordAttempt(phase.id, questionIdx, correct);
  if (isUnitTest() || isMock()) { testTotal++; if (correct) testCorrect++; }

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
    runWrong++;
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
  if (launchContext === 'practical') { practicalResults(); return; }
  if (launchContext === 'pastpaper') { paperResults(); return; }
  if (launchContext === 'unit-test') { unitTestResults(); return; }
  if (launchContext === 'mock') { mockResults(); return; }
  if (launchContext === 'campaign') {
    // mark the lesson cleared AND bump its crown (flawless run = no wrong answers)
    store.recordLessonClear(PHASES[sessionPhaseIdx].id, { flawless: runWrong === 0 });
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

  // crown earned this run (campaign lessons only — recordLessonClear has run)
  if (launchContext === 'campaign') {
    const cr = store.getCrown(phase.id);
    el['pc-crown'].innerHTML = crownStars(cr)
      + `<span class="pc-crown-label">${cr >= 3 ? '★ MASTERED' : 'REPLAY FLAWLESSLY FOR ★★★'}</span>`;
    el['pc-crown'].style.display = 'flex';
  } else {
    el['pc-crown'].style.display = 'none';
  }

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
    // campaign: return to the path — the next node (lesson or unit test)
    // lights up there. (The old PHASES-index jump skipped around the units.)
    el['pc-next-btn'].textContent = 'CONTINUE →';
    el['pc-next-btn'].onclick = () => nav.toCampaign();
    el['pc-map-btn'].style.display = 'none';
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

// ---- practical coding results (self-marked marks total) ----
function practicalResults() {
  stopTimer();
  el['question-card'].style.display = 'none';
  hideVisual();
  el['next-btn'].classList.remove('show');

  const n = playlist.length;
  const pct = paperTotal > 0 ? Math.round(100 * paperMarks / paperTotal) : 0;
  const band = pct >= 80 ? 'Excellent — your programs hit nearly every marking point.'
    : pct >= 50 ? 'A solid effort. Compare your code with the model answers where you dropped marks.'
    : 'Keep practising — re-read the model answers, then try writing each program again.';
  el['go-eyebrow'].textContent = 'PRACTICAL CODING';
  el['go-label'].textContent = 'MARKS SELF-SCORED';
  el['go-score'].textContent = `${paperMarks} / ${paperTotal}`;
  el['go-msg'].textContent = `You wrote ${n} program${n === 1 ? '' : 's'} and self-marked ${paperMarks} of ${paperTotal} marks (${pct}%). ${band}`;
  el['go-restart-btn'].textContent = 'CODE AGAIN';
  el['go-restart-btn'].onclick = () => startPractical();
  el['go-modes-btn'].textContent = 'BACK TO ARCADE';
  el['go-modes-btn'].onclick = () => nav.toArcade();

  SFX.phaseComplete();
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

// ---- unit test results (passing gates the next unit) -------
function unitTestResults() {
  stopTimer();
  el['question-card'].style.display = 'none';
  hideVisual();
  el['next-btn'].classList.remove('show');

  const pct = testTotal > 0 ? Math.round(100 * testCorrect / testTotal) : 0;
  const rec = store.recordUnitTest(testUnitId, pct);   // also marks the unit passed/best
  const passed = rec.passed;
  el['go-eyebrow'].textContent = passed ? 'UNIT TEST PASSED' : 'UNIT TEST — NOT YET';
  el['go-label'].textContent = `SCORE · ${pct}%`;
  el['go-score'].textContent = `${testCorrect}/${testTotal}`;
  el['go-msg'].textContent = passed
    ? `You scored ${testCorrect}/${testTotal} (${pct}%). Unit complete — the next unit is now unlocked.`
    : `You scored ${testCorrect}/${testTotal} (${pct}%). You need 70% to pass — revise the topics and retake the test.`;
  el['go-restart-btn'].textContent = 'RETAKE TEST';
  el['go-restart-btn'].onclick = () => launchUnitTest(testUnitId);
  el['go-modes-btn'].textContent = 'CAMPAIGN MAP';
  el['go-modes-btn'].onclick = () => nav.toCampaign();

  if (passed) SFX.phaseComplete(); else SFX.gameOver();
  showScreen('gameover-screen');
}

// ---- mock exam results (cumulative, GCSE 1–9 graded) -------
function mockResults() {
  stopTimer();
  el['question-card'].style.display = 'none';
  hideVisual();
  el['next-btn'].classList.remove('show');

  const pct = testTotal > 0 ? Math.round(100 * testCorrect / testTotal) : 0;
  const grade = gcseGrade(pct);
  const rec = store.recordMock(currentMockId, pct);   // keeps best % + its grade
  const band = grade >= 7 ? 'Excellent — that is strong exam standard across these topics.'
    : grade >= 4 ? 'A solid pass. Target the units that tripped you up and resit.'
      : 'Keep going — revisit the weaker units, then resit the mock.';
  el['go-eyebrow'].textContent = `${currentMockName} · COMPLETE`;
  el['go-label'].textContent = `GRADE · ${pct}%`;
  el['go-score'].textContent = String(grade);
  el['go-msg'].textContent = `You scored ${testCorrect}/${testTotal} (${pct}%) — that is a grade ${grade}. ${band}`
    + (rec.best > pct ? ` Your best so far is grade ${rec.grade} (${rec.best}%).` : '');
  el['go-restart-btn'].textContent = 'RESIT MOCK';
  el['go-restart-btn'].onclick = () => launchMock(currentMockId);
  el['go-modes-btn'].textContent = 'CAMPAIGN MAP';
  el['go-modes-btn'].onclick = () => nav.toCampaign();

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
// 3-star crown row for the phase-complete screen (n = crowns earned, 0–3)
function crownStars(n) {
  let s = '';
  for (let i = 0; i < 3; i++) s += `<span class="pc-star${i < n ? ' on' : ''}">★</span>`;
  return `<span class="pc-stars">${s}</span>`;
}
// "WHAT YOU'LL DO" callout — tells the player the task before the questions start
function taskCard(html) {
  return `<div class="pi-task"><div class="pi-task-badge">▶ WHAT YOU'LL DO</div><div class="pi-task-text">${html}</div></div>`;
}
// key-fact chips (each is a string, or { term, def })
function keyFactsBlock(facts) {
  const items = facts.map(f => typeof f === 'string'
    ? `<div class="pi-fact"><span class="pi-fact-def">${f}</span></div>`
    : `<div class="pi-fact"><span class="pi-fact-term">${f.term}</span><span class="pi-fact-def">${f.def}</span></div>`).join('');
  return section('KEY FACTS', `<div class="pi-facts">${items}</div>`);
}
// "WHY THIS MATTERS" — ties the abstract topic to something the student
// already cares about, so it isn't just "learn this for the exam".
// intro.realWorld is a string (HTML body) or { hook, body }.
function realWorldCard(rw) {
  if (typeof rw === 'string') rw = { body: rw };
  const hook = rw.hook ? `<div class="pi-why-hook">${rw.hook}</div>` : '';
  return `<div class="pi-why"><div class="pi-why-eyebrow">WHY THIS MATTERS</div>${hook}<div class="pi-why-body">${rw.body}</div></div>`;
}
// an educational video, embedded lazily — only the thumbnail loads until the
// player taps it (fast first paint, no autoplay, privacy-friendly nocookie host).
// intro.video = { id: '<youtube id>', title, by? }.
function videoBlock(v) {
  const by = v.by ? ` <span class="pi-video-by">· ${v.by}</span>` : '';
  const frame = `<div class="pi-video-frame" data-vid="${v.id}" role="button" tabindex="0" aria-label="Play video: ${v.title || ''}">`
    + `<img class="pi-video-thumb" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="" loading="lazy">`
    + `<span class="pi-video-play">▶</span></div>`;
  return section('WATCH', `<div class="pi-video">${frame}<div class="pi-video-cap">${v.title || 'Watch'}${by}</div></div>`);
}
// build the "FROM THE VIDEO" watch-check as a normal MC question from
// phase.intro.watchCheck (injected as the first question of a campaign run).
function watchCheckQuestion(phase) {
  const wc = phase.intro.watchCheck;
  return {
    type: 'MC', watchCheck: true,
    badge: 'FROM THE VIDEO', board: phase.boards.join(' · '),
    title: wc.title,
    desc: wc.desc || 'A quick check on the video you just watched.',
    options: wc.options, answer: wc.answer,
    diagram: wc.diagram,
    hints: wc.hints || ['Think back to the video on the learn screen.', 'It was explained in the WATCH clip.'],
    explain: wc.explain,
  };
}
// shared place-value strip (binary + two's complement). cells = [{ pv, bit }]
function pvDiagram(caption, cells, total) {
  const cols = cells.map((c, i) =>
    `<div class="pidb-col${c.bit ? ' on' : ''}" style="--c:${i}"><span class="pidb-pv">${c.pv}</span><span class="pidb-bit">${c.bit}</span></div>`).join('');
  const sum = cells.map(c => c.bit ? `<span class="pidb-term">${c.pv}</span>` : `<span class="pidb-term muted">0</span>`).join('<span class="pidb-op">+</span>');
  return `<div class="pi-diag-binary"><div class="pidb-caption">${caption}</div><div class="pidb-grid">${cols}</div>`
    + `<div class="pidb-sum">${sum}<span class="pidb-eq">=</span><span class="pidb-total">${total}</span></div></div>`;
}

// topic diagrams for the learn screen, keyed by intro.visual
const DIAGRAMS = {
  // binary -> denary: 1101 = 13 (MSB-left)
  'binary-place-value': pvDiagram('BINARY → DENARY · place values, left to right',
    [{ pv: '8', bit: 1 }, { pv: '4', bit: 1 }, { pv: '2', bit: 0 }, { pv: '1', bit: 1 }], '13'),

  // two's complement: 11111011 = -5 (MSB worth -128)
  'twos-place-value': pvDiagram("TWO'S COMPLEMENT · the leftmost bit is NEGATIVE",
    [{ pv: '-128', bit: 1 }, { pv: '64', bit: 1 }, { pv: '32', bit: 1 }, { pv: '16', bit: 1 }, { pv: '8', bit: 1 }, { pv: '4', bit: 0 }, { pv: '2', bit: 1 }, { pv: '1', bit: 1 }], '-5'),

  // hex -> denary: 2F = 47
  'hex-place-value': `<div class="pi-diag-binary"><div class="pidb-caption">HEX → DENARY · A=10 … F=15</div>`
    + `<div class="pidb-grid"><div class="pidb-col on"><span class="pidb-pv">×16</span><span class="pidb-bit">2</span></div>`
    + `<div class="pidb-col on"><span class="pidb-pv">×1</span><span class="pidb-bit">F</span></div></div>`
    + `<div class="pidb-sum"><span class="pidb-term">2×16</span><span class="pidb-op">+</span><span class="pidb-term">15×1</span><span class="pidb-eq">=</span><span class="pidb-total">47</span></div></div>`,

  // RGB channel breakdown of a hex colour
  'hex-rgb': `<div class="pi-diag-rgb"><div class="pidb-caption">#FF8800 · split into Red · Green · Blue</div>`
    + `<div class="pirgb-body"><div class="pirgb-swatch" style="background:#FF8800"></div><div class="pirgb-channels">`
    + `<div class="pirgb-row"><span class="pirgb-lbl r">R</span><span class="pirgb-hex">FF</span><span class="pirgb-val">= 255</span></div>`
    + `<div class="pirgb-row"><span class="pirgb-lbl g">G</span><span class="pirgb-hex">88</span><span class="pirgb-val">= 136</span></div>`
    + `<div class="pirgb-row"><span class="pirgb-lbl b">B</span><span class="pirgb-hex">00</span><span class="pirgb-val">= 0</span></div>`
    + `</div></div></div>`,

  // AND / OR / XOR truth table
  'logic-truth-table': (() => {
    const rows = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) =>
      `<tr><td>${a}</td><td>${b}</td><td class="${a && b ? 'on' : ''}">${a && b ? 1 : 0}</td>`
      + `<td class="${a || b ? 'on' : ''}">${a || b ? 1 : 0}</td><td class="${a ^ b ? 'on' : ''}">${a ^ b ? 1 : 0}</td></tr>`).join('');
    return `<div class="pi-diag-truth"><div class="pidb-caption">GATE OUTPUTS · apply the rule to the inputs</div>`
      + `<table class="pitt"><thead><tr><th>A</th><th>B</th><th>AND</th><th>OR</th><th>XOR</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  })(),

  // Caesar shift strip + worked word
  'caesar-shift': (() => {
    const pairs = [['A', 'D'], ['B', 'E'], ['C', 'F'], ['…', '…'], ['X', 'A'], ['Y', 'B'], ['Z', 'C']]
      .map(([p, c]) => `<span class="picae-pair"><b>${p}</b><span class="picae-arr">→</span><b>${c}</b></span>`).join('');
    return `<div class="pi-diag-caesar"><div class="pidb-caption">CAESAR CIPHER · shift +3 (Z wraps to A)</div>`
      + `<div class="picae-map">${pairs}</div>`
      + `<div class="picae-eg">plaintext <b>CAT</b> <span class="picae-arr">→</span> cipher <b>FDW</b></div></div>`;
  })(),

  // packet structure (addressed-envelope analogy)
  'packet-structure': `<div class="pi-diag-packet"><div class="pidb-caption">A PACKET · like an addressed envelope</div>`
    + `<div class="pipk-row"><div class="pipk-seg head"><span class="pipk-lbl">HEADER</span><span class="pipk-txt">source IP · destination IP</span></div>`
    + `<div class="pipk-seg"><span class="pipk-lbl">PAYLOAD</span><span class="pipk-txt">the actual data</span></div>`
    + `<div class="pipk-seg"><span class="pipk-lbl">TRAILER</span><span class="pipk-txt">error check</span></div></div></div>`,

  // one bubble-sort comparison + swap
  'bubble-step': `<div class="pi-diag-bubble"><div class="pidb-caption">BUBBLE SORT · compare adjacent, swap if the LEFT is bigger</div>`
    + `<div class="pibub-row"><span class="pibub-tile cmp">5</span><span class="pibub-tile cmp">3</span><span class="pibub-tile">8</span><span class="pibub-tile">1</span><span class="pibub-note">5 &gt; 3 → SWAP</span></div>`
    + `<div class="pibub-row"><span class="pibub-tile moved">3</span><span class="pibub-tile moved">5</span><span class="pibub-tile">8</span><span class="pibub-tile">1</span><span class="pibub-note">now compare 5 &amp; 8 …</span></div></div>`,

  // fetch-decode-execute loop
  'fde-cycle': `<div class="pi-diag-fde"><div class="pidb-caption">THE FETCH–DECODE–EXECUTE CYCLE · repeats forever</div>`
    + `<div class="pifde-row"><span class="pifde-stage">FETCH</span><span class="pifde-arr">→</span><span class="pifde-stage">DECODE</span>`
    + `<span class="pifde-arr">→</span><span class="pifde-stage">EXECUTE</span><span class="pifde-arr">↺</span></div></div>`,

  // image file-size formula
  'file-size': `<div class="pi-diag-filesize"><div class="pidb-caption">IMAGE FILE SIZE</div>`
    + `<div class="pifs-formula"><span class="pifs-var">WIDTH</span><span class="pifs-op">×</span><span class="pifs-var">HEIGHT</span>`
    + `<span class="pifs-op">×</span><span class="pifs-var">COLOUR DEPTH</span><span class="pifs-op">=</span><span class="pifs-out">SIZE (bits)</span></div>`
    + `<div class="pifs-eg">e.g. 10 × 8 × 4 = <b>320 bits</b> = 320 ÷ 8 = <b>40 bytes</b></div></div>`,
};
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
