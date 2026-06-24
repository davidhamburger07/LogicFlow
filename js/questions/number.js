// ============================================================
// questions/number.js — NUMBER: type a numeric answer on a keypad.
//
// The natural-form input for any question whose answer is a NUMBER
// (binary->denary, hex->denary, file sizes, units, counts) — the player
// produces the value rather than picking it from options. Optional
// `signed` mode (two's-complement -> denary) adds a +/- toggle.
//
// Same contract as the other question types:
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema (in content.js / generators.js):
//   { type:'NUMBER', answer: <number>, signed?: bool, unit?: 'bits',
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

const MAX_DIGITS = 12;

export const number = {
  type: 'NUMBER',

  render(host, question, ctx) {
    host.innerHTML = '';
    const signed = !!question.signed;
    let entry = '';
    let neg = false;

    const wrap = el('np');
    wrap.tabIndex = 0;                       // focusable, so the listener dies with the element

    const disp = el('np-display');
    const unitHTML = question.unit ? `<span class="np-unit">${question.unit}</span>` : '';
    const paint = () => {
      const shown = (neg && entry !== '' ? '-' : '') + (entry === '' ? '0' : entry);
      disp.innerHTML = `<span class="np-value">${shown}</span>${unitHTML}`;
    };
    wrap.appendChild(disp);

    const pad = el('np-pad');
    const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', signed ? '±' : '', '0', '⌫'];
    keys.forEach(k => {
      if (k === '') { pad.appendChild(el('np-key np-key-blank', 'span')); return; }
      const b = el('np-key', 'button');
      b.type = 'button'; b.textContent = k;
      if (k === '±') b.classList.add('np-key-sign');
      if (k === '⌫') b.classList.add('np-key-del');
      b.addEventListener('click', () => press(k));
      pad.appendChild(b);
    });
    wrap.appendChild(pad);

    const submit = el('np-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK →';
    submit.addEventListener('click', check);
    wrap.appendChild(submit);

    host.appendChild(wrap);
    paint();
    setTimeout(() => { try { wrap.focus(); } catch (e) {} }, 50);

    function press(k) {
      if (ctx.isAnswered()) return;
      if (k === '⌫') entry = entry.slice(0, -1);
      else if (k === '±') neg = !neg;
      else if (entry.length < MAX_DIGITS) entry += k;
      ctx.sfx.uiClick();
      paint();
    }

    function check() {
      if (ctx.isAnswered()) return;
      if (entry === '') { disp.classList.remove('np-shake'); void disp.offsetWidth; disp.classList.add('np-shake'); return; }
      const val = (neg ? -1 : 1) * Number(entry);
      const correct = val === Number(question.answer);
      pad.querySelectorAll('button').forEach(b => { b.disabled = true; });
      submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `The answer is ${question.answer}.` });
    }

    wrap.addEventListener('keydown', e => {
      if (ctx.isAnswered()) return;
      if (e.key >= '0' && e.key <= '9') { press(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { press('⌫'); e.preventDefault(); }
      else if (signed && (e.key === '-' || e.key === '+')) { neg = (e.key === '-'); paint(); }
      else if (e.key === 'Enter') { check(); e.preventDefault(); }
    });
  },
};
