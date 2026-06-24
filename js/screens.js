// ============================================================
// screens.js — the navigation layer above the question engine.
//
// Renders and wires the three "home" screens:
//   - main menu   (Continue / Campaign / Revision)
//   - campaign map (linear circuit-trace of the 10 phases)
//   - revision hub (spaced-review banner + sorted topic cards)
//
// It reads progress from storage.js and launches phases into the
// existing engine flow (campaign / revision / spaced-review context).
// It does NOT fork the engine or the question flow.
// ============================================================

import { PHASES } from './content.js';
import { UNITS, gcseGrade } from './units.js';
import { generateQuestion } from './generators.js';
import * as store from './storage.js';
import * as engine from './engine.js';
import { SFX } from './sound.js';

const PHASE_IDS = PHASES.map(p => p.id);
const PHASE_IDX_BY_ID = {};
PHASES.forEach((p, i) => { PHASE_IDX_BY_ID[p.id] = i; });
const idxOfId = id => PHASE_IDX_BY_ID[id];

function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function resetAccent() {
  document.documentElement.style.setProperty('--phase-color', '#2563EB');
  document.documentElement.style.setProperty('--phase-color-light', 'rgba(37,99,235,0.08)');
}

let dom = {};
export function initScreens() {
  dom = {
    menuActions: document.getElementById('menu-actions'),
    campTrace: document.getElementById('camp-trace'),
    campContinue: document.getElementById('camp-continue'),
    revSpaced: document.getElementById('rev-spaced'),
    revGrid: document.getElementById('rev-grid'),
    arcadeModeList: document.getElementById('arcade-mode-list'),
    arcadeTopicGrid: document.getElementById('arcade-topic-grid'),
  };
  document.getElementById('camp-back').addEventListener('click', () => { SFX.uiClick(); showMainMenu(); });
  document.getElementById('rev-back').addEventListener('click', () => { SFX.uiClick(); showMainMenu(); });
  document.getElementById('arcade-back').addEventListener('click', () => { SFX.uiClick(); showMainMenu(); });
  document.getElementById('arcade-topics-back').addEventListener('click', () => { SFX.uiClick(); showArcadeModes(); });
  document.getElementById('qbank-back').addEventListener('click', () => { SFX.uiClick(); showMainMenu(); });
  document.getElementById('stats-back').addEventListener('click', () => { SFX.uiClick(); showMainMenu(); });
  document.getElementById('settings-back').addEventListener('click', () => { SFX.uiClick(); settingsBack(); });
  // the engine calls these when a session ends
  engine.setNavHandlers({ toMenu: showMainMenu, toCampaign: showCampaign, toRevision: showRevision, toArcade: showArcadeModes });
}

// ============================================================
// main menu
// ============================================================
export function showMainMenu() {
  resetAccent();
  const cs = store.getCampaignState(UNITS);
  const cur = cs.current;
  const anyCleared = PHASE_IDS.some(id => store.getTopicStats(id).cleared);
  let contLabel, contSub, contAction;
  if (!cur) {
    contLabel = 'CAMPAIGN COMPLETE'; contSub = 'Replay any unit, or revise'; contAction = showCampaign;
  } else if (cur.kind === 'lesson') {
    const phase = PHASES[idxOfId(cur.phaseId)];
    contLabel = anyCleared ? 'CONTINUE LEARNING' : 'START LEARNING';
    contSub = phase ? `Up next: ${phase.name}` : 'Begin the campaign';
    contAction = () => engine.launchPhase(idxOfId(cur.phaseId), 'campaign', true);
  } else {
    contLabel = 'CONTINUE LEARNING'; contSub = 'A unit test is waiting'; contAction = showCampaign;
  }

  dom.menuActions.innerHTML = '';
  dom.menuActions.append(
    menuBtn(contLabel, contSub, contAction, 'primary'),
    menuBtn('CAMPAIGN', 'Your journey through every GCSE topic', showCampaign),
    menuBtn('REVISION HUB', 'Jump to any topic · spaced review of your misses', showRevision),
    menuBtn('ARCADE', 'Timed Exam Rush — beat the clock', showArcadeModes),
    menuBtn('QUESTION BANK', 'Browse every question & answer — review mode', showQuestionBank),
    menuBtn('STATS', 'Your progress, mastery and estimated grade', showStats),
    menuBtn('SETTINGS', 'Theme, sound, exam board and progress', showSettings),
  );
  engine.showScreen('main-menu');
}
function menuBtn(title, sub, onClick, variant) {
  const b = h('button', 'menu-btn' + (variant ? ' menu-btn-' + variant : ''));
  b.innerHTML = `<span class="menu-btn-title">${title}</span><span class="menu-btn-sub">${sub}</span>`;
  if (variant === 'disabled') b.disabled = true;
  else if (onClick) b.addEventListener('click', () => { SFX.uiClick(); onClick(); });
  return b;
}

