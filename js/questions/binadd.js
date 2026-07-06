// ============================================================
// questions/binadd.js — BINADD: binary addition on a carry-row canvas.
//
// Two modes:
//   • LEGACY (default, two operands, no enforceCarry): fill the sum row; the
//     carry row is an optional scratch aid, only the sum is marked. Kept
//     byte-for-byte so two's-complement add/subtract (flipadd / binsub, which
//     call binadd.render with {a,b}) are unaffected — there the carry OUT of
//     the MSB is discarded by design, so it must NOT be flagged as "overflow".
//   • ENFORCED (enforceCarry:true, or a 3rd operand `c` for AQA): the CARRY row
//     is graded too, so the column method is practised not bypassed. Carry
//     cells are numeric (a column of three 1s + a carry can total 4 → write 0,
//     carry 2), and a 9th "overflow bit" sits OUTSIDE the 8-bit register — set
//     it when the top column carries out, and it lights red / is lost.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'BINADD', a:[…], b:[…], c?:[…],   // MSB-first operand bits
//     enforceCarry?:bool, badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

// expected carry-INTO each column (right→left) + result bits + carry out of MSB
function addColumns(operands, n) {
  const carryInto = new Array(n).fill(0);
  const result = new Array(n).fill(0);
  let carry = 0;
  for (let i = n - 1; i >= 0; i--) {
    carryInto[i] = carry;
    const s = operands.reduce((t, op) => t + op[i], 0) + carry;
    result[i] = s & 1;
    carry = s >> 1;
  }
  return { carryInto, result, ovfCarry: carry };
}

export const binadd = {
  type: 'BINADD',

  render(host, question, ctx) {
    host.innerHTML = '';
    const a = question.a.slice();
    const b = question.b.slice();
    const c = question.c ? question.c.slice() : null;
    const operands = c ? [a, b, c] : [a, b];
    const n = a.length;
    const enforce = !!question.enforceCarry || operands.length >= 3;
    if (enforce) renderEnforced(host, question, ctx, operands, n);
    else renderLegacy(host, question, ctx, operands, n);
  },
};

// ── LEGACY path (unchanged) — two operands, grade the SUM only ──────────────
function renderLegacy(host, question, ctx, operands, n) {
  const { result, ovfCarry } = addColumns(operands, n);
  const [a, b] = operands;
  const userCarry = new Array(n).fill(0);
  const userSum = new Array(n).fill(0);

  const wrap = el('ba');
  const grid = el('ba-grid');
  grid.style.gridTemplateColumns = '44px repeat(' + n + ', minmax(0, 1fr))';
  const label = txt => { const l = el('ba-label'); l.textContent = txt; grid.appendChild(l); };
  const toggle = (arr, i, cls) => {
    const cc = el('ba-cell ba-toggle ' + cls, 'button');
    cc.type = 'button'; cc.textContent = '0'; cc.dataset.col = String(i);
    cc.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      arr[i] ^= 1; cc.textContent = String(arr[i]); cc.classList.toggle('on', !!arr[i]);
      (ctx.sfx.bitClick || ctx.sfx.uiClick)();
    });
    return cc;
  };
  const fixed = v => { const cc = el('ba-cell ba-fixed'); cc.textContent = String(v); return cc; };
  const rule = () => { const r = el('ba-rule'); r.style.gridColumn = '1 / -1'; return r; };

  label('A'); a.forEach(v => grid.appendChild(fixed(v)));
  label('+ B'); b.forEach(v => grid.appendChild(fixed(v)));
  grid.appendChild(rule());
  label('sum'); for (let i = 0; i < n; i++) grid.appendChild(toggle(userSum, i, 'ba-sum'));
  label('carry'); for (let i = 0; i < n; i++) grid.appendChild(toggle(userCarry, i, 'ba-carry'));
  wrap.appendChild(grid);
  wrap.appendChild(el('ba-hint-line')).textContent = 'Work right → left, carrying below the line. The carry row is a scratch aid — only the SUM is marked.';

  const submit = el('ba-submit', 'button');
  submit.type = 'button'; submit.textContent = 'CHECK →';
  submit.addEventListener('click', () => {
    if (ctx.isAnswered()) return;
    const correct = userSum.every((v, i) => v === result[i]);
    grid.querySelectorAll('button').forEach(x => { x.disabled = true; });
    submit.disabled = true;
    if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
    const fb = `Check the sum — the result is ${result.join('')}${ovfCarry ? ' (with overflow — a carry out of the top bit)' : ''}.`;
    ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: fb });
  });
  wrap.appendChild(submit);
  host.appendChild(wrap);
}

