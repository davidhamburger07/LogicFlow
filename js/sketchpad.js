// ============================================================
// sketchpad.js — a global freeform "scratch pad", like the paper a
// student is given in a real exam. Available during every question;
// the player draws/types their working and it is never marked.
//
// Tools: PEN, HIGHLIGHTER, TEXT, ERASER. A colour picker (pen /
// highlighter / text) and an S/M/L size control (sized per tool, so
// the pencil and eraser both have their own sizes). Owns the
// #sketchpad overlay; the engine toggles/closes it.
// ============================================================

let root, canvas, ctx;
let mode = 'pen', colour = 'ink', sizeIdx = 1;
let drawing = false, last = null, sized = false;
// MOVE/select tool: marquee a rectangle, lift it into a floating layer, drag, stamp back
let floatEl = null, marqueeEl = null, selStart = null, selecting = false, dragFloat = null;

// per-tool sizes for the S / M / L control
const SIZES = { pen: [1.6, 3, 6], highlighter: [14, 22, 32], eraser: [14, 26, 46], text: [14, 20, 28] };
const COLOURS = ['ink', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

function mk(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function inkColour() { return (getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()) || '#111111'; }
function drawColour() { return colour === 'ink' ? inkColour() : colour; }

function fit() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const snapshot = sized ? canvas.toDataURL() : null;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  sized = true;
  if (snapshot) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height); img.src = snapshot; }
}
function posOf(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function strokeTo(p) {
  ctx.globalCompositeOperation = (mode === 'eraser') ? 'destination-out' : 'source-over';
  ctx.globalAlpha = (mode === 'highlighter') ? 0.38 : 1;
  ctx.strokeStyle = drawColour();
  ctx.lineWidth = SIZES[mode][sizeIdx];
  ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
  ctx.globalAlpha = 1;
  last = p;
}

// ── MOVE / select tool ──────────────────────────────────────
// canvas CSS coords -> position inside #sketchpad (its fixed box)
function toPad(cx, cy) { const rr = root.getBoundingClientRect(), cr = canvas.getBoundingClientRect(); return { left: cr.left - rr.left + cx, top: cr.top - rr.top + cy }; }

function startMarquee(e) {
  selStart = posOf(e); selecting = true;
  marqueeEl = mk('div', 'sp-marquee'); root.appendChild(marqueeEl); updateMarquee(e);
  try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
}
function updateMarquee(e) {
  if (!marqueeEl) return;
  const p = posOf(e);
  const x = Math.min(selStart.x, p.x), y = Math.min(selStart.y, p.y), w = Math.abs(p.x - selStart.x), h = Math.abs(p.y - selStart.y);
  const pad = toPad(x, y);
  marqueeEl.style.left = pad.left + 'px'; marqueeEl.style.top = pad.top + 'px';
  marqueeEl.style.width = w + 'px'; marqueeEl.style.height = h + 'px';
  marqueeEl._rect = { x, y, w, h };
}
function endMarquee() {
  const r = marqueeEl && marqueeEl._rect;
  if (marqueeEl) { marqueeEl.remove(); marqueeEl = null; }
  if (r && r.w > 4 && r.h > 4) liftSelection(r);
}
// copy the rect into a floating canvas, then clear it from the main canvas
function liftSelection(r) {
  const cr = canvas.getBoundingClientRect();
  const x = Math.max(0, r.x), y = Math.max(0, r.y);
  const w = Math.min(r.w, cr.width - x), h = Math.min(r.h, cr.height - y);
  if (w < 4 || h < 4) return;
  const dpr = window.devicePixelRatio || 1;
  const fc = mk('canvas', 'sp-float');
  fc.width = Math.round(w * dpr); fc.height = Math.round(h * dpr);
  fc.style.width = w + 'px'; fc.style.height = h + 'px';
  fc.getContext('2d').drawImage(canvas, Math.round(x * dpr), Math.round(y * dpr), Math.round(w * dpr), Math.round(h * dpr), 0, 0, fc.width, fc.height);
  ctx.clearRect(x, y, w, h);
  floatEl = { el: fc, cx: x, cy: y, w, h };
  positionFloat();
  fc.addEventListener('pointerdown', onFloatDown);
  fc.addEventListener('pointermove', onFloatMove);
  fc.addEventListener('pointerup', onFloatUp);
  fc.addEventListener('pointercancel', onFloatUp);
  root.appendChild(fc);
}
function positionFloat() { if (!floatEl) return; const p = toPad(floatEl.cx, floatEl.cy); floatEl.el.style.left = p.left + 'px'; floatEl.el.style.top = p.top + 'px'; }
function onFloatDown(e) { if (!floatEl) return; e.stopPropagation(); dragFloat = { sx: e.clientX, sy: e.clientY, ocx: floatEl.cx, ocy: floatEl.cy }; try { floatEl.el.setPointerCapture(e.pointerId); } catch (x) {} }
function onFloatMove(e) { if (!dragFloat || !floatEl) return; floatEl.cx = dragFloat.ocx + (e.clientX - dragFloat.sx); floatEl.cy = dragFloat.ocy + (e.clientY - dragFloat.sy); positionFloat(); }
function onFloatUp() { dragFloat = null; }
// draw the floating selection back onto the main canvas at its new spot
function stampFloat() {
  if (!floatEl) return;
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(floatEl.el, floatEl.cx, floatEl.cy, floatEl.w, floatEl.h);
  floatEl.el.remove(); floatEl = null;
}
function discardFloat() { if (floatEl) { floatEl.el.remove(); floatEl = null; } dragFloat = null; }

// TEXT tool: clicking drops a little input; on blur/Enter it's drawn to
// the canvas. Each input commits itself (idempotent), so placing another
// or switching tool just blurs and commits the previous one.
function placeText(e) {
  const sr = root.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
  const fs = SIZES.text[sizeIdx], col = drawColour();
  const cx = e.clientX - cr.left, cy = e.clientY - cr.top;
  const input = mk('input', 'sp-textinput'); input.type = 'text';
  input.style.left = (e.clientX - sr.left) + 'px';
  input.style.top = (e.clientY - sr.top) + 'px';
  input.style.fontSize = fs + 'px';
  input.style.color = col;
  let done = false;
  const commit = () => {
    if (done) return; done = true;
    const t = input.value;
    if (t) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.textBaseline = 'top'; ctx.font = `${fs}px 'Share Tech Mono', monospace`; ctx.fillText(t, cx, cy); }
    input.remove();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } else if (ev.key === 'Escape') { done = true; input.remove(); } });
  root.appendChild(input);
  requestAnimationFrame(() => input.focus());
}

