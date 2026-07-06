// ============================================================
// onscreenkeys.js — global on-screen NUMPAD and KEYBOARD.
//
// Two floating key panels (toggled from the HUD) that type into whatever text
// input / textarea is focused — so a student on a touch screen, or without a
// physical keyboard, can answer the number- and text-input questions.
//
// - Only ONE panel shows at a time (numpad OR keyboard OR none). The choice is
//   persisted (storage.getOnscreenMode).
// - A panel is only visible while the HUD is active (a lesson or gameplay) —
//   i.e. exactly where answer inputs live. Tied to #hud.hud-active via a
//   MutationObserver, so it never floats over the main menu.
// - Keys fire on pointerdown with preventDefault, so the focused input keeps
//   focus (the classic soft-keyboard trick). Each key edits the value at the
//   caret and dispatches an 'input' event; ENTER re-fires a real Enter keydown
//   so a question submits (in a textarea it inserts a newline instead).
// - DRAGGABLE: grab a panel's title bar to move it anywhere; a 🔒/🔓 button
//   locks/unlocks placement. Each panel's position + the shared lock state are
//   persisted (storage.getOnscreenLayout).
// ============================================================

import { SFX } from './sound.js';
import * as store from './storage.js';

let mode = 'none';                 // 'none' | 'numpad' | 'keyboard'
let lastEditable = null;           // most recent editable the user focused
let numpadEl = null, keyboardEl = null;
let layout = { locked: false, numpad: null, keyboard: null };
const lockBtns = [], headers = [];

function isEditable(el) {
  if (!el || el.disabled || el.readOnly) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') { const t = (el.type || 'text').toLowerCase(); return ['text', 'number', 'tel', 'search', 'password'].includes(t); }
  return false;
}
function target() {
  const a = document.activeElement;
  if (isEditable(a)) return a;
  if (lastEditable && document.contains(lastEditable) && isEditable(lastEditable)) return lastEditable;
  return null;
}
function hudActive() { const h = document.getElementById('hud'); return !!(h && h.classList.contains('hud-active')); }
function refocus(el) { try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} } }
function sfx() { try { SFX.uiClick && SFX.uiClick(); } catch (e) {} }

function typeChar(ch) {
  const el = target(); if (!el) return;
  const max = (typeof el.maxLength === 'number' && el.maxLength >= 0) ? el.maxLength : -1;
  let start = el.selectionStart, end = el.selectionEnd;
  if (start == null) { start = end = el.value.length; }              // number inputs don't expose a caret
  let next = el.value.slice(0, start) + ch + el.value.slice(end);
  let caret = start + ch.length;
  if (max >= 1 && next.length > max) { next = ch.slice(-max); caret = next.length; }   // a full single-char cell → overwrite it
  el.value = next;
  try { el.setSelectionRange(caret, caret); } catch (e) {}
  el.dispatchEvent(new Event('input', { bubbles: true }));
  refocus(el);
}
function backspace() {
  const el = target(); if (!el) return;
  let start = el.selectionStart, end = el.selectionEnd;
  if (start == null) { el.value = el.value.slice(0, -1); }
  else if (start !== end) { el.value = el.value.slice(0, start) + el.value.slice(end); try { el.setSelectionRange(start, start); } catch (e) {} }
  else if (start > 0) { el.value = el.value.slice(0, start - 1) + el.value.slice(start); try { el.setSelectionRange(start - 1, start - 1); } catch (e) {} }
  else { return; }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  refocus(el);
}
function enter() {
  const el = target(); if (!el) return;
  if (el.tagName === 'TEXTAREA') { typeChar('\n'); return; }         // Enter = newline in a written-answer box
  refocus(el);
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
}

function press(key) {
  const act = key.dataset.act;
  if (act === 'back') { backspace(); sfx(); return; }
  if (act === 'enter') { enter(); sfx(); return; }
  if (act === 'space') { typeChar(' '); sfx(); return; }
  if (key.dataset.ch != null) { typeChar(key.dataset.ch); sfx(); }
}

