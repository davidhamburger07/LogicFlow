// ============================================================
// workpad.js — an on-page "working out" layer for the lesson flow.
//
// Unlike the old bottom-sheet scratch pad (which covered the question),
// this is a TRANSPARENT full-viewport canvas so the question stays
// visible underneath — you can do your workings ANYWHERE on the page,
// exam-paper style. A small docked toolbar on the side holds the full
// tool set, and a DRAW / INTERACT toggle decides whether pointer events
// draw on the canvas or pass straight through to the question.
//
// Tools: PEN, HIGHLIGHTER, TEXT, ERASER · colour swatches · S/M/L size ·
// CLEAR. The toolbar is always clickable; the canvas only captures
// pointer events while DRAW is on.
// ============================================================

let root, bar, canvas, ctx;
let mode = 'pen', colour = 'ink', sizeIdx = 1, active = false, sized = false;
let drawing = false, last = null;

const SIZES = { pen: [1.6, 3, 6], highlighter: [14, 22, 32], eraser: [16, 28, 48], text: [14, 20, 28] };
const COLOURS = ['ink', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

function mk(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function inkColour() { return (getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()) || '#111111'; }
function drawColour() { return colour === 'ink' ? inkColour() : colour; }

// the canvas fills the viewport at (0,0), so client coords ARE canvas coords
function fit() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  const snap = sized ? canvas.toDataURL() : null;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  sized = true;
  if (snap) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, w, h); img.src = snap; }
}
function strokeTo(p) {
  ctx.globalCompositeOperation = (mode === 'eraser') ? 'destination-out' : 'source-over';
  ctx.globalAlpha = (mode === 'highlighter') ? 0.38 : 1;
  ctx.strokeStyle = drawColour();
  ctx.lineWidth = SIZES[mode][sizeIdx];
  ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
  ctx.globalAlpha = 1; last = p;
}
// TEXT tool: drop an input where you click; commit to the canvas on blur/Enter
function placeText(e) {
  const fs = SIZES.text[sizeIdx], col = drawColour();
  const cx = e.clientX, cy = e.clientY;
  const input = mk('input', 'wp-textinput'); input.type = 'text';
  input.style.left = cx + 'px'; input.style.top = cy + 'px'; input.style.fontSize = fs + 'px'; input.style.color = col;
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
  root.querySelectorAll('.wp-textinput').forEach(i => i.remove());
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore();
}

function setMode(m) { mode = m; bar.querySelectorAll('.wp-tool').forEach(b => b.classList.toggle('is-active', b.dataset.tool === m)); canvas.style.cursor = (m === 'text') ? 'text' : 'crosshair'; }
function setColour(c) { colour = c; bar.querySelectorAll('.wp-swatch').forEach(b => b.classList.toggle('is-active', b.dataset.colour === c)); }
function setSize(i) { sizeIdx = i; bar.querySelectorAll('.wp-size').forEach(b => b.classList.toggle('is-active', +b.dataset.size === i)); }
// DRAW on = the canvas captures pointer events (scribble anywhere);
// DRAW off = events pass through to the question underneath.
function setActive(on) {
  active = on;
  root.classList.toggle('drawing', on);
  if (canvas) canvas.style.pointerEvents = on ? 'auto' : 'none';
  const t = document.getElementById('wp-draw');
  if (t) { t.innerHTML = on ? '✋ DONE' : '✏ DRAW'; t.classList.toggle('is-on', on); }
}

export function initWorkpad() {
  root = document.getElementById('workpad'); if (!root) return;
  bar = document.getElementById('wp-bar');
  canvas = document.getElementById('wp-canvas'); ctx = canvas.getContext('2d');

  const cwrap = document.getElementById('wp-colours');
  COLOURS.forEach(c => { const b = mk('button', 'wp-swatch'); b.dataset.colour = c; b.style.background = (c === 'ink') ? 'var(--ink)' : c; b.title = (c === 'ink') ? 'default' : c; b.addEventListener('click', () => { setColour(c); if (!active) setActive(true); }); cwrap.appendChild(b); });
  // picking a tool turns DRAW on (you reached for a pen — you mean to draw)
  bar.querySelectorAll('.wp-tool').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.tool); if (!active) setActive(true); }));
  bar.querySelectorAll('.wp-size').forEach(b => b.addEventListener('click', () => setSize(+b.dataset.size)));
  document.getElementById('wp-clear').addEventListener('click', clearPad);
  document.getElementById('wp-draw').addEventListener('click', () => setActive(!active));

  canvas.addEventListener('pointerdown', e => { if (!active) return; if (mode === 'text') { placeText(e); return; } drawing = true; last = { x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} strokeTo({ x: last.x + 0.01, y: last.y }); });
  canvas.addEventListener('pointermove', e => { if (drawing) strokeTo({ x: e.clientX, y: e.clientY }); });
  canvas.addEventListener('pointerup', () => { drawing = false; });
  canvas.addEventListener('pointercancel', () => { drawing = false; });

  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (root.classList.contains('show')) fit(); }, 200); });
  setMode('pen'); setColour('ink'); setSize(1);
}

// reveal the working layer (a fresh, empty sheet, in INTERACT mode so the
// question is immediately usable; the student opts into DRAW when needed).
export function showWorkpad() {
  if (!root) return;
  root.classList.add('show');
  requestAnimationFrame(() => { if (!sized) fit(); clearPad(); setActive(false); });
}
export function hideWorkpad() {
  if (!root) return;
  setActive(false);
  clearPad();   // don't let a drawing linger / flash when the layer is shown again
  root.classList.remove('show');
}
