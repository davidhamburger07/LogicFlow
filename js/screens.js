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
import * as courses from './courses.js';
import { notationTableHtml } from './notation.js';

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
    coursesGrid: document.getElementById('courses-grid'),
    coursesIntro: document.getElementById('courses-intro'),
  };
  document.getElementById('camp-back').addEventListener('click', () => { SFX.uiClick(); showMainMenu(); });
  document.getElementById('rev-back').addEventListener('click', () => { SFX.uiClick(); showMainMenu(); });
  document.getElementById('arcade-back').addEventListener('click', () => { SFX.uiClick(); showMainMenu(); });
  document.getElementById('arcade-topics-back').addEventListener('click', () => { SFX.uiClick(); showArcadeModes(); });
  document.getElementById('qbank-back').addEventListener('click', () => { SFX.uiClick(); showMainMenu(); });
  document.getElementById('stats-back').addEventListener('click', () => { SFX.uiClick(); showMainMenu(); });
  document.getElementById('courses-back').addEventListener('click', () => { SFX.uiClick(); showMainMenu(); });
  wireAuth();
  document.getElementById('settings-back').addEventListener('click', () => { SFX.uiClick(); settingsBack(); });
  // how-to-play tutorial nav
  document.getElementById('tut-next').addEventListener('click', () => { SFX.uiClick(); tutNext(); });
  document.getElementById('tut-back').addEventListener('click', () => { SFX.uiClick(); tutBack(); });
  document.getElementById('tut-skip').addEventListener('click', () => { SFX.uiClick(); tutFinish(); });
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
    menuBtn('COURSES', 'Computer Science — with every GCSE subject coming soon', showCourses),
    menuBtn('CAMPAIGN', 'Your journey through every GCSE topic', showCampaign),
    menuBtn('REVISION HUB', 'Jump to any topic · spaced review of your misses', showRevision),
    menuBtn('ARCADE', 'Timed Exam Rush — beat the clock', showArcadeModes),
    menuBtn('QUESTION BANK', 'Browse every question & answer — review mode', showQuestionBank),
    menuBtn('STATS', 'Your progress, mastery and estimated grade', showStats),
    menuBtn('HOW TO PLAY', 'New here? A 60-second guide to the game', () => showTutorial(showMainMenu)),
    menuBtn('SETTINGS', 'Theme, sound, exam board and progress', showSettings),
  );
  if (authApi && authApi.sendFeedback) {
    const fb = h('button', 'menu-feedback', '💬 FEEDBACK — spotted a problem or got an idea?');
    fb.addEventListener('click', () => { SFX.uiClick(); openFeedback('menu'); });
    dom.menuActions.append(fb);
  }
  engine.showScreen('main-menu');
}

// ============================================================
// feedback — a straight line from the player to the developer. Standalone
// site only (inserts into the Supabase feedback table; RLS is insert-only).
// ============================================================
let feedbackFrom = 'menu';
export function openFeedback(from) {
  if (!authApi || !authApi.sendFeedback) return;
  feedbackFrom = from || 'menu';
  fbMsg('');
  document.getElementById('fb-message').value = '';
  document.getElementById('fb-send').disabled = false;
  document.getElementById('feedback-modal').classList.add('show');
  setTimeout(() => { try { document.getElementById('fb-message').focus(); } catch (e) {} }, 50);
}
function closeFeedback() { document.getElementById('feedback-modal').classList.remove('show'); }
function fbMsg(text, kind) { const m = document.getElementById('fb-msg'); m.textContent = text || ''; m.className = 'auth-msg' + (kind ? ' auth-msg-' + kind : ''); }
async function fbSubmit() {
  const message = document.getElementById('fb-message').value.trim();
  const email = document.getElementById('fb-email').value.trim();
  if (message.length < 4) { fbMsg('Tell us a little more first.', 'err'); return; }
  const btn = document.getElementById('fb-send'); btn.disabled = true; fbMsg('Sending…');
  const res = await authApi.sendFeedback(message, email, { from: feedbackFrom, board: store.getBoard() });
  btn.disabled = false;
  if (!res || !res.ok) { fbMsg((res && res.error) || 'Could not send right now — please try again.', 'err'); return; }
  fbMsg('Sent — thank you!', 'ok');
  SFX.correct();
  setTimeout(closeFeedback, 1200);
}
export function initFeedback() {
  document.getElementById('fb-send').addEventListener('click', fbSubmit);
  document.getElementById('fb-cancel').addEventListener('click', () => { SFX.uiClick(); closeFeedback(); });
}

