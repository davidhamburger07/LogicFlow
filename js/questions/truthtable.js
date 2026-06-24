// ============================================================
// questions/truthtable.js — TRUTHTABLE: complete a gate/expression's
// output column by toggling Q for each input row. The exam-accurate
// "complete the truth table" skill — you produce the column, not pick it.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'TRUTHTABLE', inputs:['A','B'],
//     rows:[[0,0],[0,1],[1,0],[1,1]], answer:[0,0,1,0],   // Q per row
//     title:'Complete the truth table for Q = A AND (NOT B).',
//     badge, board, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const truthtable = {
  type: 'TRUTHTABLE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const rows = question.rows;
    const answer = question.answer;
    const inputs = question.inputs || ['A', 'B'];
    const user = new Array(rows.length).fill(0);

    const wrap = el('tt');
    const table = el('tt-table');
    const head = el('tt-row tt-head');
    inputs.forEach(h => { head.appendChild(el('tt-cell tt-in')).textContent = h; });
    head.appendChild(el('tt-cell tt-qh')).textContent = 'Q';
    table.appendChild(head);

    const cells = [];
    rows.forEach((r, i) => {
      const row = el('tt-row');
      r.forEach(v => { row.appendChild(el('tt-cell tt-in')).textContent = String(v); });
      const q = el('tt-cell tt-q', 'button');
      q.type = 'button'; q.textContent = '0';
      q.addEventListener('click', () => {
        if (ctx.isAnswered()) return;
        user[i] ^= 1;
        q.textContent = String(user[i]);
        q.classList.toggle('on', !!user[i]);
        (ctx.sfx.bitClick || ctx.sfx.uiClick)();
      });
      cells.push(q);
      row.appendChild(q);
      table.appendChild(row);
    });
    wrap.appendChild(table);
    wrap.appendChild(el('tt-hint-line')).textContent = 'Tap each Q to set it to 0 or 1.';

    const submit = el('tt-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK →';
    submit.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      const correct = user.every((v, i) => v === answer[i]);
      cells.forEach((c, i) => { c.disabled = true; if (user[i] !== answer[i]) c.classList.add('tt-bad'); });
      submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `The correct Q column is ${answer.join(', ')}.` });
    });
    wrap.appendChild(submit);
    host.appendChild(wrap);
  },
};