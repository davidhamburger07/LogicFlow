// ============================================================
// visual.js — the visual panel (circuit diagram / colour swatch
// / sort bars) shown above the answer area.
//
// Owns its own little state (vState) and animation loop, decoupled
// from the engine. The engine just calls:
//   initVisual()                 once at boot
//   showVisual(phase, question)  when a new question loads
//   markAnswered()               when the player answers correctly
//   hideVisual()                 on phase-complete / game-over
//
// When we build the slot-based circuit mini-game later, its
// interactive rendering can live here (or in its own question
// module) without the engine caring.
// ============================================================

let canvas = null, ctx = null;
let pulseT = 0;
let signalParticles = [];
const vState = { phase: null, question: null, answered: false };

// Question types that render their own interactive visual — the read-only
// panel is suppressed for these (the module owns its visuals itself).
const SELF_RENDERED = new Set(['CIRCUIT', 'CIPHER', 'TRACE', 'FDE', 'PACKET', 'EXAM', 'CODE_TRACE', 'CODE_FILL', 'CODE_BUILD', 'CODE_BUG', 'CODE_WRITE', 'NUMBER', 'PLACEVALUE', 'BINADD', 'SHIFT', 'FLIPADD', 'BINSUB', 'HEXPICK', 'SWATCH', 'CALC', 'TYPEIN', 'ORDER', 'CATEGORISE', 'RECALL', 'EXAMCOACH', 'TRUTHTABLE', 'MATCH', 'SEARCHTRACE', 'SQLBUILD', 'SERVERROOM', 'OVERFLOW', 'HEXLOCK', 'SIGNAL']);
// A question owns/suppresses the read-only panel if it renders its own visual
// (SELF_RENDERED), is a video watch-check, or explicitly opts out via noVisual
// (used to drop an unhelpful/irrelevant diagram from a question).
function ownsVisual(q) { return !!q && (SELF_RENDERED.has(q.type) || q.watchCheck || q.noVisual); }

// Per-question helpful diagrams (rendered in the read-only panel when a
// question sets `diagram: '<name>'`). These REPLACE the old decorative circuit
// panels with something that actually teaches the point of the question.
function twosMsbDiagram() {
  const pvs = ['-128', '64', '32', '16', '8', '4', '2', '1'];
  const cells = pvs.map((pv, i) =>
    `<div class="vqd-col${i === 0 ? ' vqd-hi' : ''}"><span class="vqd-pv">${pv}</span><span class="vqd-cell">${i === 0 ? '1' : '0'}</span></div>`).join('');
  return `<div class="vqd"><div class="vqd-cap">In two’s complement the <b>leftmost bit (MSB)</b> has a <b>negative</b> place value (−128) — that is what stores the sign.</div><div class="vqd-row">${cells}</div></div>`;
}
const QDIAGRAMS = {
  'twos-msb': twosMsbDiagram(),
};

// Decide which gate diagram to draw for a logic-gate question,
// or fall back to the phase's circuit type.
function gateTypeFor(phase, question) {
  if (!phase) return 'binary';
  if (phase.circuit === 'gate' && question) {
    const t = question.title || '';
    if (t.includes('XOR')) return 'xor';
    if (t.includes('NOT')) return 'not';
    if (t.includes('OR') && !t.includes('AND')) return 'or';
    return 'and';
  }
  return phase.circuit || 'binary';
}

export function initVisual() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  requestAnimationFrame(loop);
}

function resizeCanvas() {
  if (!canvas) return;
  const vp = document.getElementById('visual-panel');
  canvas.width = vp.clientWidth || 600;
  canvas.height = 160;
}