function mk(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function keyBtn(label, opts = {}) {
  const b = mk('oskb-key' + (opts.cls ? ' ' + opts.cls : ''), 'button');
  b.type = 'button'; b.textContent = label; b.tabIndex = -1;
  if (opts.ch != null) b.dataset.ch = opts.ch;
  if (opts.act) b.dataset.act = opts.act;
  b.addEventListener('pointerdown', e => { e.preventDefault(); press(b); });
  return b;
}

// ---- drag + lock -------------------------------------------
function panelKey(panel) { return panel === numpadEl ? 'numpad' : 'keyboard'; }
function clampPos(panel, x, y) {
  const w = panel.offsetWidth, h = panel.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  return { x: Math.max(4, Math.min(x, vw - w - 4)), y: Math.max(4, Math.min(y, vh - h - 4)) };
}
function setPos(panel, x, y) {
  panel.style.left = x + 'px'; panel.style.top = y + 'px';
  panel.style.right = 'auto'; panel.style.bottom = 'auto'; panel.style.transform = 'none';
}
function applyPos(panel) {
  const pos = layout[panelKey(panel)];
  if (pos && typeof pos.x === 'number') { const c = clampPos(panel, pos.x, pos.y); setPos(panel, c.x, c.y); }
  else { panel.style.left = ''; panel.style.top = ''; panel.style.right = ''; panel.style.bottom = ''; panel.style.transform = ''; }
}
function savePos(panel) {
  layout[panelKey(panel)] = { x: Math.round(parseFloat(panel.style.left) || 0), y: Math.round(parseFloat(panel.style.top) || 0) };
  store.setOnscreenLayout(layout);
}
function wireDrag(panel, header) {
  header.addEventListener('pointerdown', e => {
    if (layout.locked || e.target.closest('button')) return;   // locked, or pressing lock/close
    e.preventDefault();
    const r = panel.getBoundingClientRect();
    const offX = e.clientX - r.left, offY = e.clientY - r.top;
    try { header.setPointerCapture(e.pointerId); } catch (er) {}
    const move = ev => { const c = clampPos(panel, ev.clientX - offX, ev.clientY - offY); setPos(panel, c.x, c.y); };
    const up = () => { header.removeEventListener('pointermove', move); header.removeEventListener('pointerup', up); savePos(panel); };
    header.addEventListener('pointermove', move);
    header.addEventListener('pointerup', up);
  });
}
function paintLock() {
  lockBtns.forEach(b => {
    b.textContent = layout.locked ? '🔒' : '🔓';
    b.title = layout.locked ? 'Placement locked — click to unlock and drag the bar' : 'Placement unlocked — drag the bar to move; click to lock';
    b.setAttribute('aria-pressed', layout.locked ? 'true' : 'false');
  });
  headers.forEach(h => h.classList.toggle('oskb-draggable', !layout.locked));
}
function toggleLock() { layout.locked = !layout.locked; store.setOnscreenLayout(layout); paintLock(); sfx(); }

function head(title) {
  const h = mk('oskb-head');
  const grip = mk('oskb-grip', 'span'); grip.textContent = '⠿'; grip.setAttribute('aria-hidden', 'true');
  const t = mk('oskb-title', 'span'); t.textContent = title;
  const lock = mk('oskb-lockbtn', 'button'); lock.type = 'button'; lock.tabIndex = -1;
  lock.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleLock(); });
  const x = mk('oskb-close', 'button'); x.type = 'button'; x.textContent = '✕'; x.tabIndex = -1;
  x.setAttribute('aria-label', 'Hide the on-screen keys');
  x.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); setMode('none'); });
  h.append(grip, t, lock, x);
  lockBtns.push(lock); headers.push(h);
  return h;
}