// ============================================================
// board differences — what actually changes between exam boards.
// Generated at runtime from the SAME flags the game plays by
// (onlyBoards / reqBoards / specGate / notation / unit convention),
// so this screen can never drift out of sync with the content.
// ============================================================
const BOARD_LIST = ['AQA', 'OCR', 'Eduqas', 'WJEC', 'Edexcel'];
const CODE_NOTATION = {
  AQA: 'AQA pseudo-code (← / OUTPUT)', OCR: 'OCR Exam Reference Language',
  Eduqas: 'Python', WJEC: 'Python', Edexcel: 'Python',
};
const ALL_GATES = ['AND', 'OR', 'NOT', 'XOR'];
const cleanPart = p => (p || '').replace(/^PART \d+ · /, '');

// walk the content once and group every board-gated item
function collectBoardDiff() {
  const onlyMap = new Map();   // phase+boards -> { phases, label, boards }
  const reqMap = new Map();    // enrichLabel  -> { label, phase, boards }
  PHASES.forEach(p => {
    ((p.intro && p.intro.pages) || []).forEach(pg => {
      if (pg.onlyBoards) {
        const key = p.id + '|' + pg.onlyBoards.join(',') + '|' + cleanPart(pg.part);
        if (!onlyMap.has(key)) onlyMap.set(key, { label: `${p.name} · ${cleanPart(pg.part)}`, boards: pg.onlyBoards });
      }
      const q = pg.q;
      if (q && q.reqBoards) {
        const key = q.enrichLabel || q.title;
        if (!reqMap.has(key)) reqMap.set(key, { label: q.enrichLabel || q.title, phase: p.name, boards: q.reqBoards });
      }
    });
    (p.questions || []).forEach(q => {
      if (q.reqBoards) {
        const key = q.enrichLabel || q.title;
        if (!reqMap.has(key)) reqMap.set(key, { label: q.enrichLabel || q.title, phase: p.name, boards: q.reqBoards });
      }
    });
  });
  return { only: [...onlyMap.values()], req: [...reqMap.values()] };
}

function bdSection(title, inner) { return `<div class="bd-section"><div class="bd-title">${title}</div>${inner}</div>`; }
function bdList(items) { return `<ul class="bd-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`; }

