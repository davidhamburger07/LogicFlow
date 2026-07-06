// ============================================================
// questions/hexread.js — HEXREAD: watch a hex number read to denary,
// one digit at a time, with a "why" note at every step.
//
// A guided, non-graded walkthrough (like BINREAD / STEPADD). NEXT STEP moves
// left → right along the hex digits: each digit's value (A=10 … F=15) is
// multiplied by its column place value (… 256 16 1) and added to a running
// total, and each step explains itself. Finishing calls ctx.onSubmit(true) so
// the lesson's NEXT ungates — author with walk:true for the "▶ STEP THROUGH IT"
// badge. Reuses the .br-* styles from BINREAD (same read-to-denary shape).
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(true)
//
// Question schema:  { type:'HEXREAD', digits:'2A', walk:true, title }
// ============================================================

function mk(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const hexread = {
  type: 'HEXREAD',

  render(host, question, ctx) {
    host.innerHTML = '';
    const digits = String(question.digits).toUpperCase().split('');
    const n = digits.length;
    const HEX = '0123456789ABCDEF';
    const valOf = ch => HEX.indexOf(ch);
    const placeOf = i => Math.pow(16, n - 1 - i);

    const wrap = mk('br');
    const grid = mk('br-grid');
    const pvRow = mk('br-row');
    const digRow = mk('br-row');
    const cells = [];
    digits.forEach((ch, i) => {
      const v = valOf(ch), P = placeOf(i);
      const pv = mk('br-pv'); pv.textContent = String(P); pvRow.appendChild(pv);
      const dc = mk('br-bit' + (v ? ' lit' : '')); dc.textContent = ch; digRow.appendChild(dc);
      cells.push({ pv, dc, i, v, P });
    });
    grid.append(pvRow, digRow);
    wrap.appendChild(grid);

    const sumLine = mk('br-sum'); sumLine.innerHTML = 'running total: <b>0</b>'; wrap.appendChild(sumLine);
    const note = mk('br-note'); note.innerHTML = 'Read <b>left → right</b>: turn each digit into its value (A = 10 … F = 15), multiply by its column, and add it on. Press <b>NEXT STEP</b>.'; wrap.appendChild(note);

    const btn = mk('br-next', 'button'); btn.type = 'button'; btn.textContent = '▶ NEXT STEP';
    let pos = 0, total = 0, done = false;
    btn.addEventListener('click', () => {
      if (done) return;
      if (pos > 0) { cells[pos - 1].pv.classList.remove('hot'); cells[pos - 1].dc.classList.remove('hot'); }
      if (pos < n) {
        const { pv, dc, v, P } = cells[pos];
        pv.classList.add('hot'); dc.classList.add('hot');
        const contrib = v * P;
        total += contrib;
        if (contrib) dc.classList.add('added');
        const colName = P === 1 ? 'units' : P + 's';
        const asVal = v >= 10 ? `digit <b>${dc.textContent}</b> means <b>${v}</b>, so ` : '';
        note.innerHTML = `Column ${pos + 1} (the ${colName} column): ${asVal}${v} × ${P} = <b>${contrib}</b>. Running total = <b>${total}</b>.`;
        sumLine.innerHTML = `running total: <b>${total}</b>`;
        (ctx.sfx.uiClick || ctx.sfx.bitClick)();
        pos++;
        if (pos === n) btn.textContent = '▶ FINISH';
        return;
      }
      done = true; btn.disabled = true; btn.textContent = '✓ DONE';
      note.innerHTML = `Add every column and you have the answer: hex <b>${digits.join('')}</b> is <b>${total}</b> in denary.`;
      sumLine.innerHTML = `= <b>${total}</b>`;
      ctx.sfx.zap();
      ctx.onSubmit(true);
    });
    wrap.appendChild(btn);
    host.appendChild(wrap);
  },
};