// ============================================================
// campaign — the winding circuit-bus path (units -> lessons ->
// unit test, with cumulative mock checkpoints). Reads the fully
// annotated state from storage and renders it; it does not own the
// unlock logic. Lessons launch into the existing campaign flow;
// unit tests / mocks call engine entry points added in R3 / R4
// (guarded so this screen works before those land).
// ============================================================
export function showCampaign() {
  resetAccent();
  const state = store.getCampaignState(UNITS);

  const path = h('div', 'cmp');
  path.appendChild(h('div', 'cmp-intro',
    'Follow the signal — clear each lesson to power up the next, then pass the unit test to unlock the unit after. Replay a cleared lesson flawlessly to earn all 3 ★.'));

  state.units.forEach(u => {
    path.appendChild(unitHeader(u));
    u.lessons.forEach((ln, i) => path.appendChild(lessonNode(u, ln, i)));
    path.appendChild(testNode(u));
    if (u.mock) path.appendChild(mockNode(u, u.mock));
  });

  dom.campTrace.innerHTML = '';
  dom.campTrace.appendChild(path);
  wireContinue(state);

  engine.showScreen('campaign-map');
  requestAnimationFrame(() => scrollToCurrent());
}

function unitHeader(u) {
  const cleared = u.lessons.filter(l => l.state === 'cleared').length;
  const totalStars = u.lessons.reduce((s, l) => s + (l.crown || 0), 0);
  const tag = u.state === 'complete' ? ' · COMPLETE' : u.state === 'locked' ? ' · LOCKED' : '';
  const wrap = h('div', `cmp-unit ${u.state}${u.state !== 'locked' ? ' reached' : ''}`);
  wrap.style.setProperty('--node-color', u.color);
  wrap.innerHTML = `
    <span class="cmp-bus"></span>
    <span class="cmp-unit-chip">
      <span class="cmp-unit-no">UNIT ${u.id}${tag}</span>
      <span class="cmp-unit-name">${u.name}</span>
      <span class="cmp-unit-blurb">${u.blurb || ''}</span>
      <span class="cmp-unit-prog">${cleared}/${u.lessons.length} LESSONS${totalStars ? ' · ' + totalStars + ' ★' : ''}</span>
    </span>`;
  return wrap;
}

function starBar(crown) {
  let s = '';
  for (let i = 0; i < 3; i++) s += `<span class="cmp-star-${i < crown ? 'on' : 'off'}">★</span>`;
  return `<span class="cmp-stars">${s}</span>`;
}