function renderBoardDiff() {
  const b = store.getBoard();
  const { only, req } = collectBoardDiff();
  const gates = ALL_GATES.filter(g => store.boardRequiresGate(g, b));
  const extra = req.filter(r => r.boards.includes(b));
  const skippable = req.filter(r => !r.boards.includes(b));
  const shown = only.filter(o => o.boards.includes(b));
  const hidden = only.filter(o => !o.boards.includes(b));

  let out = `<div class="bd-note">One thing never changes: <strong>the definitions are identical on every board</strong>. `
    + `What changes is <strong>coverage</strong> (what you must know) and <strong>notation</strong> (how code and logic are written).</div>`;

  out += bdSection(`YOUR SPEC AT A GLANCE · ${b}`, bdList([
    `<strong>Code notation</strong> — ${CODE_NOTATION[b]}. Every programming question renders in it.`,
    `<strong>Logic gates</strong> — ${gates.join(', ')}${gates.includes('XOR') ? '' : ' (XOR is not on your spec — XOR content shows as optional)'}.`,
    `<strong>Data units</strong> — ${b === 'WJEC' ? '1 kB = 1,024 bytes (the binary convention)' : '1 kB = 1,000 bytes (the decimal convention)'}.`,
  ]) + notationTableHtml(b));

  if (extra.length) out += bdSection('EXTRA ON YOUR SPEC — YOU MUST KNOW THESE', bdList(extra.map(r => `<strong>${r.label}</strong> <span class="bd-dim">(${r.phase})</span>`)));
  if (skippable.length) out += bdSection('NOT ON YOUR SPEC — SHOWN AS OPTIONAL, WITH A SKIP', bdList(skippable.map(r => `<strong>${r.label}</strong> <span class="bd-dim">(${r.phase} · required for ${r.boards.join(', ')})</span>`)));
  if (shown.length) out += bdSection('LESSON CONTENT INCLUDED FOR YOUR BOARD', bdList(shown.map(o => `<strong>${o.label}</strong>`)));
  if (hidden.length) out += bdSection('LESSON CONTENT HIDDEN FOR YOUR BOARD', bdList(hidden.map(o => `<strong>${o.label}</strong> <span class="bd-dim">(${o.boards.join(', ')} only)</span>`)));

  // the full five-board comparison, generated from the same data
  const rows = [
    ['Code notation', ...BOARD_LIST.map(x => CODE_NOTATION[x])],
    ['Boolean shorthand', ...BOARD_LIST.map(x => store.getGateNotation(x).label)],
    ['Logic gates', ...BOARD_LIST.map(x => ALL_GATES.filter(g => store.boardRequiresGate(g, x)).join(' '))],
    ['1 kB equals', ...BOARD_LIST.map(x => x === 'WJEC' ? '1,024 B' : '1,000 B')],
    ...only.map(o => [o.label, ...BOARD_LIST.map(x => o.boards.includes(x) ? '✓' : '—')]),
    ...req.map(r => [r.label, ...BOARD_LIST.map(x => r.boards.includes(x) ? 'required' : 'optional')]),
  ];
  out += bdSection('EVERY BOARD, SIDE BY SIDE',
    `<div class="bd-table-wrap"><table class="bd-table"><thead><tr><th></th>${BOARD_LIST.map(x => `<th${x === b ? ' class="bd-you"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>`
    + rows.map(r => `<tr><th>${r[0]}</th>${r.slice(1).map((c, i) => `<td${BOARD_LIST[i] === b ? ' class="bd-you"' : ''}>${c}</td>`).join('')}</tr>`).join('')
    + `</tbody></table></div>`);

  document.getElementById('board-diff-content').innerHTML = out;
  document.querySelectorAll('#board-diff-boards .board-opt').forEach(btn => btn.classList.toggle('active', btn.dataset.board === b));
}

let boardDiffReturn = null;
export function showBoardDiff(returnFn) {
  resetAccent();
  boardDiffReturn = returnFn || showMainMenu;
  renderBoardDiff();
  document.getElementById('board-diff-back').onclick = () => { SFX.uiClick(); boardDiffReturn(); };
  engine.showScreen('board-diff');
}
// re-render when the board is switched from this screen (main.js sets the board first)
export function initBoardDiff() {
  document.getElementById('board-diff-boards').addEventListener('click', e => {
    if (e.target.closest('.board-opt')) setTimeout(renderBoardDiff, 0);
  });
}

// ============================================================
// courses — pick your GCSE subject. Computer Science is built and free; every
// other subject appears here so players see what's coming. Real unlock/payment
// is server-side (Supabase + Stripe) on the standalone site; this screen just
// reflects entitlement state via courses.js.
// ============================================================
export function showCourses() {
  resetAccent();
  dom.coursesIntro.innerHTML =
    '<div class="courses-lead">Pick your subject.</div>'
    + '<div class="courses-sub"><strong>Computer Science</strong> is ready to play now. Every other GCSE subject is on the way — you\'ll be able to add one free and unlock more later.</div>';
  const bar = accountBar();   // standalone site only (when an auth backend is wired)
  if (bar) dom.coursesIntro.prepend(bar);

  dom.coursesGrid.innerHTML = '';
  const user = authApi && authApi.currentUser ? authApi.currentUser() : null;
  courses.COURSES.forEach(c => {
    const state = courses.courseState(c);   // 'play' | 'owned' | 'locked' | 'soon'
    const card = h('button', 'course-card course-' + state);
    card.type = 'button';
    let tag, action = null;
    if (state === 'play') { tag = '<span class="course-tag play">▶ PLAY</span>'; action = () => { courses.setActiveCourse(c.id); showCampaign(); }; }
    else if (state === 'owned') tag = '<span class="course-tag owned">✓ OWNED · building</span>';
    else if (state === 'soon') tag = '<span class="course-tag soon">🔒 SOON</span>';
    else {   // 'locked' = built but not owned (standalone site: claim free, buy, or sign in)
      if (!user) { tag = '<span class="course-tag locked">🔒 SIGN IN</span>'; action = () => openAuth(); }
      else if (!courses.freeTokenUsed()) { tag = '<span class="course-tag free">✦ GET FREE</span>'; action = async () => { await authApi.claimFreeCourse(c.id); refreshAfterAuth(); }; }
      else { tag = `<span class="course-tag locked">🔒 ${courses.UNLOCK_PRICE}</span>`; action = () => authApi.startCheckout(c.id); }
    }
    card.innerHTML = `<span class="course-icon">${c.icon}</span><span class="course-name">${c.name}</span>${tag}`;
    if (action) card.addEventListener('click', () => { SFX.uiClick(); action(); });
    else { card.disabled = true; card.classList.add('course-disabled'); }
    dom.coursesGrid.appendChild(card);
  });

  engine.showScreen('courses');
}

// ---- accounts (standalone site only; null on dev + the free CrazyGames build) ----
let authApi = null;
let authMode = 'in';
export function setAuthApi(api) { authApi = api; if (api && api.onAuth) api.onAuth(() => refreshAfterAuth()); }

// re-render the visible course/menu screens when the account state changes
export function refreshAfterAuth() {
  if (document.getElementById('courses').classList.contains('show')) showCourses();
  else if (document.getElementById('main-menu').classList.contains('show')) showMainMenu();
}

function accountBar() {
  if (!authApi) return null;
  const u = authApi.currentUser ? authApi.currentUser() : null;
  const bar = h('div', 'account-bar');
  const text = h('span', 'account-bar-text');
  const btn = h('button', 'account-btn');
  btn.type = 'button';
  if (u) {
    text.innerHTML = `Signed in as <strong>${escapeHtml(u.email)}</strong>${u.verified ? '' : ' · unverified (check your email)'}`;
    btn.classList.add('ghost'); btn.textContent = 'SIGN OUT';
    btn.addEventListener('click', async () => { SFX.uiClick(); await authApi.signOut(); refreshAfterAuth(); });
  } else {
    text.textContent = 'Sign in to save your progress across devices and unlock courses.';
    btn.textContent = 'SIGN IN';
    btn.addEventListener('click', () => { SFX.uiClick(); openAuth(); });
  }
  bar.append(text, btn);
  return bar;
}

function authMsg(text, kind) { const m = document.getElementById('auth-msg'); m.textContent = text || ''; m.className = 'auth-msg' + (kind ? ' auth-msg-' + kind : ''); }
function authSetMode(m) {
  authMode = m;
  document.getElementById('auth-tab-in').classList.toggle('on', m === 'in');
  document.getElementById('auth-tab-up').classList.toggle('on', m === 'up');
  document.getElementById('auth-title').textContent = m === 'in' ? 'SIGN IN' : 'CREATE ACCOUNT';
  document.getElementById('auth-submit').textContent = m === 'in' ? 'SIGN IN' : 'CREATE ACCOUNT';
  authMsg('');
}
export function openAuth() {
  authSetMode('in');
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-modal').classList.add('show');
  document.getElementById('auth-email').focus();
}
function closeAuth() { document.getElementById('auth-modal').classList.remove('show'); }
async function authSubmit() {
  if (!authApi) return;
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) { authMsg('Enter your email and password.', 'err'); return; }
  const btn = document.getElementById('auth-submit'); btn.disabled = true; authMsg('Working…');
  const res = authMode === 'in' ? await authApi.signIn(email, password) : await authApi.signUp(email, password);
  btn.disabled = false;
  if (!res || !res.ok) { authMsg((res && res.error) || 'Something went wrong.', 'err'); return; }
  if (authMode === 'up') { authSetMode('in'); authMsg('Account created — check your email to confirm, then sign in.', 'ok'); return; }
  closeAuth();   // signed in; onAuth re-renders
}
function wireAuth() {
  document.getElementById('auth-tab-in').addEventListener('click', () => { SFX.uiClick(); authSetMode('in'); });
  document.getElementById('auth-tab-up').addEventListener('click', () => { SFX.uiClick(); authSetMode('up'); });
  document.getElementById('auth-submit').addEventListener('click', () => { SFX.uiClick(); authSubmit(); });
  document.getElementById('auth-cancel').addEventListener('click', () => { SFX.uiClick(); closeAuth(); });
}

