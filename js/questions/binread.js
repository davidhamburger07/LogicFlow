// ============================================================
// questions/binread.js — BINREAD: watch a binary number read to denary,
// one place value at a time, with a "why" note at every step.
//
// A guided, non-graded walkthrough (like STEPADD / TTWALK). NEXT STEP moves
// left → right along the columns: a lit bit adds its place value to a running
// total, a 0 is skipped, and each step explains itself. Finishing calls
// ctx.onSubmit(true) so the lesson's NEXT ungates — author with walk:true for
// the "▶ STEP THROUGH IT" badge. Supports signed (two's complement) numbers,
// where the leftmost place value is negative — so it is reusable across Unit 1.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(true)
//
// Question schema:  { type:'BINREAD', bits:[1,1,0,1], signed?:false, walk:true, title }
// ============================================================

function mk(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const binread = {
  type: 'BINREAD',

  render(host, question, ctx) {
    host.innerHTML = '';
    const bits = question.bits.slice();
    const n = bits.length;
    const placeOf = i => { const p = 1 << (n - 1 - i); return (question.signed && i === 0) ? -p : p; };

    const wrap = mk('br');
    const grid = mk('br-grid');
    const pvRow = mk('br-row');
    const bitRow = mk('br-row');
    const cells = [];
    bits.forEach((b, i) => {
      const pv = mk('br-pv' + (placeOf(i) < 0 ? ' br-neg' : '')); pv.textContent = placeOf(i); pvRow.appendChild(pv);
      const bc = mk('br-bit' + (b ? ' lit' : '')); bc.textContent = String(b); bitRow.appendChild(bc);
      cells.push({ pv, bc, i });
    });
    grid.append(pvRow, bitRow);
    wrap.appendChild(grid);

    const sumLine = mk('br-sum'); sumLine.innerHTML = 'running total: <b>0</b>'; wrap.appendChild(sumLine);
    const note = mk('br-note'); note.innerHTML = 'Read <b>left → right</b>: add each place value that has a <b>1</b> under it. Press <b>NEXT STEP</b>.'; wrap.appendChild(note);

    const btn = mk('br-next', 'button'); btn.type = 'button'; btn.textContent = '▶ NEXT STEP';
    let pos = 0, total = 0, done = false;
    btn.addEventListener('click', () => {
      if (done) return;
      if (pos > 0) { cells[pos - 1].pv.classList.remove('hot'); cells[pos - 1].bc.classList.remove('hot'); }
      if (pos < n) {
        const { pv, bc, i } = cells[pos];
        pv.classList.add('hot'); bc.classList.add('hot');
        const P = placeOf(i), b = bits[i];
        if (b) { total += P; bc.classList.add('added'); note.innerHTML = `Column ${pos + 1}: place value <b>${P}</b>, bit is <b>1</b> → add ${P}. Running total = <b>${total}</b>.`; }
        else { note.innerHTML = `Column ${pos + 1}: place value <b>${P}</b>, bit is <b>0</b> → skip it. Running total stays <b>${total}</b>.`; }
        sumLine.innerHTML = `running total: <b>${total}</b>`;
        (ctx.sfx.uiClick || ctx.sfx.bitClick)();
        pos++;
        if (pos === n) btn.textContent = '▶ FINISH';
        return;
      }
      done = true; btn.disabled = true; btn.textContent = '✓ DONE';
      note.innerHTML = `Add every lit place value and you have the answer: this binary number is <b>${total}</b> in denary.`;
      sumLine.innerHTML = `= <b>${total}</b>`;
      ctx.sfx.zap();
      ctx.onSubmit(true);
    });
    wrap.appendChild(btn);
    host.appendChild(wrap);
  },
};
