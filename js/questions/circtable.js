// ============================================================
// questions/circtable.js — CIRCTABLE: read a drawn circuit, complete its
// truth table. The OCR-favourite task: a wired logic circuit is shown and
// the student fills in the truth table — with an INTERMEDIATE column for
// every gate (OCR awards method marks for those working columns), then Q.
//
// The circuit diagram is rendered from a gate spec; the truth table (rows,
// working columns, answers) is DERIVED automatically and handed to the
// existing TRUTHTABLE widget for the fill-in + grading.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema (gates listed in dependency order; NOT takes one input):
//   { type:'CIRCTABLE', inputs:['A','B'],
//     gates:[ { id:'G1', op:'OR', in:['A','B'] },
//             { id:'G2', op:'NOT', in:['G1'] } ],
//     output:'G2', title, explain }
// ============================================================

import { truthtable } from './truthtable.js';

const FONT = "'Share Tech Mono', monospace";
function mk(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function evalOp(op, a, b) { if (op === 'AND') return (a && b) ? 1 : 0; if (op === 'OR') return (a || b) ? 1 : 0; if (op === 'XOR') return (a !== b) ? 1 : 0; return a ? 0 : 1; }

// the expression a gate computes, in words (working-column labels)
function exprOf(g, gById, inputs) {
  const nm = r => inputs.includes(r) ? r : `(${exprOf(gById[r], gById, inputs)})`;
  return g.op === 'NOT' ? `NOT ${nm(g.in[0])}` : `${nm(g.in[0])} ${g.op} ${nm(g.in[1])}`;
}

// ── the circuit diagram (SVG) ──
function gateBody(op, x, y) {
  const f = 'var(--surface)', s = 'var(--ink)';
  if (op === 'AND') return `<path d="M ${x},${y} h 16 a 20,20 0 0 1 0,40 h -16 z" fill="${f}" stroke="${s}" stroke-width="2"/>`;
  if (op === 'OR') return `<path d="M ${x},${y} q 10,20 0,40 q 24,-1 38,-20 q -14,-19 -38,-20 z" fill="${f}" stroke="${s}" stroke-width="2"/>`;
  if (op === 'XOR') return `<path d="M ${x + 6},${y} q 10,20 0,40 q 24,-1 38,-20 q -14,-19 -38,-20 z" fill="${f}" stroke="${s}" stroke-width="2"/><path d="M ${x},${y} q 10,20 0,40" fill="none" stroke="${s}" stroke-width="2"/>`;
  return `<path d="M ${x},${y} l 32,20 l -32,20 z" fill="${f}" stroke="${s}" stroke-width="2"/><circle cx="${x + 37}" cy="${y + 20}" r="4" fill="${f}" stroke="${s}" stroke-width="2"/>`;
}
function outXof(op, x) { return op === 'AND' ? x + 36 : op === 'OR' ? x + 38 : op === 'XOR' ? x + 44 : x + 41; }

function circuitSvg(inputs, gates, output) {
  const IN_X = 18, STUB = 22, COL_W = 100, TOP = 26, IN_GAP = 48, GW = 40;
  const gById = {}; gates.forEach(g => { gById[g.id] = g; });
  const depth = {}; inputs.forEach(nm => { depth[nm] = 0; });
  gates.forEach(g => { depth[g.id] = 1 + Math.max(...g.in.map(r => depth[r] == null ? 0 : depth[r])); });
  const outY = {}, pos = {}; let maxX = 0;
  inputs.forEach((nm, i) => { outY[nm] = TOP + i * IN_GAP; });
  gates.forEach(g => {
    const gx = IN_X + STUB + (depth[g.id] - 1) * COL_W + 42;
    const ys = g.in.map(r => outY[r]);
    const yc = ys.reduce((a, b) => a + b, 0) / ys.length;
    pos[g.id] = { x: gx, yTop: yc - 20 };
    outY[g.id] = yc;
    maxX = Math.max(maxX, gx + GW);
  });
  const qx = maxX + 44;
  const H = Math.max(TOP + inputs.length * IN_GAP, ...gates.map(g => pos[g.id].yTop + GW + 16)) + 6;
  const W = qx + 26;

  const wire = (x1, y1, x2, y2, on) => { const mx = (x1 + x2) / 2; return `<polyline points="${x1},${y1} ${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="${on ? 'var(--phase-color)' : 'var(--ink-4)'}" stroke-width="2"/>`; };
  const srcOutX = r => inputs.includes(r) ? IN_X + STUB : outXof(gById[r].op, pos[r].x);
  let body = '';
  // input labels + stubs
  inputs.forEach(nm => { const y = outY[nm]; body += `<text x="${IN_X - 4}" y="${y + 4}" fill="var(--ink)" font-family="${FONT}" font-size="13" text-anchor="end">${nm}</text><line x1="${IN_X}" y1="${y}" x2="${IN_X + STUB}" y2="${y}" stroke="var(--ink-4)" stroke-width="2"/>`; });
  // wires (under the gates)
  gates.forEach(g => {
    const p = pos[g.id];
    const ports = g.op === 'NOT' ? [{ x: p.x, y: p.yTop + 20 }] : [{ x: p.x, y: p.yTop + 11 }, { x: p.x, y: p.yTop + 29 }];
    g.in.forEach((r, k) => { body += wire(srcOutX(r), outY[r], ports[k].x, ports[k].y, false); });
  });
  body += wire(srcOutX(output), outY[output], qx, outY[output], true);
  body += `<text x="${qx + 6}" y="${outY[output] + 5}" fill="var(--phase-color)" font-family="${FONT}" font-size="14">Q</text>`;
  // gates on top + a small type label
  gates.forEach(g => { const p = pos[g.id]; body += gateBody(g.op, p.x, p.yTop) + `<text x="${p.x + 16}" y="${p.yTop + GW + 12}" fill="var(--ink-4)" font-family="${FONT}" font-size="8" text-anchor="middle" letter-spacing="1">${g.op}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" class="ctb-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="logic circuit to trace">${body}</svg>`;
}

export const circtable = {
  type: 'CIRCTABLE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const inputs = question.inputs;
    const gates = question.gates;
    const output = question.output;
    const gById = {}; gates.forEach(g => { gById[g.id] = g; });

    // input rows in binary order + every gate's value per row
    const n = inputs.length, rows = [];
    for (let i = 0; i < (1 << n); i++) { const r = []; for (let b = n - 1; b >= 0; b--) r.push((i >> b) & 1); rows.push(r); }
    const vals = {}; gates.forEach(g => { vals[g.id] = []; });
    rows.forEach((r, ri) => {
      const env = {}; inputs.forEach((nm, i) => { env[nm] = r[i]; });
      gates.forEach(g => { const v = g.op === 'NOT' ? evalOp('NOT', env[g.in[0]]) : evalOp(g.op, env[g.in[0]], env[g.in[1]]); env[g.id] = v; vals[g.id][ri] = v; });
    });

    // derive the TRUTHTABLE question: a working column per non-output gate, Q = output gate
    const workGates = gates.filter(g => g.id !== output);
    const derived = {
      inputs, rows,
      answer: vals[output],
      work: workGates.map(g => ({ label: exprOf(g, gById, inputs), answer: vals[g.id] })),
    };

    const wrap = mk('ctb');
    wrap.appendChild(mk('ctb-diagram')).innerHTML = circuitSvg(inputs, gates, output);
    wrap.appendChild(mk('ctb-hint')).textContent = 'Trace each gate left → right: fill its column (the working columns) for every row, then read off Q.';
    const tableHost = mk('ctb-table');
    wrap.appendChild(tableHost);
    host.appendChild(wrap);

    truthtable.render(tableHost, derived, ctx);
  },
};