// ============================================================
// how-to-play tutorial (onboarding) — a short stepped walkthrough.
// Shown once on first launch (from boot) and re-openable from the menu.
// Self-contained: slide data + a render closure; no engine fork.
// ============================================================
const TUT_SLIDES = [
  { eyebrow: 'WELCOME', heading: 'LEARN GCSE COMP-SCI BY <em>DOING</em>',
    visual: '<div class="tut-logo">LOG<em>IC</em>FLOW</div>',
    body: 'LOGICFLOW turns the AQA, OCR, Eduqas, WJEC and Edexcel spec into something you <strong>play</strong>. Every topic teaches the method, then makes you use it — because doing beats reading. Here’s the quick tour.' },
  { eyebrow: 'FIRST, YOUR SPEC', heading: 'SET YOUR <em>EXAM BOARD</em>',
    visual: '<div class="tut-boards"><span class="tut-board on">AQA</span><span class="tut-board">OCR</span><span class="tut-board">Eduqas</span><span class="tut-board">WJEC</span><span class="tut-board">Edexcel</span></div>',
    body: 'Pick your board on the menu — <strong>AQA</strong>, <strong>OCR</strong>, <strong>Eduqas</strong>, <strong>WJEC</strong> or <strong>Edexcel</strong>. The lessons then switch to your board’s <strong>programming notation</strong> and cover the exact topics and logic gates it examines. Set it once and everything follows.' },
  { eyebrow: 'THE CAMPAIGN', heading: 'FOLLOW THE <em>SIGNAL</em>',
    visual: '<div class="tut-map"><span class="tut-node test">▶<small>TOPIC</small></span><span class="tut-wire"></span><span class="tut-node test">◆<small>UNIT TEST</small></span><span class="tut-wire"></span><span class="tut-node lock">🔒<small>NEXT</small></span></div>',
    body: 'Work along the circuit, unit by unit. Each <strong>topic</strong> is one continuous flow — it teaches the idea, walks an example, then hands you the questions. Clear a unit\'s topics to open its <strong>unit test</strong>, with <strong>mock checkpoints</strong> to tie it together — or jump straight to any topic you need.' },
  { eyebrow: 'INSIDE A LESSON', heading: 'TEACH, THEN <em>YOUR TURN</em>',
    visual: '<div class="tut-card-demo"><div class="tut-demo-pv"><b class="lit">8</b><b>4</b><b class="lit">2</b><b>1</b></div><div class="tut-demo-sum">8 + 2 = <span class="tut-demo-in">?</span></div></div>',
    body: 'A lesson explains the idea, walks through a worked example, then hands you a real question to try. The scaffolding <strong>fades</strong> as you go — guided at first, then all you.' },
  { eyebrow: 'THE INTERACTIONS', heading: 'BUILD IT, DON’T <em>PICK IT</em>',
    visual: '<div class="tut-mechanics">'
      + '<span class="tut-mech"><span class="tut-mech-ico">📦</span><small>ROUTE PACKETS</small></span>'
      + '<span class="tut-mech"><span class="tut-mech-ico">🎣</span><small>SPOT PHISHING</small></span>'
      + '<span class="tut-mech"><span class="tut-mech-ico">⚙️</span><small>WIRE THE CPU</small></span>'
      + '<span class="tut-mech"><span class="tut-mech-ico">🧠</span><small>MANAGE MEMORY</small></span>'
      + '<span class="tut-mech"><span class="tut-mech-ico">🔐</span><small>CRACK CIPHERS</small></span>'
      + '<span class="tut-mech"><span class="tut-mech-ico">🔀</span><small>TRACE SORTS</small></span></div>',
    body: 'Most questions make you <strong>produce</strong> the answer, not choose from A–D. You’ll route packets as the router, spot a phishing email, wire up the CPU, manage the computer’s memory, crack a cipher, trace a sort — a hand-built mini-game per topic. That effort is what makes it stick.' },
  { eyebrow: 'STUCK? TWO LIFELINES', heading: 'WORKING-OUT & <em>HINTS</em>',
    visual: '<div class="tut-tools"><span class="tut-tool">🧮<small>WORKING OUT</small></span><span class="tut-tool">💡<small>HINT</small></span></div>',
    body: 'On a calculation, open <strong>🧮 WORKING OUT</strong> for a scratch pad — place-value, hex, file-size — that helps you think but never answers for you. Stuck on the question itself? A <strong>💡 HINT</strong> narrows it down.' },
  { eyebrow: 'SCORING', heading: 'LIVES, STREAK & <em>STARS</em>',
    visual: '<div class="tut-score"><span class="tut-hearts">♥ ♥ ♥</span><span class="tut-streak">🔥 ×5</span><span class="tut-stars">★ ★ ★</span></div>',
    body: 'In the campaign you get <strong>3 lives</strong> — a wrong answer costs one. Chain correct answers for a <strong>streak 🔥</strong> and bonus points, and replay a cleared topic flawlessly to earn all <strong>★★★</strong>.' },
  { eyebrow: 'BEYOND THE CAMPAIGN', heading: 'ARCADE & <em>REVISION</em>',
    visual: '<div class="tut-modes"><span class="tut-mode">⏱ TIMED</span><span class="tut-mode">💀 SURVIVAL</span><span class="tut-mode">📝 PAST PAPER</span></div>',
    body: 'Want a challenge? <strong>ARCADE</strong> has Timed Exam Rush, Survival and real Past Papers. The <strong>REVISION HUB</strong> tracks what you get wrong and brings it back at the right moment, and the <strong>QUESTION BANK</strong> lets you browse every question. That spacing is what makes revision stick.' },
  { eyebrow: 'YOU’RE READY', heading: 'LET’S <em>POWER ON</em>',
    visual: '<div class="tut-logo small">LOG<em>IC</em>FLOW</div><div class="tut-ready">✓ READY</div>',
    body: 'That’s it. Start with <strong>Binary Basics</strong> and follow the signal. You can reopen this guide any time from <strong>HOW TO PLAY</strong> on the menu — good luck.' },
];
let tutPos = 0, tutReturn = null;
export function showTutorial(returnFn) {
  tutReturn = returnFn || showMainMenu;
  tutPos = 0;
  renderTut();
  engine.showScreen('tutorial');
}
function renderTut() {
  const s = TUT_SLIDES[tutPos];
  document.getElementById('tut-visual').innerHTML = s.visual || '';
  document.getElementById('tut-eyebrow').textContent = s.eyebrow || '';
  document.getElementById('tut-heading').innerHTML = s.heading || '';
  document.getElementById('tut-body').innerHTML = s.body || '';
  const stage = document.getElementById('tut-stage') || document.querySelector('#tutorial .tut-stage');
  if (stage) { stage.classList.remove('tut-in'); void stage.offsetWidth; stage.classList.add('tut-in'); }
  const dots = document.getElementById('tut-dots');
  dots.innerHTML = TUT_SLIDES.map((_, i) => `<span class="tut-dot${i === tutPos ? ' on' : (i < tutPos ? ' done' : '')}"></span>`).join('');
  const back = document.getElementById('tut-back');
  back.style.visibility = tutPos > 0 ? 'visible' : 'hidden';
  const next = document.getElementById('tut-next');
  const last = tutPos >= TUT_SLIDES.length - 1;
  next.textContent = last ? "LET'S GO →" : 'NEXT →';
  document.getElementById('tut-skip').style.visibility = last ? 'hidden' : 'visible';
}
function tutNext() {
  if (tutPos >= TUT_SLIDES.length - 1) { tutFinish(); return; }
  tutPos++; renderTut();
}
function tutBack() { if (tutPos > 0) { tutPos--; renderTut(); } }
function tutFinish() {
  store.setTutorialSeen();
  const back = tutReturn || showMainMenu;
  back();
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
    'Follow the signal in order, or jump straight to any topic you need. Clear every lesson in a unit to open its unit test. Replay a cleared lesson flawlessly to earn all 3 ★.'));

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
  const node = h('div', `cmp-node cmp-lesson ${side} ${ln.state}${ln.current ? ' current' : ''}${ln.state !== 'locked' ? ' reached' : ''}`);
  node.style.setProperty('--node-color', u.color);
  node.setAttribute('role', 'button');
  node.tabIndex = ln.state === 'locked' ? -1 : 0;
  if (ln.current) node.id = 'cmp-current';
  const dot = ln.state === 'cleared' ? '✓' : ln.state === 'locked' ? '🔒' : ln.current ? '▶' : String(i + 1);
  const clearedMeta = starBar(ln.crown) + (ln.crown >= 3
    ? '<span class="cmp-meta cmp-mastered">★ MASTERED</span>'
    : '<span class="cmp-meta cmp-replay">↻ REPLAY FOR ★★★</span>');
  const meta = ln.state === 'cleared' ? clearedMeta
    : ln.current ? '<span class="cmp-meta">▶ START</span>'
      : ln.state === 'unlocked' ? '<span class="cmp-meta">READY</span>'
        : '<span class="cmp-meta">LOCKED</span>';
  node.innerHTML = `
    <span class="cmp-bus"></span>
    <span class="cmp-branch"></span>
    <span class="cmp-joint"></span>
    <span class="cmp-dot">${dot}</span>
    <span class="cmp-label">
      <span class="cmp-name">${phase ? phase.name : 'LESSON'}</span>
      ${meta}
    </span>`;
  const launch = () => {
    if (ln.state === 'locked') { nudge(node); return; }
    SFX.uiClick();
    // first play teaches (show intro); replaying a cleared lesson skips it
    engine.launchPhase(idxOfId(ln.phaseId), 'campaign', ln.state === 'cleared');
  };
  node.addEventListener('click', launch);
  node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); launch(); } });
  return node;
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
    arcadeModeCard('SURVIVAL', 'SUDDEN DEATH', 'One wrong answer ends the run — chase your longest streak across every topic.' + bestSuffix('survival', 'all', 'survived'), () => engine.startSurvival()),
    arcadeModeCard('PAST PAPER', 'EXAM STYLE', 'Sit a topic as an exam paper — write answers, reveal the mark scheme, self-mark, and get a grade.', () => showArcadeTopics('pastpaper')),
    arcadeModeCard('PRACTICAL CODING', 'WRITE CODE', 'Write real programs across the syllabus — reveal a model answer in your exam board’s notation and self-mark against the mark scheme.', () => engine.startPractical()),
  );
  engine.showScreen('arcade-modes');
}
// "· 🏆 Best: N unit" for a picker, or '' if there's no personal best yet.
function bestSuffix(mode, topicId, unit) {
  const b = store.getBest(mode, topicId);
  return b == null ? '' : ` · 🏆 Best: ${b} ${unit}`;
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
    const meta = (mode === 'pastpaper'
      ? `${phase.paper.length} questions · ${phase.paper.reduce((s, q) => s + (q.marks || 0), 0)} marks`
      : `${phase.questions.length} questions${st.started ? ' · ' + st.mastery + '% mastery' : ''}`)
      + bestSuffix(mode, phase.id, mode === 'pastpaper' ? 'marks' : 'pts');
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