function drawCircuit(type, active, result) {
  if (!canvas) return;
  if (!canvas.width) resizeCanvas();
  const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  pulseT += 0.04;

  const wc = '#CCCCCC', ac = '#2563EB', lc = '#AAAAAA';
  function wire(x1, y1, x2, y2, on) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = on ? ac : wc; ctx.lineWidth = on ? 2.5 : 1.5; ctx.stroke();
  }
  function node(x, y, on, lbl = '') {
    const r = 5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = on ? ac : '#fff'; ctx.fill();
    ctx.strokeStyle = on ? ac : wc; ctx.lineWidth = 2; ctx.stroke();
    if (on) {
      ctx.beginPath(); ctx.arc(x, y, r + 4 + Math.sin(pulseT * 3) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(37,99,235,0.2)'; ctx.lineWidth = 2; ctx.stroke();
    }
    if (lbl) { ctx.fillStyle = on ? ac : lc; ctx.font = '10px Share Tech Mono'; ctx.textAlign = 'center'; ctx.fillText(lbl, x, y - 10); }
  }
  function box(gx, gy, gt, res) {
    const gw = 56, gh = 36;
    const fc = res === 1 ? 'rgba(37,99,235,0.08)' : 'rgba(200,200,200,0.08)';
    const sc = res === 1 ? ac : wc;
    ctx.fillStyle = fc; ctx.strokeStyle = sc; ctx.lineWidth = 1.5;
    if (gt === 'and') { ctx.beginPath(); ctx.moveTo(gx - gw / 2, gy - gh / 2); ctx.lineTo(gx, gy - gh / 2); ctx.arc(gx, gy, gh / 2, -Math.PI / 2, Math.PI / 2); ctx.lineTo(gx - gw / 2, gy + gh / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (gt === 'or' || gt === 'xor') { ctx.beginPath(); ctx.moveTo(gx - gw / 2, gy - gh / 2); ctx.quadraticCurveTo(gx - gw / 4, gy, gx - gw / 2, gy + gh / 2); ctx.quadraticCurveTo(gx, gy + gh / 2, gx + gw / 2, gy); ctx.quadraticCurveTo(gx, gy - gh / 2, gx - gw / 2, gy - gh / 2); ctx.fill(); ctx.stroke(); if (gt === 'xor') { ctx.beginPath(); ctx.moveTo(gx - gw / 2 - 10, gy - gh / 2); ctx.quadraticCurveTo(gx - gw / 4 - 10, gy, gx - gw / 2 - 10, gy + gh / 2); ctx.stroke(); } }
    else if (gt === 'not') { ctx.beginPath(); ctx.moveTo(gx - gw / 2, gy - gh / 2); ctx.lineTo(gx + gw / 2 - 8, gy); ctx.lineTo(gx - gw / 2, gy + gh / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(gx + gw / 2 - 4, gy, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.rect(gx - gw / 2, gy - gh / 2, gw, gh); ctx.fill(); ctx.stroke(); }
    const lmap = { and: 'AND', or: 'OR', not: 'NOT', xor: 'XOR', binary: 'REG', cpu: 'ALU', memory: 'MEM' };
    ctx.fillStyle = res === 1 ? ac : '#aaa'; ctx.font = '9px Share Tech Mono'; ctx.textAlign = 'center'; ctx.fillText(lmap[gt] || '?', gx, gy + 4);
  }

  // particles
  signalParticles = signalParticles.filter(p => p.life > 0);
  signalParticles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; const a = p.life / p.maxLife; ctx.beginPath(); ctx.arc(p.x, p.y, 3 * a, 0, Math.PI * 2); ctx.fillStyle = `rgba(37,99,235,${a * 0.7})`; ctx.fill(); });

  if (type === 'and' || type === 'or' || type === 'xor' || type === 'not') {
    if (type === 'not') {
      wire(cx - 140, cy, cx - 32, cy, active); box(cx, cy, type, result); wire(cx + 32, cy, cx + 140, cy, result === 1);
      node(cx - 140, cy, active, 'IN'); node(cx + 140, cy, result === 1, 'OUT');
    } else {
      wire(cx - 140, cy - 35, cx - 32, cy - 14, active); wire(cx - 140, cy + 35, cx - 32, cy + 14, active);
      box(cx, cy, type, result); wire(cx + 32, cy, cx + 140, cy, result === 1);
      const q = vState.question;
      const bOn = q && !q.desc.includes('B = 0') && !q.title.includes('B = 0');
      node(cx - 140, cy - 35, active, 'A'); node(cx - 140, cy + 35, bOn, 'B'); node(cx + 140, cy, result === 1, 'OUT');
    }
  } else if (type === 'cpu') {
    wire(cx - 160, cy - 35, cx - 32, cy - 14, active); wire(cx - 160, cy, cx - 32, cy, active); wire(cx - 160, cy + 35, cx - 32, cy + 14, active);
    box(cx, cy, 'cpu', result); wire(cx + 32, cy, cx + 160, cy, result === 1);
    node(cx - 160, cy - 35, active, 'A'); node(cx - 160, cy, false, 'OP'); node(cx - 160, cy + 35, active, 'B'); node(cx + 160, cy, result === 1, 'OUT');
  } else {
    wire(cx - 160, cy, cx - 32, cy, active); box(cx, cy, 'binary', result); wire(cx + 32, cy, cx + 160, cy, result === 1);
    node(cx - 160, cy, active, 'IN'); node(cx + 160, cy, result === 1, 'OUT');
  }

  if (result === 1 && Math.random() < 0.25) signalParticles.push({ x: cx + 80 + Math.random() * 60, y: cy + (Math.random() - 0.5) * 20, vx: 1.5 + Math.random(), vy: (Math.random() - 0.5) * 0.5, life: 30, maxLife: 30 });
}

function loop() {
  const phase = vState.phase;
  if (vState.question && !vState.question.diagram && phase && phase.circuit === 'gate' && vState.answered) {
    drawCircuit(gateTypeFor(phase, vState.question), true, 1);
  }
  requestAnimationFrame(loop);
}

export function showVisual(phase, question) {
  vState.phase = phase; vState.question = question; vState.answered = false;

  const vp = document.getElementById('visual-panel');
  const cvs = document.getElementById('game-canvas');
  const sw = document.getElementById('colour-swatch');
  const sv = document.getElementById('sort-visual');
  const dg = document.getElementById('visual-diagram');
  cvs.style.display = 'none'; sw.classList.remove('show'); sv.classList.remove('show'); dg.classList.remove('show');

  // 1) a question-supplied HELPFUL diagram wins (e.g. highlight the MSB).
  if (question && question.diagram && QDIAGRAMS[question.diagram]) {
    dg.innerHTML = QDIAGRAMS[question.diagram]; dg.classList.add('show'); vp.classList.add('show');
    return;
  }
  // 2) self-rendered / watch-check / opted-out questions show no panel.
  if (ownsVisual(question)) { hideVisual(); return; }
  // 3) the LOGIC-GATE diagram is the only auto-panel that genuinely helps its
  //    questions; the old binary/cpu/sort/swatch panels were just decoration on
  //    the remaining MC questions, so they are dropped (per the diagram audit).
  if (phase.visual === 'canvas' && phase.circuit === 'gate') {
    cvs.style.display = 'block'; vp.classList.add('show');
    resizeCanvas();
    drawCircuit(gateTypeFor(phase, question), true, 0);
    return;
  }
  hideVisual();
}

export function markAnswered() {
  vState.answered = true;
  if (ownsVisual(vState.question) || (vState.question && vState.question.diagram)) return;
  const phase = vState.phase;
  if (phase && phase.circuit === 'gate') {
    drawCircuit(gateTypeFor(phase, vState.question), true, 1);
  }
}

export function hideVisual() {
  document.getElementById('visual-panel').classList.remove('show');
}
