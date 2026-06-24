// ============================================================
// questions/searchtrace.js — SEARCHTRACE: step through a search.
//
// The player traces a search on a list, clicking the element the algorithm
// checks next — left-to-right for a LINEAR search, the middle of the
// current range for a BINARY search (the off-range elements grey out as it
// halves). The first wrong click ends the trace (like the sort trace).
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'SEARCHTRACE', method:'linear'|'binary',
//     list:[1,3,5,7,9,11], target:9,   // target must be in the list
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const searchtrace = {
  type: 'SEARCHTRACE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const list = question.list.slice();
    const target = question.target;
    const method = question.method === 'binary' ? 'binary' : 'linear';
    const n = list.length;
    let lo = 0, hi = n - 1, ptr = 0, checks = 0, done = false;

    const wrap = el('se');
    const info = el('se-info');
    wrap.appendChild(info);
    const row = el('se-row');
    const cells = list.map((v, i) => {
      const c = el('se-cell', 'button');
      c.type = 'button';
      c.innerHTML = `<span class="se-val">${v}</span><span class="se-idx">${i}</span>`;
      c.addEventListener('click', () => onClick(i));
      row.appendChild(c);
      return c;
    });
    wrap.appendChild(row);
    host.appendChild(wrap);

    const expected = () => (method === 'binary' ? Math.floor((lo + hi) / 2) : ptr);
    function paint() {
      if (method === 'binary') cells.forEach((c, i) => c.classList.toggle('se-out', i < lo || i > hi));
      const prompt = done ? ''
        : method === 'binary' ? `Searching range [${lo}–${hi}] — click the MIDDLE element.`
          : `Click element ${ptr} (the next one in line).`;
      info.innerHTML = `Find <b>${target}</b>${method === 'binary' ? ' (binary search)' : ' (linear search)'} · checks: <b>${checks}</b><br><span class="se-prompt">${prompt}</span>`;
    }
    paint();

    function finish(success) {
      done = true;
      cells.forEach(c => { c.disabled = true; });
      paint();
      if (success) { ctx.sfx.zap(); ctx.onSubmit(true, {}); }
      else { ctx.sfx.wrong(); ctx.onSubmit(false, { feedbackOnWrong: method === 'binary' ? 'A binary search always checks the MIDDLE of the current range, then halves it.' : 'A linear search checks each element in order from the start.' }); }
    }

    function onClick(i) {
      if (done) return;
      if (i !== expected()) { cells[i].classList.add('se-wrong'); finish(false); return; }
      checks++;
      cells[i].classList.add('se-checked');
      if (list[i] === target) { cells[i].classList.add('se-found'); finish(true); return; }
      if (method === 'binary') { if (list[i] < target) lo = i + 1; else hi = i - 1; }
      else ptr++;
      paint();
    }
  },
};