function buildNumpad() {
  const p = mk('oskb oskb-numpad'); p.id = 'onscreen-numpad'; p.setAttribute('aria-label', 'On-screen number pad');
  const h = head('NUMPAD'); p.appendChild(h);
  const keys = mk('oskb-keys');
  ['7', '8', '9', '4', '5', '6', '1', '2', '3'].forEach(d => keys.appendChild(keyBtn(d, { ch: d })));
  keys.appendChild(keyBtn('−', { ch: '-', cls: 'oskb-fn' }));
  keys.appendChild(keyBtn('0', { ch: '0' }));
  keys.appendChild(keyBtn('⌫', { act: 'back', cls: 'oskb-fn' }));
  keys.appendChild(keyBtn('ENTER ⏎', { act: 'enter', cls: 'oskb-enter' }));
  p.appendChild(keys);
  wireDrag(p, h);
  return p;
}
function buildKeyboard() {
  const p = mk('oskb oskb-keyboard'); p.id = 'onscreen-keyboard'; p.setAttribute('aria-label', 'On-screen keyboard');
  const h = head('KEYBOARD'); p.appendChild(h);
  const rows = [
    '1 2 3 4 5 6 7 8 9 0'.split(' '),
    'q w e r t y u i o p'.split(' '),
    'a s d f g h j k l'.split(' '),
    'z x c v b n m'.split(' '),
  ];
  rows.forEach((r, i) => {
    const row = mk('oskb-row');
    r.forEach(ch => row.appendChild(keyBtn(ch, { ch })));
    if (i === 3) row.appendChild(keyBtn('⌫', { act: 'back', cls: 'oskb-fn' }));   // backspace ends the last letter row
    p.appendChild(row);
  });
  const last = mk('oskb-row');
  last.appendChild(keyBtn('−', { ch: '-', cls: 'oskb-fn' }));
  last.appendChild(keyBtn('space', { act: 'space', cls: 'oskb-space' }));
  last.appendChild(keyBtn('ENTER ⏎', { act: 'enter', cls: 'oskb-enter' }));
  p.appendChild(last);
  wireDrag(p, h);
  return p;
}

function ensureVisible(el) {
  const panel = mode === 'numpad' ? numpadEl : mode === 'keyboard' ? keyboardEl : null;
  if (!panel || !el) return;
  const r = el.getBoundingClientRect();
  const box = panel.getBoundingClientRect();
  if (r.bottom > box.top - 10 && r.top < box.bottom + 10) { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }
}
function paintButtons() {
  const n = document.getElementById('numpad-btn'), k = document.getElementById('keyboard-btn');
  if (n) { n.classList.toggle('active', mode === 'numpad'); n.setAttribute('aria-pressed', mode === 'numpad' ? 'true' : 'false'); }
  if (k) { k.classList.toggle('active', mode === 'keyboard'); k.setAttribute('aria-pressed', mode === 'keyboard' ? 'true' : 'false'); }
}
function apply() {
  const active = hudActive();
  const showN = active && mode === 'numpad', showK = active && mode === 'keyboard';
  numpadEl.classList.toggle('show', showN);
  keyboardEl.classList.toggle('show', showK);
  if (showN) applyPos(numpadEl);
  if (showK) applyPos(keyboardEl);
  paintButtons();
}
function setMode(m) {
  mode = (m === 'numpad' || m === 'keyboard') ? m : 'none';
  store.setOnscreenMode(mode);
  apply();
  if (mode !== 'none') { const el = target(); if (el) { refocus(el); requestAnimationFrame(() => ensureVisible(el)); } }
}

export function toggleOnscreen(which) { setMode(mode === which ? 'none' : which); }

export function initOnscreenKeys() {
  layout = store.getOnscreenLayout();
  numpadEl = buildNumpad();
  keyboardEl = buildKeyboard();
  document.body.append(numpadEl, keyboardEl);
  mode = store.getOnscreenMode();
  paintLock();
  document.addEventListener('focusin', e => {
    if (!isEditable(e.target)) return;
    lastEditable = e.target;
    if (mode !== 'none' && hudActive()) requestAnimationFrame(() => ensureVisible(e.target));
  });
  window.addEventListener('resize', () => {
    [numpadEl, keyboardEl].forEach(p => { if (p.classList.contains('show') && layout[panelKey(p)]) applyPos(p); });
  });
  const hud = document.getElementById('hud');
  if (hud) new MutationObserver(apply).observe(hud, { attributes: true, attributeFilter: ['class'] });
  apply();
}