function clearPad() {
  if (!ctx) return;
  discardFloat();
  if (marqueeEl) { marqueeEl.remove(); marqueeEl = null; } selecting = false;
  root.querySelectorAll('.sp-textinput').forEach(i => i.remove());
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore();
}
function setMode(m) {
  if (m !== 'move') stampFloat();   // commit any floating selection when leaving MOVE
  mode = m;
  root.querySelectorAll('.sp-tool').forEach(b => b.classList.toggle('is-active', b.dataset.tool === m));
  canvas.style.cursor = (m === 'text') ? 'text' : 'crosshair';
}
function setColour(c) {
  colour = c;
  root.querySelectorAll('.sp-swatch').forEach(b => b.classList.toggle('is-active', b.dataset.colour === c));
}
function setSize(i) {
  sizeIdx = i;
  root.querySelectorAll('.sp-size').forEach(b => b.classList.toggle('is-active', +b.dataset.size === i));
}

export function initSketchpad() {
  root = document.getElementById('sketchpad');
  if (!root) return;
  canvas = document.getElementById('sp-canvas');
  ctx = canvas.getContext('2d');

  // build the colour swatches
  const cwrap = document.getElementById('sp-colours');
  COLOURS.forEach(c => {
    const b = mk('button', 'sp-swatch'); b.dataset.colour = c;
    b.style.background = (c === 'ink') ? 'var(--ink)' : c;
    b.title = (c === 'ink') ? 'default' : c;
    b.addEventListener('click', () => setColour(c));
    cwrap.appendChild(b);
  });

  root.querySelectorAll('.sp-tool').forEach(b => b.addEventListener('click', () => setMode(b.dataset.tool)));
  root.querySelectorAll('.sp-size').forEach(b => b.addEventListener('click', () => setSize(+b.dataset.size)));
  document.getElementById('sp-clear').addEventListener('click', clearPad);
  document.getElementById('sp-close').addEventListener('click', closeSketchpad);

  canvas.addEventListener('pointerdown', e => {
    if (mode === 'text') { placeText(e); return; }
    if (mode === 'move') { if (floatEl) stampFloat(); startMarquee(e); return; }
    drawing = true; last = posOf(e); try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
    strokeTo({ x: last.x + 0.01, y: last.y });
  });
  canvas.addEventListener('pointermove', e => { if (selecting) { updateMarquee(e); return; } if (drawing) strokeTo(posOf(e)); });
  canvas.addEventListener('pointerup', () => { if (selecting) { endMarquee(); selecting = false; } drawing = false; });
  canvas.addEventListener('pointercancel', () => { drawing = false; selecting = false; });

  let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (root.classList.contains('show')) fit(); }, 200); });
  setMode('pen'); setColour('ink'); setSize(1);
}

export function toggleSketchpad() {
  if (!root) return false;
  const open = !root.classList.contains('show');
  root.classList.toggle('show', open);
  root.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) requestAnimationFrame(() => { if (!sized) fit(); });
  return open;
}
export function closeSketchpad() {
  if (root && root.classList.contains('show')) {
    root.querySelectorAll('.sp-textinput').forEach(i => i.blur());   // commit any open text
    stampFloat();                                                    // commit any moved selection
    root.classList.remove('show');
    root.setAttribute('aria-hidden', 'true');
    const btn = document.getElementById('workings-btn');
    if (btn) btn.textContent = '✏ SCRATCH PAD';
  }
}