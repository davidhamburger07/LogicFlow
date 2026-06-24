// ============================================================
// questions/categorise.js — CATEGORISE: sort items into groups.
//
// A rotating recall format: classify each item into one of the named
// bins (e.g. storage -> magnetic / optical / solid-state; software ->
// OS function / utility; compression -> lossy / lossless). Each item
// picks its group; CHECK marks every row and reveals the correct group.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'CATEGORISE', bins:['Magnetic','Optical','Solid-state'],
//     items:[ {text:'Hard disk drive', bin:'Magnetic'},
//             {text:'CD',  bin:'Optical'},
//             {text:'SSD', bin:'Solid-state'} ],
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const categorise = {
  type: 'CATEGORISE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const bins = question.bins.slice();
    const items = question.items.map(it => ({ text: it.text, bin: it.bin, chosen: null }));

    const wrap = el('cg');
    const list = el('cg-list');
    const rows = items.map(it => {
      const row = el('cg-row');
      row.appendChild(el('cg-item')).textContent = it.text;
      const opts = el('cg-opts');
      bins.forEach(b => {
        const btn = el('cg-bin', 'button'); btn.type = 'button'; btn.textContent = b;
        btn.addEventListener('click', () => {
          if (ctx.isAnswered()) return;
          it.chosen = b;
          opts.querySelectorAll('.cg-bin').forEach(x => x.classList.toggle('on', x.textContent === b));
          (ctx.sfx.uiClick || ctx.sfx.bitClick)();
        });
        opts.appendChild(btn);
      });
      row.appendChild(opts);
      list.appendChild(row);
      return { row, opts };
    });
    wrap.appendChild(list);

    const submit = el('cg-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK →';
    submit.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      if (items.some(it => it.chosen === null)) { submit.classList.remove('cg-shake'); void submit.offsetWidth; submit.classList.add('cg-shake'); return; }
      const correct = items.every(it => it.chosen === it.bin);
      wrap.querySelectorAll('button').forEach(b => { b.disabled = true; });
      rows.forEach((r, i) => {
        const right = items[i].chosen === items[i].bin;
        r.row.classList.add(right ? 'cg-ok' : 'cg-bad');
        if (!right) r.opts.querySelectorAll('.cg-bin').forEach(x => { if (x.textContent === items[i].bin) x.classList.add('cg-correct'); });
      });
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: 'Check the marked rows — the correct group is outlined in green.' });
    });
    wrap.appendChild(submit);
    host.appendChild(wrap);
  },
};
