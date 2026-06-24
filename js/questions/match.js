// ============================================================
// questions/match.js — MATCH: match each item to its correct partner.
//
// A rotating recall format for pairings: protocols -> their jobs, terms ->
// definitions, keys -> roles. Each left item gets a dropdown of the right
// options; CHECK marks each row and you must match them all.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'MATCH', pairs:[ {left:'SMTP', right:'Send email to a server'}, … ],
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const match = {
  type: 'MATCH',

  render(host, question, ctx) {
    host.innerHTML = '';
    const pairs = question.pairs;
    const rights = pairs.map(p => p.right).slice().sort(() => Math.random() - 0.5);

    const wrap = el('mt');
    const rows = pairs.map(p => {
      const row = el('mt-row');
      row.appendChild(el('mt-left')).textContent = p.left;
      const sel = document.createElement('select');
      sel.className = 'mt-sel';
      const blank = document.createElement('option');
      blank.value = ''; blank.textContent = '— choose —';
      sel.appendChild(blank);
      rights.forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = r; sel.appendChild(o); });
      sel.addEventListener('change', () => { (ctx.sfx.uiClick || ctx.sfx.bitClick)(); });
      row.appendChild(sel);
      return { row, sel, p };
    });
    rows.forEach(r => wrap.appendChild(r.row));

    const submit = el('mt-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK →';
    submit.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      if (rows.some(r => !r.sel.value)) { submit.classList.remove('mt-shake'); void submit.offsetWidth; submit.classList.add('mt-shake'); return; }
      const correct = rows.every(r => r.sel.value === r.p.right);
      rows.forEach(r => { r.sel.disabled = true; r.row.classList.add(r.sel.value === r.p.right ? 'mt-ok' : 'mt-bad'); });
      submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: 'Check the marked rows — match each item to its correct partner.' });
    });
    wrap.appendChild(submit);
    host.appendChild(wrap);
  },
};