function lessonNode(u, ln, i) {
  const phase = PHASES[idxOfId(ln.phaseId)];
  const side = i % 2 === 0 ? 'side-left' : 'side-right';
  const btn = h('button', `cmp-node cmp-lesson ${side} ${ln.state}${ln.current ? ' current' : ''}${ln.state !== 'locked' ? ' reached' : ''}`);
  btn.style.setProperty('--node-color', u.color);
  if (ln.current) btn.id = 'cmp-current';
  const dot = ln.state === 'cleared' ? '✓' : ln.state === 'locked' ? '🔒' : ln.current ? '▶' : String(i + 1);
  const clearedMeta = starBar(ln.crown) + (ln.crown >= 3
    ? '<span class="cmp-meta cmp-mastered">★ MASTERED</span>'
    : '<span class="cmp-meta cmp-replay">↻ REPLAY FOR ★★★</span>');
  const meta = ln.state === 'cleared' ? clearedMeta
    : ln.current ? '<span class="cmp-meta">▶ START</span>'
      : ln.state === 'unlocked' ? '<span class="cmp-meta">READY</span>'
        : '<span class="cmp-meta">LOCKED</span>';
  btn.innerHTML = `
    <span class="cmp-bus"></span>
    <span class="cmp-branch"></span>
    <span class="cmp-joint"></span>
    <span class="cmp-dot">${dot}</span>
    <span class="cmp-label">
      <span class="cmp-name">${phase ? phase.name : 'LESSON'}</span>
      ${meta}
    </span>`;
  btn.addEventListener('click', () => {
    if (ln.state === 'locked') { nudge(btn); return; }
    SFX.uiClick();
    // first play teaches (show intro); replaying a cleared lesson skips it
    engine.launchPhase(idxOfId(ln.phaseId), 'campaign', ln.state === 'cleared');
  });
  return btn;
}

function testNode(u) {
  const t = u.test;
  const btn = h('button', `cmp-node cmp-test ${t.state}${t.current ? ' current' : ''}${t.state !== 'locked' ? ' reached' : ''}`);
  btn.style.setProperty('--node-color', u.color);
  if (t.current) btn.id = 'cmp-current';
  const badge = t.state === 'passed' ? '✓' : t.state === 'locked' ? '🔒' : '◆';
  const meta = t.state === 'passed' ? `PASSED · BEST ${t.best}%`
    : t.state === 'unlocked' ? 'READY ▶'
      : 'CLEAR EVERY LESSON FIRST';
  btn.innerHTML = `
    <span class="cmp-bus"></span>
    <span class="cmp-badge"><span>${badge}</span></span>
    <span class="cmp-label">
      <span class="cmp-name">UNIT TEST</span>
      <span class="cmp-meta">${meta}</span>
    </span>`;
  btn.addEventListener('click', () => {
    if (t.state === 'locked') { nudge(btn); return; }
    SFX.uiClick();
    if (engine.launchUnitTest) engine.launchUnitTest(u.id);
    else flash('Unit tests arrive in the next update.');
  });
  return btn;
}

function mockNode(u, m) {
  const btn = h('button', `cmp-node cmp-mock ${m.state}${m.state !== 'locked' ? ' reached' : ''}`);
  btn.style.setProperty('--node-color', u.color);
  const range = m.covers.length > 1 ? `UNITS ${m.covers[0]}–${m.covers[m.covers.length - 1]}` : `UNIT ${m.covers[0]}`;
  const sub = m.state === 'passed' ? `GRADE ${m.grade} · BEST ${m.best}% · ${range}`
    : m.state === 'unlocked' ? `${range} · ▶ SIT THE PAPER`
      : `${range} · COMPLETE THE UNITS FIRST`;
  btn.innerHTML = `
    <span class="cmp-bus"></span>
    <span class="cmp-mockbar">
      <span class="cmp-mock-name">◆ ${m.name}</span>
      <span class="cmp-mock-sub">${sub}</span>
    </span>`;
  btn.addEventListener('click', () => {
    if (m.state === 'locked') { nudge(btn); return; }
    SFX.uiClick();
    if (engine.launchMock) engine.launchMock(m.id);
    else flash('Mock exams arrive in an upcoming update.');
  });
  return btn;
}

function wireContinue(state) {
  const btn = dom.campContinue;
  const cur = state.current;
  if (!cur) { btn.textContent = 'ALL CLEAR ✓'; btn.onclick = () => SFX.uiClick(); return; }
  btn.textContent = 'CONTINUE →';
  btn.onclick = () => {
    SFX.uiClick();
    if (cur.kind === 'lesson') engine.launchPhase(idxOfId(cur.phaseId), 'campaign', true);
    else scrollToCurrent();
  };
}

