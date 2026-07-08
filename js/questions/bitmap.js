// ============================================================
// questions/bitmap.js — BITMAP: paint the 1-bit image its bytes describe.
//
// The exam-classic bitmap task: each row of the image is given as a
// binary string (1 = black pixel, 0 = white); the student clicks the
// pixels of an empty grid to reproduce the image, row by row. CHECK
// marks it — wrong pixels are outlined so the mistake can be seen.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'BITMAP', rows:[[0,0,1,1,0,0], [0,1,1,1,1,0], …],
//     walk?:true,   // WATCH mode: NEXT ROW paints each line for the student, with narration
//     badge, board, title, desc, hints, explain }
// ============================================================

function mk(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const bitmap = {
  type: 'BITMAP',

  render(host, question, ctx) {
    if (question.walk) return renderWalk(host, question, ctx);
    host.innerHTML = '';
    const rows = question.rows.map(r => r.slice());

    const wrap = mk('bm');
    wrap.appendChild(mk('bm-note')).textContent = '1 = black pixel · 0 = white — click the grid to paint each row';

    const body = mk('bm-body');
    const cells = [];   // [row][col] -> { btn, on }
    rows.forEach((r, ri) => {
      const rowEl = mk('bm-row');
      rowEl.appendChild(mk('bm-bits', 'span')).textContent = r.join('');
      const px = mk('bm-pixels');
      const rowCells = r.map((bit, ci) => {
        const btn = mk('bm-px', 'button');
        btn.type = 'button';
        btn.setAttribute('aria-label', `pixel row ${ri + 1}, column ${ci + 1}`);
        const cell = { btn, on: false };
        btn.addEventListener('click', () => {
          if (ctx.isAnswered()) return;
          cell.on = !cell.on;
          btn.classList.toggle('on', cell.on);
          (ctx.sfx.bitClick || ctx.sfx.uiClick)(cell.on);
        });
        px.appendChild(btn);
        return cell;
      });
      rowEl.appendChild(px);
      body.appendChild(rowEl);
      cells.push(rowCells);
    });
    wrap.appendChild(body);

    const submit = mk('bm-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK IMAGE →';
    submit.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      let correct = true;
      let firstBadRow = -1;
      cells.forEach((rowCells, ri) => rowCells.forEach((cell, ci) => {
        const ok = cell.on === (rows[ri][ci] === 1);
        if (!ok) {
          cell.btn.classList.add('bad');
          correct = false;
          if (firstBadRow < 0) firstBadRow = ri + 1;
        }
      }));
      cells.flat().forEach(c => { c.btn.disabled = true; });
      submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : {
        feedbackOnWrong: `Check row ${firstBadRow} against its byte — every 1 is a black pixel, every 0 stays white (the wrong pixels are outlined).`,
      });
    });
    wrap.appendChild(submit);
    host.appendChild(wrap);
  },
};

// WATCH mode — the same layout, but a NEXT ROW button paints each line for the
// student with narration, so they see exactly how bits become pixels before
// they do it themselves. Non-failable; completing it submits correct.
function renderWalk(host, question, ctx) {
  host.innerHTML = '';
  const rows = question.rows;
  let pos = 0, busy = false;

  const wrap = mk('bm bm-walk');
  const say = mk('bm-say');
  say.innerHTML = 'Each row of bits paints one line of the image: <b>1 = fill the pixel</b>, <b>0 = skip it</b>. Press <b>NEXT ROW</b> and watch.';
  wrap.appendChild(say);

  const body = mk('bm-body');
  const rowEls = rows.map((r, ri) => {
    const rowEl = mk('bm-row');
    rowEl.appendChild(mk('bm-bits', 'span')).textContent = r.join('');
    const px = mk('bm-pixels');
    const cells = r.map((bit, ci) => {
      const b = mk('bm-px', 'button'); b.type = 'button'; b.disabled = true;
      b.setAttribute('aria-label', `pixel row ${ri + 1}, column ${ci + 1}`);
      px.appendChild(b); return b;
    });
    rowEl.appendChild(px);
    body.appendChild(rowEl);
    return { rowEl, cells };
  });
  wrap.appendChild(body);

  const next = mk('bm-next', 'button');
  next.type = 'button'; next.textContent = '▶ NEXT ROW';
  next.addEventListener('click', () => {
    if (busy || pos >= rows.length) return;
    busy = true;
    const r = rows[pos], { rowEl, cells } = rowEls[pos];
    rowEls.forEach(({ rowEl: el2 }) => el2.classList.remove('bm-cur'));
    rowEl.classList.add('bm-cur');
    const ones = r.map((b, i) => b ? i + 1 : 0).filter(Boolean);
    say.innerHTML = `Row ${pos + 1} — <b>${r.join(' ')}</b>: `
      + (ones.length ? `fill pixel${ones.length > 1 ? 's' : ''} <b>${ones.join(', ')}</b>, skip the rest.` : 'all zeros — nothing to fill.');
    // paint the 1-pixels left → right with a little stagger
    r.forEach((bit, ci) => { if (bit) setTimeout(() => { cells[ci].classList.add('on'); (ctx.sfx.bitClick || ctx.sfx.uiClick)(true); }, 120 + ci * 110); });
    setTimeout(() => {
      busy = false; pos++;
      if (pos >= rows.length) {
        rowEl.classList.remove('bm-cur');
        say.innerHTML = '✓ Every 1 became a black pixel, row by row — <b>that\'s all a bitmap is</b>. Your turn next.';
        next.textContent = '✓ DONE'; next.disabled = true;
        ctx.sfx.zap();
        ctx.onSubmit(true, {});
      }
    }, 200 + r.length * 110);
  });
  wrap.appendChild(next);
  host.appendChild(wrap);
}
