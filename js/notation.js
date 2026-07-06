// ============================================================
// notation.js — render Boolean expressions in the player's board shorthand.
//
// Words (AND, OR, NOT, XOR) stay the primary form everywhere; these helpers
// render the SYMBOL shorthand the board expects a student to recognise:
//   AQA / Eduqas / WJEC — Boolean algebra:  A · B, A + B, A̅, A ⊕ B
//   OCR / Edexcel       — logic notation:    A ∧ B, A ∨ B, ¬A
// ============================================================

import { getBoard, getGateNotation, boardRequiresGate } from './storage.js';

// one gate rendered as its board expression, e.g. AND -> "A · B", NOT -> "A̅"
export function gateExpr(gate, opts = {}, board = getBoard()) {
  const n = getGateNotation(board);
  const a = opts.a || 'A', b = opts.b || 'B';
  if (gate === 'NOT') return n.not === 'bar' ? `<span class="nt-ov">${a}</span>` : `${n.NOT}${a}`;
  const sym = n[gate];
  if (!sym) return `${a} ${gate} ${b}`;   // gate the board doesn't symbolise (e.g. XOR on formal) — fall back to word
  return `${a} ${sym} ${b}`;
}

// the reference table for the board: word | shorthand | plain meaning
export function notationTableHtml(board = getBoard()) {
  const n = getGateNotation(board);
  const gates = ['AND', 'OR', 'NOT'].concat(boardRequiresGate('XOR', board) ? ['XOR'] : []);
  const means = { AND: 'both inputs on', OR: 'at least one on', NOT: 'flip the input', XOR: 'the inputs differ' };
  const rows = gates.map(g =>
    `<tr><th class="nt-word">${g}</th><td class="nt-sym">${gateExpr(g, {}, board)}</td><td class="nt-mean">${means[g]}</td></tr>`).join('');
  return `<div class="nt-ref"><div class="nt-ref-cap">Your board (${board}) writes it in <strong>${n.label}</strong>:</div>`
    + `<table class="nt-table"><tr><th>word</th><th>shorthand</th><th>means</th></tr>${rows}</table></div>`;
}
