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
//     badge, board, title, desc, hints, explain }
// ============================================================

function mk(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const bitmap = {
  type: 'BITMAP',

  render(host, question, ctx) {
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