function scrollToCurrent() {
  const node = document.getElementById('cmp-current');
  if (node) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// tapping a locked node: shake it. SFX.wrong gives the "denied" cue.
function nudge(el) {
  if (SFX.wrong) SFX.wrong();
  el.classList.remove('cmp-shake');
  void el.offsetWidth;            // reflow so the animation can re-trigger
  el.classList.add('cmp-shake');
}

// a small transient toast for flows not yet built (R3/R4)
let toastTimer;
function flash(msg) {
  let t = document.getElementById('cmp-toast');
  if (!t) { t = h('div', 'cmp-toast'); t.id = 'cmp-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ============================================================
// revision hub
// ============================================================
export function showRevision() {
  resetAccent();
  const due = store.getDueReviews();
  const dueCount = due.length;
  const scheduled = store.getScheduleSize();

  dom.revSpaced.innerHTML = '';
  const banner = h('button', `rev-spaced-banner${dueCount === 0 ? ' empty' : ''}`);
  const sub = dueCount > 0
    ? `${dueCount} question${dueCount === 1 ? '' : 's'} due for review now`
    : scheduled > 0
      ? `${scheduled} item${scheduled === 1 ? '' : 's'} scheduled — none due yet, check back later`
      : 'Nothing scheduled yet — your misses will collect here';
  banner.innerHTML = `
    <span class="rev-spaced-text">
      <span class="rev-spaced-main">SPACED REVIEW</span>
      <span class="rev-spaced-sub">${sub}</span>
    </span>
    <span class="rev-spaced-cta">${dueCount === 0 ? '—' : `${dueCount} DUE →`}</span>`;
  if (dueCount === 0) banner.disabled = true;
  else banner.addEventListener('click', () => {
    SFX.uiClick();
    const queue = due.map(m => ({ phaseIdx: idxOfId(m.phaseId), qIndex: m.qIndex }))
      .filter(e => e.phaseIdx != null);
    engine.startSpacedReview(queue);
  });
  dom.revSpaced.appendChild(banner);

  // sort: needs-review (lowest mastery first) -> started/on-track -> not started
  const rows = PHASES.map((p, i) => ({ phase: p, idx: i, st: store.getTopicStats(p.id) }));
  rows.sort((a, b) => rank(a.st) - rank(b.st) || sortKey(a.st) - sortKey(b.st));

  dom.revGrid.innerHTML = '';
  rows.forEach(({ phase, idx, st }) => {
    const card = h('button', 'rev-card');
    card.style.setProperty('--node-color', phase.color);
    const pct = st.started ? st.mastery : 0;
    const flag = !st.started ? '<span class="rev-flag rev-new">NOT STARTED</span>'
      : st.needsReview ? '<span class="rev-flag rev-review">NEEDS REVIEW</span>'
        : '<span class="rev-flag rev-ok">ON TRACK</span>';
    card.innerHTML = `
      <span class="rev-card-top">
        <span class="rev-card-name">${phase.name}</span>
        ${flag}
      </span>
      <span class="rev-bar"><span class="rev-bar-fill" style="width:${pct}%"></span></span>
      <span class="rev-card-foot">${st.started ? st.mastery + '% mastery' : 'Tap to begin revising'}</span>`;
    card.addEventListener('click', () => { SFX.uiClick(); engine.launchPhase(idx, 'revision'); });
    dom.revGrid.appendChild(card);
  });

  engine.showScreen('revision-hub');
}

// needs-review (0) -> started/on-track (1) -> not-started (2); lowest mastery first within group
function rank(st) { return !st.started ? 2 : st.needsReview ? 0 : 1; }
function sortKey(st) { return st.started ? st.mastery : 999; }

// ============================================================
// arcade — mode picker, then topic picker (currently: Timed/Exam Rush)
// ============================================================
export function showArcadeModes() {
  resetAccent();
  dom.arcadeModeList.innerHTML = '';
  dom.arcadeModeList.append(
    arcadeModeCard('EXAM RUSH', 'TIMED', 'Beat the clock — every question runs on a countdown. Run out of time and it is marked wrong.', () => showArcadeTopics('timed')),
    arcadeModeCard('SURVIVAL', 'SUDDEN DEATH', 'One wrong answer ends the run — chase your longest streak across every topic.', () => engine.startSurvival()),
    arcadeModeCard('PAST PAPER', 'EXAM STYLE', 'Sit a topic as an exam paper — write answers, reveal the mark scheme, self-mark, and get a grade.', () => showArcadeTopics('pastpaper')),
    arcadeModeCard('PRACTICAL CODING', 'WRITE CODE', 'Write real programs across the syllabus — reveal a model answer in your exam board’s notation and self-mark against the mark scheme.', () => engine.startPractical()),
  );
  engine.showScreen('arcade-modes');
}
function arcadeModeCard(title, tag, sub, onClick, disabled) {
  const b = h('button', 'arcade-mode' + (disabled ? ' disabled' : ''));
  b.innerHTML = `<span class="arcade-mode-tag">${tag}</span><span class="arcade-mode-title">${title}</span>`
    + `<span class="arcade-mode-sub">${sub}</span>${disabled ? '<span class="arcade-mode-soon">COMING SOON</span>' : '<span class="arcade-mode-go">SELECT →</span>'}`;
  if (disabled) b.disabled = true;
  else if (onClick) b.addEventListener('click', () => { SFX.uiClick(); onClick(); });
  return b;
}

export function showArcadeTopics(mode = 'timed') {
  resetAccent();
  const title = document.getElementById('arcade-topics-title');
  if (title) title.textContent = mode === 'pastpaper' ? 'PAST PAPER' : 'EXAM RUSH';
  dom.arcadeTopicGrid.innerHTML = '';
  PHASES.forEach((phase, i) => {
    if (mode === 'pastpaper' && !(phase.paper && phase.paper.length)) return;   // only topics with a paper
    const st = store.getTopicStats(phase.id);
    const meta = mode === 'pastpaper'
      ? `${phase.paper.length} questions · ${phase.paper.reduce((s, q) => s + (q.marks || 0), 0)} marks`
      : `${phase.questions.length} questions${st.started ? ' · ' + st.mastery + '% mastery' : ''}`;
    const card = h('button', 'arcade-topic');
    card.style.setProperty('--node-color', phase.color);
    card.innerHTML = `
      <span class="arcade-topic-num">${phase.id}</span>
      <span class="arcade-topic-info">
        <span class="arcade-topic-name">${phase.name}</span>
        <span class="arcade-topic-meta">${meta}</span>
      </span>
      <span class="arcade-topic-go">▶</span>`;
    card.addEventListener('click', () => { SFX.uiClick(); engine.launchPhase(i, mode); });
    dom.arcadeTopicGrid.appendChild(card);
  });
  engine.showScreen('arcade-topics');
}

// ============================================================
// question bank — a read-only review tool listing EVERY question and
// answer across all 10 topics (for content QA). Static questions render
// as-is; generated slots show fresh sample instances (rerollable); past
// papers show their mark schemes. Every question also exposes its raw
// data so nothing is hidden.
// ============================================================
const SAMPLES_PER_GEN = 3;

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function denaryFromBitsMSB(bits) {
  return bits.reduce((acc, b, i) => acc + (b ? Math.pow(2, bits.length - 1 - i) : 0), 0);
}

// the answer block, adapted to the question type
function answerHTML(q) {
  if (Array.isArray(q.options) && q.options.length) {
    const opts = q.options.map(o => {
      const correct = String(o) === String(q.answer);
      return `<li class="qb-opt${correct ? ' qb-opt-correct' : ''}">${correct ? '✓' : '·'} ${escapeHtml(o)}</li>`;
    }).join('');
    return `<ul class="qb-opts">${opts}</ul>`;
  }
  if (Array.isArray(q.answer)) {
    const bits = q.answer.join('');
    return `<div class="qb-ans">Answer (MSB-left): <strong>${escapeHtml(bits)}</strong> = <strong>${denaryFromBitsMSB(q.answer)}</strong> denary</div>`;
  }
  if (q.type === 'CIPHER') {
    return `<div class="qb-ans">Cipher <strong>${escapeHtml(q.text)}</strong> · shift <strong>${q.shift}</strong> → decodes to <strong>${escapeHtml(q.answer)}</strong></div>`;
  }
  if (q.type === 'TRACE') {
    return `<div class="qb-ans">Start array <strong>[${escapeHtml((q.array || []).join(', '))}]</strong> · trace one bubble-sort pass</div>`;
  }
  if (q.answer != null) {
    return `<div class="qb-ans">Answer: <strong>${escapeHtml(q.answer)}</strong></div>`;
  }
  return `<div class="qb-ans qb-ans-note">Interactive <strong>${escapeHtml(q.type || '?')}</strong> mini-game — see “Raw data” below for its configuration.</div>`;
}

function questionCard(q, label) {
  const card = h('div', 'qb-q');
  const hints = (q.hints || []).map(x => `<li>${escapeHtml(x)}</li>`).join('');
  const scheme = Array.isArray(q.markScheme)
    ? `<div class="qb-scheme"><span class="qb-sub">MARK SCHEME · ${q.marks || q.markScheme.length} mark${(q.marks || 1) === 1 ? '' : 's'}</span>`
      + `<ul class="qb-scheme-list">${q.markScheme.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div>`
    : '';
  card.innerHTML = `
    <div class="qb-q-head">
      <span class="qb-tag">${escapeHtml(label)}</span>
      <span class="qb-type">${escapeHtml(q.type || '?')}</span>
      ${q.board ? `<span class="qb-board">${escapeHtml(q.board)}</span>` : ''}
    </div>
    <div class="qb-title">${escapeHtml(q.title || '(no title)')}</div>
    ${q.desc ? `<div class="qb-desc">${escapeHtml(q.desc)}</div>` : ''}
    ${q.markScheme ? scheme : answerHTML(q)}
    ${hints ? `<details class="qb-extra"><summary>Hints (${q.hints.length})</summary><ul class="qb-hints">${hints}</ul></details>` : ''}
    ${q.explain ? `<details class="qb-extra"><summary>Explanation</summary><div class="qb-explain">${q.explain}</div></details>` : ''}
    <details class="qb-extra"><summary>Raw data</summary><pre class="qb-raw">${escapeHtml(JSON.stringify(q, null, 2))}</pre></details>`;
  return card;
}

// a generated slot: a header + N fresh sample instances, rerollable
function generatedBlock(genId, idxLabel) {
  const wrap = h('div', 'qb-gen');
  const head = h('div', 'qb-gen-head');
  head.innerHTML = `<span class="qb-gen-label">${escapeHtml(idxLabel)} · ⟳ GENERATED · ${escapeHtml(genId)}</span><button class="qb-reroll">↻ NEW SAMPLES</button>`;
  const samples = h('div', 'qb-gen-samples');
  const fill = () => {
    samples.innerHTML = '';
    for (let i = 0; i < SAMPLES_PER_GEN; i++) {
      let inst = null;
      try { inst = generateQuestion(genId); } catch (e) { inst = null; }
      samples.appendChild(inst ? questionCard(inst, `sample ${i + 1}`)
        : h('div', 'qb-q', `<div class="qb-ans qb-ans-note">generator “${escapeHtml(genId)}” threw an error</div>`));
    }
  };
  fill();
  head.querySelector('.qb-reroll').addEventListener('click', () => { SFX.uiClick(); fill(); });
  wrap.append(head, samples);
  return wrap;
}

export function showQuestionBank() {
  resetAccent();
  const content = document.getElementById('qbank-content');
  const intro = document.getElementById('qbank-intro');

  let genCount = 0, staticCount = 0, examCount = 0;
  PHASES.forEach(p => {
    (p.questions || []).forEach(s => s.gen ? genCount++ : staticCount++);
    examCount += (p.paper || []).length;
  });
  intro.innerHTML =
    `<div class="qb-summary">${PHASES.length} topics · ${genCount + staticCount} practice slots `
    + `(<strong>${genCount}</strong> generated, <strong>${staticCount}</strong> static) · <strong>${examCount}</strong> exam questions</div>`
    + `<div class="qb-note">Review tool — generated slots show fresh sample instances; hit “↻ NEW SAMPLES” to reroll. Every question exposes its full data under “Raw data”.</div>`;

  content.innerHTML = '';
  PHASES.forEach(phase => {
    const sec = h('section', 'qb-phase');
    sec.style.setProperty('--node-color', phase.color);
    sec.appendChild(h('div', 'qb-phase-head',
      `<span class="qb-phase-num">${phase.id}</span><span class="qb-phase-name">${escapeHtml(phase.name)}</span>`
      + `<span class="qb-phase-sub">${escapeHtml(phase.sub || '')}</span>`));

    const practice = h('div', 'qb-group');
    practice.appendChild(h('div', 'qb-group-label', 'PRACTICE QUESTIONS'));
    (phase.questions || []).forEach((slot, qi) => {
      practice.appendChild(slot.gen ? generatedBlock(slot.gen, `Q${qi + 1}`) : questionCard(slot, `Q${qi + 1}`));
    });
    sec.appendChild(practice);

    if (phase.paper && phase.paper.length) {
      const marks = phase.paper.reduce((s, q) => s + (q.marks || 0), 0);
      const paper = h('div', 'qb-group');
      paper.appendChild(h('div', 'qb-group-label', `PAST PAPER · ${marks} marks`));
      phase.paper.forEach((q, qi) => paper.appendChild(questionCard(q, `P${qi + 1}`)));
      sec.appendChild(paper);
    }

    content.appendChild(sec);
  });

  const scroller = content.closest('.screen-scroll');
  if (scroller) scroller.scrollTop = 0;
  engine.showScreen('question-bank');
}

// ============================================================
// stats — a progress report: an estimated GCSE grade, headline counts,
// and mastery by unit/topic. Read-only; everything derives from storage.
// ============================================================
export function showStats() {
  resetAccent();
  const cs = store.getCampaignState(UNITS);
  const rows = PHASES.map(p => ({ phase: p, st: store.getTopicStats(p.id), crown: store.getCrown(p.id) }));

  const started = rows.filter(r => r.st.started);
  const startedCount = started.length;
  const clearedCount = rows.filter(r => r.st.cleared).length;
  const crownsEarned = rows.reduce((s, r) => s + r.crown, 0);
  const crownsMax = PHASES.length * 3;
  const overall = startedCount ? Math.round(started.reduce((s, r) => s + r.st.mastery, 0) / startedCount) : null;
  const grade = overall != null ? gcseGrade(overall) : null;
  const dueCount = store.getDueReviews().length;
  const scheduled = store.getScheduleSize();
  const unitsComplete = cs.units.filter(u => u.state === 'complete').length;

  const host = document.getElementById('stats-content');
  host.innerHTML = '';
  host.appendChild(gradeHero(grade, overall, startedCount));

  const tiles = h('div', 'stats-tiles');
  tiles.append(
    statTile('LESSONS CLEARED', String(clearedCount), `of ${PHASES.length}`),
    statTile('TOPICS STARTED', String(startedCount), `of ${PHASES.length}`),
    statTile('CROWNS', String(crownsEarned), `of ${crownsMax} ★`),
    statTile('UNITS COMPLETE', String(unitsComplete), `of ${cs.units.length}`),
    statTile('DUE TO REVIEW', String(dueCount), scheduled ? `${scheduled} scheduled` : 'none yet'),
  );
  host.appendChild(tiles);

  const sec = h('div', 'stats-section');
  sec.appendChild(h('div', 'stats-section-head', 'MASTERY BY TOPIC'));
  cs.units.forEach(u => {
    sec.appendChild(statsUnitRow(u));
    u.lessons.forEach(ln => sec.appendChild(statsTopicRow(ln)));
  });
  host.appendChild(sec);

  const scroller = host.closest('.screen-scroll');
  if (scroller) scroller.scrollTop = 0;
  engine.showScreen('stats');
}

function gradeHero(grade, overall, startedCount) {
  const wrap = h('div', 'stats-hero');
  if (grade == null) {
    wrap.classList.add('empty');
    wrap.innerHTML = `
      <span class="stats-hero-label">ESTIMATED GRADE</span>
      <span class="stats-grade">—</span>
      <span class="stats-hero-note">Answer a few questions and your estimated grade will appear here.</span>`;
    return wrap;
  }
  let scale = '';
  for (let g = 1; g <= 9; g++) scale += `<span class="stats-scale-seg${g === grade ? ' on' : ''}${g < grade ? ' filled' : ''}">${g}</span>`;
  wrap.innerHTML = `
    <span class="stats-hero-label">ESTIMATED GRADE</span>
    <span class="stats-grade">${grade}</span>
    <span class="stats-scale">${scale}</span>
    <span class="stats-hero-note">From <strong>${overall}%</strong> average mastery across the <strong>${startedCount}</strong> topic${startedCount === 1 ? '' : 's'} you've practised — a guide based on your recent recall, not a real grade boundary.</span>`;
  return wrap;
}

function statTile(label, value, sub) {
  return h('div', 'stats-tile',
    `<span class="stats-tile-val">${value}</span><span class="stats-tile-label">${label}</span><span class="stats-tile-sub">${sub}</span>`);
}

function statsUnitRow(u) {
  const cleared = u.lessons.filter(l => l.state === 'cleared').length;
  const test = u.test.state === 'passed' ? `test ✓ ${u.test.best}%`
    : u.test.state === 'unlocked' ? 'test ready' : 'test locked';
  const mock = (u.mock && u.mock.best != null) ? ` · mock grade ${u.mock.grade}` : '';
  const row = h('div', `stats-unit ${u.state}`);
  row.style.setProperty('--node-color', u.color);
  row.innerHTML = `
    <span class="stats-unit-dot"></span>
    <span class="stats-unit-name">UNIT ${u.id} · ${u.name}</span>
    <span class="stats-unit-meta">${cleared}/${u.lessons.length} cleared · ${test}${mock}</span>`;
  return row;
}

function statsTopicRow(ln) {
  const phase = PHASES[idxOfId(ln.phaseId)];
  const pct = ln.started ? ln.mastery : 0;
  const row = h('div', 'stats-topic' + (ln.started ? '' : ' new'));
  row.style.setProperty('--node-color', phase ? phase.color : '#2563EB');
  row.innerHTML = `
    <span class="stats-topic-name">${phase ? phase.name : 'Lesson'}</span>
    ${starBar(ln.crown)}
    <span class="stats-bar"><span class="stats-bar-fill" style="width:${pct}%"></span></span>
    <span class="stats-topic-pct">${ln.started ? ln.mastery + '%' : 'not started'}</span>`;
  return row;
}

// ============================================================
// settings — theme, sound, exam board and a progress reset. The
// controls themselves are static DOM wired by main.js (which owns the
// theme/volume/board setters), kept in sync wherever they appear; this
// just shows the screen.
// ============================================================
// returnFn (optional): where the settings "back" button goes. When settings
// is opened mid-game (the HUD gear), this resumes the game instead of the menu.
let settingsReturn = null;
export function showSettings(returnFn) {
  settingsReturn = typeof returnFn === 'function' ? returnFn : null;
  if (!settingsReturn) resetAccent();
  const back = document.getElementById('settings-back');
  if (back) back.textContent = settingsReturn ? '← BACK' : '← MENU';
  engine.showScreen('settings');
}
export function settingsBack() {
  const r = settingsReturn;
  settingsReturn = null;
  if (r) r(); else showMainMenu();
}