// ── ENFORCED path — grade the carry row too; support 3 operands + overflow ──
function renderEnforced(host, question, ctx, operands, n) {
  const k = operands.length;
  const maxCarry = k >= 3 ? 2 : 1;              // three 1s + a carry can total 4 → carry 2
  const { carryInto, result, ovfCarry } = addColumns(operands, n);
  // a 9th bit sits outside the 8-bit register — EXCEPT in two's-complement
  // add/subtract, where the carry out of the MSB is discarded by design (not
  // an overflow error), so callers pass hideOverflow to suppress it.
  const showOvf = !question.hideOverflow;

  const userSum = new Array(n).fill(0);
  const userCarry = new Array(n).fill(0);
  const userOvf = [0];
  const sumCells = [], carryCells = []; let ovfCell = null;

  const wrap = el('ba ba-enforced'); wrap.dataset.enforce = '1';
  const grid = el('ba-grid');
  grid.style.gridTemplateColumns = (showOvf ? '44px 30px ' : '44px ') + `repeat(${n}, minmax(0, 1fr))`;

  const label = txt => { const l = el('ba-label'); l.textContent = txt; grid.appendChild(l); };
  const spacer = () => grid.appendChild(el('ba-cell ba-spacer'));
  const fixed = v => { const cc = el('ba-cell ba-fixed'); cc.textContent = String(v); grid.appendChild(cc); return cc; };
  // a tap-to-cycle numeric cell (0 → 1 → … → maxVal → 0)
  const cycleCell = (cls, arr, i, maxVal, onChange) => {
    const cc = el('ba-cell ba-toggle ' + cls, 'button');
    cc.type = 'button'; cc.textContent = '0'; cc.dataset.col = String(i);
    cc.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      arr[i] = (arr[i] + 1) % (maxVal + 1);
      cc.textContent = String(arr[i]);
      cc.classList.toggle('on', arr[i] > 0);
      cc.classList.remove('ba-ok', 'ba-bad');
      (ctx.sfx.bitClick || ctx.sfx.uiClick)();
      if (onChange) onChange();
    });
    grid.appendChild(cc); return cc;
  };

  // operand rows: A, + B, (+ C)
  operands.forEach((op, oi) => {
    label(oi === 0 ? 'A' : '+ ' + String.fromCharCode(65 + oi));
    if (showOvf) spacer();
    op.forEach(v => fixed(v));
  });
  const rule = el('ba-rule'); rule.style.gridColumn = '1 / -1'; grid.appendChild(rule);
  // sum row — the 9th cell is the overflow bit (outside the register)
  label('sum');
  if (showOvf) ovfCell = cycleCell('ba-ovf', userOvf, 0, 1, paintOvf);
  for (let i = 0; i < n; i++) sumCells.push(cycleCell('ba-sum', userSum, i, 1));
  // carry row (below the line) — nothing carries INTO the units column
  label('carry');
  if (showOvf) spacer();
  for (let i = 0; i < n; i++) {
    if (i === n - 1) { spacer(); continue; }
    carryCells.push(cycleCell('ba-carry', userCarry, i, maxCarry));
  }
  wrap.appendChild(grid);

  const caption = el('ba-hint-line');
  caption.innerHTML = showOvf
    ? 'Fill the <b>carry row</b> and the <b>sum</b>, right → left. The dashed cell is a <b>9th bit — outside the 8-bit register</b>: set it if the top column carries out.'
    : 'Fill the carry row and the sum, working right → left.';
  wrap.appendChild(caption);

  const ovfMsg = el('ba-ovf-msg'); ovfMsg.style.display = 'none'; wrap.appendChild(ovfMsg);
  function paintOvf() {
    const on = userOvf[0] > 0;
    ovfMsg.style.display = on ? 'block' : 'none';
    if (on) ovfMsg.innerHTML = '⚠ <b>OVERFLOW</b> — that carry needs a <b>9th bit</b>, but an 8-bit register only has 8. The bit is <b>lost</b>, so the value wraps around.';
  }

  const fb = el('ba-fb'); wrap.appendChild(fb);
  const submit = el('ba-submit', 'button');
  submit.type = 'button'; submit.textContent = 'CHECK →';
  submit.addEventListener('click', check);
  wrap.appendChild(submit);
  host.appendChild(wrap);

  // forgiving: flag wrong cells, retry until the whole addition is right
  function check() {
    if (ctx.isAnswered()) return;
    let ok = true;
    const mark = (cell, good) => { cell.classList.toggle('ba-ok', good); cell.classList.toggle('ba-bad', !good); if (!good) ok = false; };
    sumCells.forEach((cell, i) => mark(cell, userSum[i] === result[i]));
    carryCells.forEach(cell => { const i = Number(cell.dataset.col); mark(cell, userCarry[i] === carryInto[i]); });
    if (showOvf) mark(ovfCell, userOvf[0] === ovfCarry);
    if (ok) {
      grid.querySelectorAll('button').forEach(x => { x.disabled = true; });
      submit.disabled = true;
      fb.className = 'ba-fb ba-fb-ok';
      fb.innerHTML = (showOvf && ovfCarry) ? `✓ Correct — and the 9th bit overflowed, so the byte wrapped to <b>${result.join('')}</b>.` : `✓ Correct — <b>${result.join('')}</b>.`;
      ctx.sfx.zap(); ctx.onSubmit(true);
    } else {
      fb.className = 'ba-fb ba-fb-no';
      fb.textContent = 'Not quite — the red cells are wrong. Add each column right → left and carry any overflow into the next column.';
      ctx.sfx.wrong();
    }
  }
}
