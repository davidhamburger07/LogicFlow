// ============================================================
// questions/hexpick.js — HEXPICK: produce a hex answer, digit by digit.
//
// Each hex digit is a 0–F stepper (▲ / ▼ cycle through 0-9, A-F). The
// natural-form input for any hex answer:
//   - denary -> hex : plain steppers (work out each digit).
//   - binary -> hex : pass `nibbles`, and each digit shows its 4 source
//     bits above it (the "nibble bridge" — read the nibble, pick the hex).
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'HEXPICK', answer:'CD'  (or [12,13]),
//     nibbles?:[[1,1,0,0],[1,1,0,1]],   // optional, one per digit
//     badge, board, title, desc, hints, explain }
// ============================================================

const HEX = '0123456789ABCDEF';
function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const hexpick = {
  type: 'HEXPICK',

  render(host, question, ctx) {
    host.innerHTML = '';
    const ans = typeof question.answer === 'string'
      ? [...question.answer.toUpperCase()].map(c => HEX.indexOf(c))
      : question.answer.slice();
    const nDig = ans.length;
    const nibbles = question.nibbles || null;
    const vals = new Array(nDig).fill(0);

    const wrap = el('hx');
    const row = el('hx-row');
    for (let i = 0; i < nDig; i++) {
      const col = el('hx-col');
      if (nibbles) { const nb = el('hx-nibble'); nb.textContent = nibbles[i].join(''); col.appendChild(nb); }
      const up = el('hx-step hx-up', 'button'); up.type = 'button'; up.textContent = '▲';
      const disp = el('hx-digit'); disp.textContent = '0';
      const down = el('hx-step hx-down', 'button'); down.type = 'button'; down.textContent = '▼';
      const set = d => { vals[i] = (d + 16) % 16; disp.textContent = HEX[vals[i]]; };
      up.addEventListener('click', () => { if (ctx.isAnswered()) return; set(vals[i] + 1); ctx.sfx.uiClick(); });
      down.addEventListener('click', () => { if (ctx.isAnswered()) return; set(vals[i] - 1); ctx.sfx.uiClick(); });
      col.append(up, disp, down);
      row.appendChild(col);
    }
    wrap.appendChild(row);

    const submit = el('hx-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK →';
    submit.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      const correct = vals.every((v, i) => v === ans[i]);
      row.querySelectorAll('button').forEach(b => { b.disabled = true; });
      submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `The answer is ${ans.map(d => HEX[d]).join('')}.` });
    });
    wrap.appendChild(submit);
    host.appendChild(wrap);
  },
};
