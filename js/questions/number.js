// ============================================================
// questions/number.js — NUMBER: type a numeric answer.
//
// The natural-form input for any question whose answer is a NUMBER
// (binary->denary, hex->denary, file sizes, units, counts) — the player
// produces the value rather than picking it from options. A plain typed
// field: keyboard on desktop, the native numeric keypad on mobile
// (inputMode). Optional `signed` mode (two's-complement -> denary) adds
// a ± toggle for touch; typing a leading "-" works too.
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

    const wrap = el('np');

    const row = el('np-row');
    const input = el('np-input', 'input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = signed ? 'your answer (e.g. -42)…' : 'type your answer…';
    input.setAttribute('aria-label', 'numeric answer');

    // keep the field numeric: digits, plus one leading "-" in signed mode
    const sanitise = () => {
      const neg = signed && input.value.trimStart().startsWith('-');
      let digits = input.value.replace(/[^0-9]/g, '').slice(0, MAX_DIGITS);
      const clean = (neg ? '-' : '') + digits;
      if (input.value !== clean) input.value = clean;
    };
    input.addEventListener('input', sanitise);

    row.appendChild(input);
    if (signed) {
      const sign = el('np-sign', 'button');
      sign.type = 'button'; sign.textContent = '±';
      sign.title = 'make the answer negative / positive';
      sign.addEventListener('click', () => {
        if (ctx.isAnswered()) return;
        input.value = input.value.startsWith('-') ? input.value.slice(1) : '-' + input.value;
        ctx.sfx.uiClick();
        input.focus();
      });
      row.appendChild(sign);
    }
    if (question.unit) {
      const unit = el('np-unit', 'span');
      unit.textContent = question.unit;
      row.appendChild(unit);
    }
    wrap.appendChild(row);

    const submit = el('np-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK →';
    submit.addEventListener('click', check);
    wrap.appendChild(submit);

    host.appendChild(wrap);
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 50);

    function check() {
      if (ctx.isAnswered()) return;
      const raw = input.value.trim();
      if (raw === '' || raw === '-') { input.classList.remove('np-shake'); void input.offsetWidth; input.classList.add('np-shake'); return; }
      const correct = Number(raw) === Number(question.answer);
      input.disabled = true;
      submit.disabled = true;
      const sign = wrap.querySelector('.np-sign'); if (sign) sign.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `The answer is ${question.answer}.` });
    }

    input.addEventListener('keydown', e => { if (e.key === 'Enter') { check(); e.preventDefault(); } });
  },
};
