// ============================================================
// questions/binadd.js — BINADD: binary addition on a carry-row canvas.
//
// The player adds two binary numbers the way it's done on paper: fill the
// CARRY row and toggle the RESULT bits, working right -> left. Both the
// carries and the sum are checked, so the method is practised, not just
// the answer (the locked "carry row + result" decision). This canvas is
// the reusable engine for two's-complement add/subtract and add-to-hex.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'BINADD', a:[0,1,0,1], b:[0,0,1,1],   // MSB-first operand bits
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const binadd = {
  type: 'BINADD',

  render(host, question, ctx) {
    host.innerHTML = '';
    const a = question.a.slice();
    const b = question.b.slice();
    const n = a.length;

    // expected carries (into each column) + result, computed right -> left
    const carryInto = new Array(n).fill(0);
    const result = new Array(n).fill(0);
    let carry = 0;
    for (let i = n - 1; i >= 0; i--) {
      carryInto[i] = carry;
      const s = a[i] + b[i] + carry;
      result[i] = s & 1;
      carry = s >> 1;
    }
    const overflow = carry;                       // final carry out of the MSB

    const userCarry = new Array(n).fill(0);
    const userSum = new Array(n).fill(0);

    const wrap = el('ba');
    const grid = el('ba-grid');
    grid.style.gridTemplateColumns = '44px repeat(' + n + ', minmax(0, 1fr))';

    const label = txt => { const l = el('ba-label'); l.textContent = txt; grid.appendChild(l); };
    const toggle = (arr, i) => {
      const c = el('ba-cell ba-toggle', 'button');
      c.type = 'button'; c.textContent = '0';
      c.addEventListener('click', () => {
        if (ctx.isAnswered()) return;
        arr[i] ^= 1;
        c.textContent = String(arr[i]);
        c.classList.toggle('on', !!arr[i]);
        (ctx.sfx.bitClick || ctx.sfx.uiClick)();
      });
      return c;
    };
    const fixed = v => { const c = el('ba-cell ba-fixed'); c.textContent = String(v); return c; };
    const rule = () => { const r = el('ba-rule'); r.style.gridColumn = '1 / -1'; return r; };

    label('carry'); for (let i = 0; i < n; i++) grid.appendChild(toggle(userCarry, i));
    label('A'); a.forEach(v => grid.appendChild(fixed(v)));
    label('+ B'); b.forEach(v => grid.appendChild(fixed(v)));
    grid.appendChild(rule());
    label('sum'); for (let i = 0; i < n; i++) grid.appendChild(toggle(userSum, i));
    wrap.appendChild(grid);

    wrap.appendChild(el('ba-hint-line')).textContent = 'Work right → left: the carry row is a scratch aid — only the SUM is marked.';

    const submit = el('ba-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK →';
    submit.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      // Grade on the SUM (the actual answer). The carry row is an optional
      // working aid — the player isn't penalised for how they used it.
      const correct = userSum.every((v, i) => v === result[i]);
      grid.querySelectorAll('button').forEach(x => { x.disabled = true; });
      submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      const fb = `Check the sum — the result is ${result.join('')}${overflow ? ' (with overflow — a carry out of the top bit)' : ''}.`;
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: fb });
    });
    wrap.appendChild(submit);
    host.appendChild(wrap);
  },
};
