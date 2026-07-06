// ============================================================
// questions/stepadd.js — STEPADD: a step-through binary-addition walkthrough.
//
// Not a graded question — a guided demo the student clicks through one
// column at a time (right to left, British column layout with the carry
// written BELOW the line). Each step reveals that column's sum bit, any
// carry, and a plain-English note explaining WHY. When the walkthrough is
// finished it reports done (ctx.onSubmit(true)) so the lesson can continue.
//
// Supports an optional THIRD operand `c` (AQA adds up to three binary
// numbers) — a column of three 1s plus an incoming carry can total 4, so the
// carry out of a column can be 2, not just 1.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(true) when finished
//
// Question schema:
//   { type:'STEPADD', a:[0,1,0,1], b:[0,0,1,1], c?:[…], walk:true, title }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const stepadd = {
  type: 'STEPADD',

  render(host, question, ctx) {
    host.innerHTML = '';
    const a = question.a.slice(), b = question.b.slice();
    const c = question.c ? question.c.slice() : null;
    const operands = c ? [a, b, c] : [a, b];
    const n = a.length;

    // work each column out right -> left
    const cols = []; let carry = 0;
    for (let i = n - 1; i >= 0; i--) {
      const total = operands.reduce((t, op) => t + op[i], 0) + carry;
      const bit = total & 1, carryOut = total >> 1;
      const terms = operands.map(op => String(op[i]));
      if (carry) terms.push(carry === 1 ? 'the carried 1' : `the carried ${carry}`);
      let note = `<b>Column ${n - i}</b> (from the right): ${terms.join(' + ')} = <b>${total}</b>`;
      if (total >= 2) {
        note += i === 0
          ? ` — that's <b>${total.toString(2)}</b>, so write <b>${bit}</b> and carry <b>${carryOut}</b> — but there is <b>no next column</b> for it to go into!`
          : ` — that's <b>${total.toString(2)}</b> in binary, so write <b>${bit}</b> and carry <b>${carryOut}</b> into the next column.`;
      } else {
        note += ` — nothing to carry, so just write <b>${bit}</b>.`;
      }
      cols.push({ i, bit, carryIn: carry, note });
      carry = carryOut;
    }
    const overflow = carry !== 0;   // a carry out of the top column has nowhere to go
    const sumBits = new Array(n); cols.forEach(cl => { sumBits[cl.i] = cl.bit; });
    const val = arr => arr.reduce((s, x, k) => s + (x ? 1 << (n - 1 - k) : 0), 0);
    const opVals = operands.map(val);
    const denSum = opVals.reduce((s, v) => s + v, 0);
    const sumStr = sumBits.join(''), resultVal = val(sumBits);

    const wrap = el('sa');
    const grid = el('sa-grid');
    grid.style.gridTemplateColumns = `46px repeat(${n}, 34px)`;
    const label = txt => { const l = el('sa-label'); l.textContent = txt; grid.appendChild(l); };
    const fixed = (arr, lbl) => { label(lbl); const cs = []; arr.forEach(v => { const cc = el('sa-cell sa-fixed'); cc.textContent = v; grid.appendChild(cc); cs.push(cc); }); return cs; };
    const opCells = operands.map((op, oi) => fixed(op, oi === 0 ? 'A' : '+ ' + String.fromCharCode(65 + oi)));
    const rule = el('sa-rule'); rule.style.gridColumn = '1 / -1'; grid.appendChild(rule);
    label('sum'); const sumCells = a.map(() => { const cc = el('sa-cell sa-sum'); grid.appendChild(cc); return cc; });
    label('carry'); const carryCells = a.map(() => { const cc = el('sa-cell sa-carry'); grid.appendChild(cc); return cc; });
    wrap.appendChild(grid);

    const note = el('sa-note');
    note.innerHTML = 'Click <b>NEXT STEP</b> to add it up one column at a time, starting from the right.';
    wrap.appendChild(note);
    const btn = el('sa-next', 'button'); btn.type = 'button'; btn.textContent = 'NEXT STEP →';
    wrap.appendChild(btn);
    host.appendChild(wrap);

    let step = 0;
    const clearCur = () => grid.querySelectorAll('.sa-cur').forEach(cc => cc.classList.remove('sa-cur'));
    btn.addEventListener('click', () => {
      if (step >= cols.length) return;
      const col = cols[step], ci = col.i;
      clearCur();
      opCells.forEach(cells => cells[ci].classList.add('sa-cur'));
      sumCells[ci].textContent = String(col.bit); sumCells[ci].classList.add('on', 'sa-cur');
      if (col.carryIn) { carryCells[ci].textContent = String(col.carryIn); carryCells[ci].classList.add('on'); }
      note.innerHTML = col.note;
      (ctx.sfx.uiClick || ctx.sfx.bitClick)();
      step++;
      if (step >= cols.length) {
        note.innerHTML = col.note + (overflow
          ? `<div class="sa-done sa-overflow">⚠ The carry out of the top column has <b>nowhere to go</b> — there is no 9th bit, so it is <b>lost</b>. That is <b>overflow</b>: ${opVals.join(' + ')} = ${denSum}, but a byte only holds 0–255, so the answer wraps to <b>${sumStr}</b> = ${resultVal}.</div>`
          : `<div class="sa-done">Answer: <b>${sumStr}</b> = ${denSum}. &nbsp;Check in denary: ${opVals.join(' + ')} = ${denSum} ✓</div>`);
        btn.textContent = '✓ COMPLETE'; btn.disabled = true;
        if (ctx.sfx.zap) ctx.sfx.zap();
        ctx.onSubmit(true);
      }
    });
  },
};
