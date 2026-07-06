// ============================================================
// main.js — entry point.
//
// - imports the engine, the navigation screens, sound, and storage
// - wires the static DOM controls with addEventListener
// - restores + syncs the saved volume (HUD slider + menu slider)
// - boots the engine and the navigation layer
//
// Per-context buttons (phase-complete next/map, game-over retry/map)
// have their handlers set by the engine itself, so they are NOT wired
// here.
// ============================================================

import * as engine from './engine.js';
import * as screens from './screens.js';
import { SFX } from './sound.js';
import * as store from './storage.js';
import { initOnscreenKeys, toggleOnscreen } from './onscreenkeys.js';

function $(id) { return document.getElementById(id); }

// ---- volume: HUD slider + menu slider kept in sync ---------
const VOL_SLIDERS = ['vol-slider', 'menu-vol-slider', 'settings-vol-slider'];
const VOL_ICONS = ['vol-icon', 'menu-vol-icon', 'settings-vol-icon'];
function paintVolume(value) {
  const icon = (SFX.isMuted() || Number(value) === 0) ? '🔇' : '🔊';
  VOL_SLIDERS.forEach(id => { const s = $(id); if (s) s.value = value; });
  VOL_ICONS.forEach(id => { const i = $(id); if (i) i.textContent = icon; });
}
function setVolume(value) {
  const v = Number(value);
  SFX.setVol(v);
  store.setVolume(v);
  paintVolume(v);
}
function wireVolume() {
  VOL_SLIDERS.forEach(id => {
    const s = $(id); if (s) s.addEventListener('input', () => setVolume(s.value));
  });
  VOL_ICONS.forEach(id => {
    const i = $(id);
    if (i) i.addEventListener('click', () => { SFX.toggleMute(); paintVolume($('vol-slider').value); });
  });
}

// ---- theme: light / dark, persisted, HUD + menu toggles in sync ----
function paintTheme(theme) {
  const dark = theme === 'dark';
  const hudBtn = $('theme-btn');
  if (hudBtn) hudBtn.textContent = dark ? '☀️' : '🌙';
  const menuBtn = $('menu-theme-btn');
  if (menuBtn) menuBtn.textContent = dark ? '☀️ LIGHT MODE' : '🌙 DARK MODE';
  document.querySelectorAll('#settings-theme .settings-seg').forEach(b =>
    b.classList.toggle('active', b.dataset.theme === theme));
}
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  paintTheme(theme);
}
function toggleTheme() {
  const next = store.getTheme() === 'dark' ? 'light' : 'dark';
  store.setTheme(next);
  applyTheme(next);
  SFX.uiClick();
}
function wireTheme() {
  ['theme-btn', 'menu-theme-btn'].forEach(id => {
    const b = $(id); if (b) b.addEventListener('click', toggleTheme);
  });
  // Settings uses explicit Light / Dark segmented buttons (not a toggle)
  document.querySelectorAll('#settings-theme .settings-seg').forEach(b =>
    b.addEventListener('click', () => { const t = b.dataset.theme; store.setTheme(t); applyTheme(t); SFX.uiClick(); }));
}

// ---- UI size: scales the whole interface via zoom, persisted ----
const UI_ZOOM = { sm: 0.85, md: 1, lg: 1.2 };
function applyUiScale(scale) {
  const z = UI_ZOOM[scale] || 1;
  document.documentElement.style.zoom = z === 1 ? '' : String(z);
  document.querySelectorAll('#settings-uiscale .settings-seg').forEach(b =>
    b.classList.toggle('active', b.dataset.uiscale === scale));
}
function wireUiScale() {
  document.querySelectorAll('#settings-uiscale .settings-seg').forEach(b =>
    b.addEventListener('click', () => { const s = b.dataset.uiscale; store.setUiScale(s); applyUiScale(s); SFX.uiClick(); }));
}

