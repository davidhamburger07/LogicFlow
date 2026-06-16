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
  const misses = store.getMisses();
  const due = misses.length;

  dom.revSpaced.innerHTML = '';
  const banner = h('button', `rev-spaced-banner${due === 0 ? ' empty' : ''}`);
  banner.innerHTML = `
    <span class="rev-spaced-text">
      <span class="rev-spaced-main">SPACED REVIEW</span>
      <span class="rev-spaced-sub">${due === 0
        ? 'Nothing due — your misses will collect here'
        : `${due} question${due === 1 ? '' : 's'} to revisit`}</span>
    </span>
    <span class="rev-spaced-cta">${due === 0 ? '—' : `${due} DUE →`}</span>`;
  if (due === 0) banner.disabled = true;
  else banner.addEventListener('click', () => {
    SFX.uiClick();
    const queue = misses.map(m => ({ phaseIdx: idxOfId(m.phaseId), qIndex: m.qIndex }))
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
    arcadeModeCard('EXAM RUSH', 'TIMED', 'Beat the clock — every question runs on a countdown. Run out of time and it is marked wrong.', () => showArcadeTopics()),
    arcadeModeCard('SURVIVAL', 'SUDDEN DEATH', 'One wrong answer ends the run — chase your longest streak.', null, true),
    arcadeModeCard('PAST PAPER', 'EXAM STYLE', 'Exam-worded questions with mark-scheme feedback.', null, true),
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

export function showArcadeTopics() {
  resetAccent();
  dom.arcadeTopicGrid.innerHTML = '';
  PHASES.forEach((phase, i) => {
    const st = store.getTopicStats(phase.id);
    const card = h('button', 'arcade-topic');
    card.style.setProperty('--node-color', phase.color);
    card.innerHTML = `
      <span class="arcade-topic-num">${phase.id}</span>
      <span class="arcade-topic-info">
        <span class="arcade-topic-name">${phase.name}</span>
        <span class="arcade-topic-meta">${phase.questions.length} questions${st.started ? ' · ' + st.mastery + '% mastery' : ''}</span>
      </span>
      <span class="arcade-topic-go">▶</span>`;
    card.addEventListener('click', () => { SFX.uiClick(); engine.launchPhase(i, 'timed'); });
    dom.arcadeTopicGrid.appendChild(card);
  });
  engine.showScreen('arcade-topics');
}
