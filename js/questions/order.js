// ============================================================
// questions/order.js — ORDER: arrange items into the correct sequence.
//
// A rotating recall format for anything orderable: memory hierarchy
// (fastest -> slowest), TCP/IP layers, data units (smallest -> largest),
// process steps. Items start shuffled; the player reorders them by
// dragging, or with the ▲ / ▼ controls (keyboard / touch friendly).
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'ORDER', items:['Registers','Cache','RAM','Secondary storage'],
//     topLabel?:'FASTEST', bottomLabel?:'SLOWEST',
//     badge, board, title, desc, hints, explain }   // items = correct order
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export const order = {
  type: 'ORDER',

  render(host, question, ctx) {
    host.innerHTML = '';
    const correct = question.items.slice();
    let cur = shuffle(correct);
    let guard = 0;
    while (correct.length > 1 && cur.every((x, i) => x === correct[i]) && guard++ < 20) cur = shuffle(correct);

    const wrap = el('od');
    if (question.topLabel) wrap.appendChild(el('od-toplabel')).textContent = question.topLabel;
    const list = el('od-list');
    wrap.appendChild(list);
    if (question.bottomLabel) wrap.appendChild(el('od-botlabel')).textContent = question.bottomLabel;

    let dragIdx = null;
    function move(from, to) {
      if (ctx.isAnswered() || to < 0 || to >= cur.length) return;
      const [x] = cur.splice(from, 1); cur.splice(to, 0, x);
      (ctx.sfx.uiClick || ctx.sfx.bitClick)();
      rebuild();
    }
    function rebuild() {
      list.innerHTML = '';
      cur.forEach((text, i) => {
        const item = el('od-item'); item.draggable = true; item.dataset.i = i;
        item.innerHTML = `<span class="od-grip">≡</span><span class="od-num">${i + 1}</span><span class="od-text">${text}</span>`;
        const ctrls = el('od-ctrls');
        const up = el('od-move', 'button'); up.type = 'button'; up.textContent = '▲'; up.disabled = (i === 0);
        const down = el('od-move', 'button'); down.type = 'button'; down.textContent = '▼'; down.disabled = (i === cur.length - 1);
        up.addEventListener('click', () => move(i, i - 1));
        down.addEventListener('click', () => move(i, i + 1));
        ctrls.append(up, down); item.appendChild(ctrls);
        item.addEventListener('dragstart', () => { dragIdx = i; item.classList.add('od-dragging'); });
        item.addEventListener('dragend', () => item.classList.remove('od-dragging'));
        item.addEventListener('dragover', e => e.preventDefault());
        item.addEventListener('drop', e => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) move(dragIdx, i); dragIdx = null; });
        list.appendChild(item);
      });
    }
    rebuild();

    const submit = el('od-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK →';
    submit.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      const ok = cur.every((x, i) => x === correct[i]);
      list.querySelectorAll('button').forEach(b => { b.disabled = true; });
      list.querySelectorAll('.od-item').forEach(it => { it.draggable = false; });
      submit.disabled = true;
      if (ok) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(ok, ok ? {} : { feedbackOnWrong: `Correct order: ${correct.join(' → ')}.` });
    });
    wrap.appendChild(submit);
    host.appendChild(wrap);
  },
};