// ---- exam-board preference (decides programming code notation) ----
const BOARD_OPTS = '#menu-board .board-opt, #settings-board .board-opt';
function paintBoard(board) {
  document.querySelectorAll(BOARD_OPTS).forEach(btn =>
    btn.classList.toggle('active', btn.dataset.board === board));
}
function wireBoard() {
  document.querySelectorAll(BOARD_OPTS).forEach(btn =>
    btn.addEventListener('click', () => { SFX.uiClick(); store.setBoard(btn.dataset.board); paintBoard(store.getBoard()); }));
}

function wire() {
  // question flow
  $('next-btn').addEventListener('click', engine.nextQuestion);
  $('hint-btn').addEventListener('click', engine.useHint);
  $('workings-btn').addEventListener('click', () => { SFX.uiClick(); engine.toggleWorkings(); });

  // multi-page lesson: NEXT advances a page; on the LAST page it asks the
  // "did you read everything?" confirmation before the questions. BACK steps back.
  const readConfirm = $('read-confirm');
  $('pi-start-btn').addEventListener('click', () => { if (engine.lessonAdvance()) { SFX.uiClick(); readConfirm.classList.add('show'); } });
  $('pi-back-btn').addEventListener('click', () => engine.lessonBack());
  $('read-no').addEventListener('click', () => { SFX.uiClick(); readConfirm.classList.remove('show'); });
  $('read-yes').addEventListener('click', () => { SFX.uiClick(); readConfirm.classList.remove('show'); engine.startPhaseQuestions(); });

  // exit (with confirmation) — both the EXIT button and the logo open it
  const exitConfirm = $('exit-confirm');
  const openExit = () => { SFX.uiClick(); exitConfirm.classList.add('show'); };
  $('exit-btn').addEventListener('click', openExit);
  const logoBtn = $('logo-btn');
  logoBtn.addEventListener('click', openExit);
  logoBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openExit(); } });
  $('exit-no').addEventListener('click', () => { SFX.uiClick(); exitConfirm.classList.remove('show'); });
  $('exit-yes').addEventListener('click', () => { SFX.uiClick(); exitConfirm.classList.remove('show'); engine.exitToMenu(); });

  // reset progress (Settings) — destructive, so confirm first
  const resetConfirm = $('reset-confirm');
  $('settings-reset-btn').addEventListener('click', () => { SFX.uiClick(); resetConfirm.classList.add('show'); });
  $('reset-no').addEventListener('click', () => { SFX.uiClick(); resetConfirm.classList.remove('show'); });
  $('reset-yes').addEventListener('click', () => {
    SFX.uiClick(); resetConfirm.classList.remove('show');
    store.resetProgress();
    screens.showMainMenu();   // re-render the menu from the now-cleared progress
  });

  // on-screen input helpers: toggle the floating numpad / keyboard panels
  $('numpad-btn').addEventListener('click', () => { SFX.uiClick(); toggleOnscreen('numpad'); });
  $('keyboard-btn').addEventListener('click', () => { SFX.uiClick(); toggleOnscreen('keyboard'); });

  // in-game settings: the HUD gear pauses the timer, opens settings, and the
  // settings "back" resumes the game right where it left off — restoring the
  // screen it was opened from (a lesson `phase-intro` or graded gameplay `null`),
  // not always `null` (which would drop a lesson onto the empty game area).
  $('settings-btn').addEventListener('click', () => {
    SFX.uiClick();
    const from = engine.getCurrentScreen();
    engine.pauseTimer();
    screens.showSettings(() => { engine.showScreen(from); engine.resumeTimer(); });
  });

  wireVolume();
  wireTheme();
  wireUiScale();
  wireBoard();
}

function boot() {
  const v = store.getVolume();
  SFX.setVol(v);
  paintVolume(v);
  applyTheme(store.getTheme());
  applyUiScale(store.getUiScale());
  paintBoard(store.getBoard());

  wire();
  initOnscreenKeys();
  engine.initEngine();
  screens.initScreens();
  // first-ever launch lands on the how-to-play tutorial; otherwise the menu
  if (!store.getTutorialSeen()) screens.showTutorial(screens.showMainMenu);
  else screens.showMainMenu();   // boot straight into the menu (no power-on screen)
}

boot();
