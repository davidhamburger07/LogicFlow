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
  // the engine calls these when a session ends
  engine.setNavHandlers({ toMenu: showMainMenu, toCampaign: showCampaign, toRevision: showRevision, toArcade: showArcadeModes });
}

// ============================================================
// main menu
// ============================================================
export function showMainMenu() {
  resetAccent();
  const frontier = store.getCampaignFrontier(PHASE_IDS);
  const anyCleared = PHASE_IDS.some(id => store.getTopicStats(id).cleared);
  const frontierIdx = frontier == null ? 0 : idxOfId(frontier);
  const contLabel = anyCleared ? `CONTINUE · PHASE ${frontierIdx + 1}` : 'START · PHASE 1';

  dom.menuActions.innerHTML = '';
  dom.menuActions.append(
    menuBtn(contLabel, 'Resume the campaign where you left off', () => engine.launchPhase(frontierIdx, 'campaign', true), 'primary'),
    menuBtn('CAMPAIGN', 'The linear journey through all 10 topics', showCampaign),
    menuBtn('REVISION HUB', 'Jump to any topic · spaced review of your misses', showRevision),
    menuBtn('ARCADE', 'Timed Exam Rush — beat the clock', showArcadeModes),
    menuBtn('QUESTION BANK', 'Browse every question & answer — review mode', showQuestionBank),
    menuBtn('SETTINGS', 'Coming soon', null, 'disabled'),
    menuBtn('STATS', 'Coming soon', null, 'disabled'),
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
// campaign map (linear circuit trace)
// ============================================================
export function showCampaign() {
  resetAccent();
  const frontier = store.getCampaignFrontier(PHASE_IDS);
  const frontierIdx = frontier == null ? PHASES.length : idxOfId(frontier);

  dom.campTrace.innerHTML = '';
  PHASES.forEach((phase, i) => {
    const st = store.getTopicStats(phase.id);
    const state = st.cleared ? 'cleared' : (phase.id === frontier ? 'current' : 'ahead');
    const reached = i <= frontierIdx;          // the trace is lit up to the frontier
    const node = h('button', `camp-node camp-${state}${reached ? ' reached' : ''}`);
    node.style.setProperty('--node-color', phase.color);
    const status = st.cleared ? `CLEARED · ${st.mastery}% MASTERY`
      : state === 'current' ? 'YOU ARE HERE'
        : st.started ? `${st.mastery}% MASTERY` : 'NOT STARTED';
    node.innerHTML = `
      <span class="camp-rail"></span>
      <span class="camp-dot">${st.cleared ? '✓' : phase.id}</span>
      <span class="camp-info">
        <span class="camp-name">PHASE ${phase.id} · ${phase.name}</span>
        <span class="camp-status">${status}</span>
      </span>`;
    node.addEventListener('click', () => { SFX.uiClick(); engine.launchPhase(i, 'campaign'); });
    dom.campTrace.appendChild(node);
  });

  const contIdx = frontier == null ? 0 : idxOfId(frontier);
  dom.campContinue.textContent = frontier == null ? 'REPLAY · PHASE 1' : `CONTINUE · PHASE ${contIdx + 1}`;
  dom.campContinue.onclick = () => { SFX.uiClick(); engine.launchPhase(contIdx, 'campaign', true); };

  engine.showScreen('campaign-map');
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
