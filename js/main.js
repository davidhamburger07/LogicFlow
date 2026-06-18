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

function $(id) { return document.getElementById(id); }

// ---- volume: HUD slider + menu slider kept in sync ---------
function paintVolume(value) {
  const icon = (SFX.isMuted() || Number(value) === 0) ? '🔇' : '🔊';
  ['vol-slider', 'menu-vol-slider'].forEach(id => { const s = $(id); if (s) s.value = value; });
  ['vol-icon', 'menu-vol-icon'].forEach(id => { const i = $(id); if (i) i.textContent = icon; });
}
function setVolume(value) {
  const v = Number(value);
  SFX.setVol(v);
  store.setVolume(v);
  paintVolume(v);
}
function wireVolume() {
  ['vol-slider', 'menu-vol-slider'].forEach(id => {
    const s = $(id); if (s) s.addEventListener('input', () => setVolume(s.value));
  });
  ['vol-icon', 'menu-vol-icon'].forEach(id => {
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
}

function wire() {
  // POWER ON -> main menu (keep the power-on moment)
  $('start-btn').addEventListener('click', () => { SFX.powerOn(); screens.showMainMenu(); });

  // question flow
  $('pi-start-btn').addEventListener('click', engine.startPhaseQuestions);
  $('next-btn').addEventListener('click', engine.nextQuestion);
  $('hint-btn').addEventListener('click', engine.useHint);

  // exit (with confirmation)
  const exitConfirm = $('exit-confirm');
  $('exit-btn').addEventListener('click', () => { SFX.uiClick(); exitConfirm.classList.add('show'); });
  $('exit-no').addEventListener('click', () => { SFX.uiClick(); exitConfirm.classList.remove('show'); });
  $('exit-yes').addEventListener('click', () => { SFX.uiClick(); exitConfirm.classList.remove('show'); engine.exitToMenu(); });

  wireVolume();
  wireTheme();
}

function boot() {
  const v = store.getVolume();
  SFX.setVol(v);
  paintVolume(v);
  applyTheme(store.getTheme());

  wire();
  engine.initEngine();
  screens.initScreens();
}

boot();
