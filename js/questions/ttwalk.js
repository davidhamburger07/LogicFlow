// ============================================================
// questions/ttwalk.js — TTWALK: watch a truth table being completed,
// one cell at a time, with a "why" note at every step.
//
// A guided, non-graded walkthrough (like STEPADD). Two modes:
//   • simple gate — `gate:'AND'|'OR'|'XOR'|'NOT'` builds a single Q column.
//   • expression  — `cols:[…]` builds working column(s) then Q, so bracketed
//     expressions are walked the way they're done on paper: fill the working
//     column for every row first, THEN combine into Q.
// Each computed column is walked row by row; NEXT STEP fills the next cell
// and explains it. Finishing calls ctx.onSubmit(true) so the lesson's NEXT
// ungates — author with walk:true for the "▶ STEP THROUGH IT" badge.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(true)
//
// Question schema:
//   { type:'TTWALK', gate:'AND', walk:true, title }
//   { type:'TTWALK', walk:true, inputs:['A','B'],
//     cols:[ { label:'NOT B', op:'NOT', of:'B' },
//            { label:'Q', op:'AND', a:'A', b:'NOT B' } ], title }
// ============================================================

function mk(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

function evalGate(op, a, b) {
  if (op === 'AND') return (a && b) ? 1 : 0;
  if (op === 'OR') return (a || b) ? 1 : 0;
  if (op === 'XOR') return (a !== b) ? 1 : 0;
  return a ? 0 : 1;   // NOT (of a)
}

export const ttwalk = {
  type: 'TTWALK',

  render(host, question, ctx) {
    host.innerHTML = '';

    // ── resolve the schema into inputs + computed columns ──
    let inputs = question.inputs;
    let cols = question.cols;
    if (question.gate) {
      if (question.gate === 'NOT') { inputs = ['A']; cols = [{ label: 'Q', op: 'NOT', of: 'A' }]; }
      else { inputs = ['A', 'B']; cols = [{ label: 'Q', op: question.gate, a: 'A', b: 'B' }]; }
    }
    inputs = inputs || ['A', 'B'];

    // input rows, in binary counting order
    const n = inputs.length, rows = [];
    for (let i = 0; i < (1 << n); i++) { const r = []; for (let b = n - 1; b >= 0; b--) r.push((i >> b) & 1); rows.push(r); }

    // evaluate every computed column for every row
    const colVals = cols.map(() => []);
    rows.forEach((r, ri) => {
      const env = {}; inputs.forEach((nm, i) => { env[nm] = r[i]; });
      cols.forEach((col, ci) => {
        const v = col.op === 'NOT' ? (env[col.of] ? 0 : 1) : evalGate(col.op, env[col.a], env[col.b]);
        env[col.label] = v; colVals[ci][ri] = v;
      });
    });

    function noteFor(ci, ri) {
      const col = cols[ci];
      const env = {}; inputs.forEach((nm, i) => { env[nm] = rows[ri][i]; });
      cols.forEach((c, idx) => { if (idx < ci) env[c.label] = colVals[idx][ri]; });
      const v = colVals[ci][ri];
      if (col.op === 'NOT') return `<b>Row ${ri + 1} · ${col.label}</b>: NOT just flips <b>${col.of}</b> — ${env[col.of]} becomes <b>${v}</b>.`;
      const av = env[col.a], bv = env[col.b];
      if (col.op === 'AND') return `<b>Row ${ri + 1} · ${col.label}</b>: are <b>${col.a}</b> AND <b>${col.b}</b> both 1? ${av} and ${bv} → ${v ? 'yes, both are' : 'no'} → write <b>${v}</b>.`;
      if (col.op === 'OR') return `<b>Row ${ri + 1} · ${col.label}</b>: is <b>${col.a}</b> OR <b>${col.b}</b> at least one 1? ${av} and ${bv} → ${v ? 'yes' : 'no, both 0'} → write <b>${v}</b>.`;
      return `<b>Row ${ri + 1} · ${col.label}</b>: do <b>${col.a}</b> and <b>${col.b}</b> DIFFER? ${av} and ${bv} → ${v ? 'yes, different' : 'no, the same'} → write <b>${v}</b>.`;
    }

    // walk order: column by column (left → right), row by row within
    const order = [];
    cols.forEach((c, ci) => rows.forEach((r, ri) => order.push([ci, ri])));

    // ── render the table ──
    const wrap = mk('tw');
    const table = mk('tw-table');
    const head = mk('tw-row tw-head');
    inputs.forEach(nm => { head.appendChild(mk('tw-cell tw-in-h')).textContent = nm; });
    cols.forEach((c, ci) => { head.appendChild(mk('tw-cell ' + (ci === cols.length - 1 ? 'tw-qh' : 'tw-wch'))).textContent = c.label; });
    table.appendChild(head);

    const cellEls = cols.map(() => []);
    rows.forEach((r, ri) => {
      const rowEl = mk('tw-row');
      r.forEach(v => { rowEl.appendChild(mk('tw-cell tw-in')).textContent = String(v); });
      cols.forEach((c, ci) => {
        const cell = mk('tw-cell tw-c' + (ci === cols.length - 1 ? '' : ' tw-wc'));
        cell.textContent = '·';
        rowEl.appendChild(cell);
        cellEls[ci][ri] = cell;
      });
      table.appendChild(rowEl);
    });
    wrap.appendChild(table);

    const note = mk('tw-note');
    note.innerHTML = cols.length === 1
      ? 'The gate asks its <b>one question</b> of every input row. Press <b>NEXT STEP</b> to watch.'
      : 'Fill the <b>working column</b> for every row first, <b>then</b> combine into Q. Press <b>NEXT STEP</b> to watch.';
    wrap.appendChild(note);

    const btn = mk('tw-next', 'button');
    btn.type = 'button'; btn.textContent = '▶ NEXT STEP';
    let pos = 0, done = false, lastCell = null;
    btn.addEventListener('click', () => {
      if (done) return;
      if (lastCell) lastCell.classList.remove('tw-hot');
      if (pos < order.length) {
        const [ci, ri] = order[pos];
        const cell = cellEls[ci][ri], v = colVals[ci][ri];
        cell.textContent = String(v);
        cell.classList.add(v ? 'tw-one' : 'tw-zero', 'tw-hot');
        lastCell = cell;
        note.innerHTML = noteFor(ci, ri);
        (ctx.sfx.uiClick || ctx.sfx.bitClick)();
        pos++;
        if (pos === order.length) btn.textContent = '▶ FINISH';
        return;
      }
      done = true; btn.disabled = true; btn.textContent = '✓ TABLE COMPLETE';
      note.innerHTML = cols.length === 1
        ? 'Every row answered the same question — the gate\'s <b>entire behaviour</b>, captured in one table.'
        : 'Working column first, then combined into Q — that\'s how every bracketed expression is done.';
      ctx.sfx.zap();
      ctx.onSubmit(true);
    });
    wrap.appendChild(btn);
    host.appendChild(wrap);
  },
};
