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
import { MUSIC } from './music.js';
import * as store from './storage.js';
import * as cloud from './cloud.js';
import * as cg from './crazygames.js';
import * as courses from './courses.js';
import { backendEnabled } from './config.js';
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
  MUSIC.setVol(v);
  store.setVolume(v);
  paintVolume(v);
}

// ---- background music: setting + first-gesture start (autoplay policy) ----
function paintMusic(on) {
  document.querySelectorAll('#settings-music .settings-seg').forEach(b =>
    b.classList.toggle('active', (b.dataset.music === 'on') === on));
}
function wireMusic() {
  document.querySelectorAll('#settings-music .settings-seg').forEach(b =>
    b.addEventListener('click', () => {
      SFX.uiClick();
      const on = b.dataset.music === 'on';
      store.setMusicOn(on);
      paintMusic(on);
      if (on) MUSIC.start(); else MUSIC.stop();   // the click is a valid gesture
    }));
  // browsers block audio before a user gesture — start on the first one
  const kick = () => { if (store.getMusicOn()) MUSIC.start(); };
  window.addEventListener('pointerdown', kick, { once: true });
  window.addEventListener('keydown', kick, { once: true });
}
function wireVolume() {
  VOL_SLIDERS.forEach(id => {
    const s = $(id); if (s) s.addEventListener('input', () => setVolume(s.value));
  });
  VOL_ICONS.forEach(id => {
    const i = $(id);
    if (i) i.addEventListener('click', () => { MUSIC.setMuted(SFX.toggleMute()); paintVolume($('vol-slider').value); });
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

// ---- back up & restore (Settings) — the save/restore code route ----
function wireBackup() {
  const out = $('settings-backup-out');
  const panel = $('settings-restore-panel');
  const input = $('settings-restore-in');
  const msg = $('settings-backup-msg');
  const setMsg = (t, kind) => { msg.textContent = t; msg.className = 'settings-backup-msg' + (kind ? ' settings-backup-msg-' + kind : ''); };

  $('settings-backup-copy').addEventListener('click', async () => {
    SFX.uiClick();
    const code = store.exportSave();
    out.value = code; out.hidden = false;
    try { await navigator.clipboard.writeText(code); setMsg('✓ Backup code copied — paste it somewhere safe, or on another device.', 'ok'); }
    catch (e) { out.focus(); out.select(); setMsg('Select the code above and copy it (Ctrl+C).', ''); }
  });

  $('settings-backup-file').addEventListener('click', () => {
    SFX.uiClick();
    const code = store.exportSave();
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `logicflow-backup-${date}.lfsave`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg('✓ Backup file downloaded — keep it safe.', 'ok');
  });

  $('settings-restore-toggle').addEventListener('click', () => {
    SFX.uiClick();
    panel.hidden = !panel.hidden;
    if (!panel.hidden) input.focus();
  });

  $('settings-restore-file').addEventListener('click', () => { SFX.uiClick(); $('settings-restore-input').click(); });
  $('settings-restore-input').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { input.value = String(reader.result || '').trim(); panel.hidden = false; setMsg('File loaded — press RESTORE to apply it.', ''); };
    reader.onerror = () => setMsg('✗ Could not read that file.', 'err');
    reader.readAsText(file);
    e.target.value = '';   // let the same file be picked again
  });

  $('settings-restore-go').addEventListener('click', () => {
    SFX.uiClick();
    const res = store.importSave(input.value);
    if (!res.ok) { setMsg('✗ ' + res.error, 'err'); return; }
    setMsg('✓ Progress restored — reloading…', 'ok');
    setTimeout(() => location.reload(), 850);
  });
}

// ---- cloud save (Settings) — CrazyGames account sync status ----
function wireCloud() {
  const desc = $('settings-cloud-desc');
  const row = $('settings-cloud-row');
  const statusEl = $('settings-cloud-status');
  const signin = $('settings-cloud-signin');
  signin.addEventListener('click', async () => { SFX.uiClick(); await cloud.promptSignIn(); });
  cloud.onStatus(st => {
    if (!st.available) {
      desc.innerHTML = 'Cloud save switches on automatically when you play on <strong>CrazyGames</strong> — your progress then follows your account across devices. On this page it is saved locally, so use the backup code below to move it between devices.';
      row.hidden = true;
    } else if (st.signedIn) {
      desc.innerHTML = 'Your progress is <strong>synced to your CrazyGames account</strong> — it follows you across devices automatically.';
      statusEl.textContent = '✓ Signed in' + (st.username ? ' as ' + st.username : '');
      row.hidden = false; signin.hidden = true;
    } else {
      desc.innerHTML = 'Sign in to save your progress to your <strong>CrazyGames account</strong> and sync it across every device.';
      statusEl.textContent = 'Not signed in.';
      row.hidden = false; signin.hidden = false;
    }
  });
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

  // background music: settings toggle + first-gesture start
  wireMusic();
  // back up & restore (Settings): a portable code + file, and restore
  wireBackup();
  // cloud save (Settings): CrazyGames account sync status + sign-in
  wireCloud();

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
  MUSIC.setVol(v);
  paintVolume(v);
  paintMusic(store.getMusicOn());
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

  // CrazyGames SDK: init (non-blocking), signal the game has loaded, then start
  // cloud save. Off CrazyGames all of this no-ops and the game runs local-only.
  cg.initSdk().then(() => cg.gameLoadingStop());
  cloud.initCloud();

  // Standalone-site backend (accounts + paid courses). Only when configured in
  // config.js — dev and the CrazyGames build stay on the local provider.
  if (backendEnabled()) {
    import('./supabaseProvider.js').then(async sp => {
      courses.setEntitlementProvider(sp.provider);
      screens.setAuthApi(sp);
      await sp.initSupabase();
      // returning from a Stripe checkout — the webhook granted the course, so
      // re-read entitlements before the first render.
      if (/[?&]unlocked=/.test(location.search)) await sp.refresh();
      screens.refreshAfterAuth();
    }).catch(() => { /* backend unreachable → stay on the local provider */ });
  }
}

boot();
