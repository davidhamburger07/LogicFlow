// ============================================================
// questions/rangecheck.js — RANGECHECK: does a denary value fit in an n-bit
// two's-complement register? A decision + reveal that TRAPS the boundary
// (+128 / −129 are one step past the ends), which the module otherwise only
// teaches, never tests. The reveal names the actual limit and its bit pattern.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'RANGECHECK', value:128, bits?:8, badge, board, title, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function sign(v) { return (v > 0 ? '+' : '') + v; }
function twosStr(v, n) {                                   // n-bit two's-complement pattern
  const u = ((v % (1 << n)) + (1 << n)) % (1 << n);
  return u.toString(2).padStart(n, '0');
}

export const rangecheck = {
  type: 'RANGECHECK',

  render(host, question, ctx) {
    host.innerHTML = '';
    const n = question.bits || 8;
    const min = -(1 << (n - 1)), max = (1 << (n - 1)) - 1;   // −128 … +127
    const value = question.value;
    const fits = value >= min && value <= max;

    const wrap = el('rc'); wrap.dataset.value = String(value);
    const qline = el('rc-q'); qline.innerHTML = `<span class="rc-val">${sign(value)}</span>`;
    const rangeNote = el('rc-range'); rangeNote.innerHTML = `${n}-bit signed range: <b>${min}</b> &nbsp;…&nbsp; <b>+${max}</b>`;
    wrap.append(qline, rangeNote);

    const opts = el('rc-opts');
    const yes = el('rc-opt rc-fits', 'button'); yes.type = 'button'; yes.textContent = '✓ IT FITS';
    const no = el('rc-opt rc-nofits', 'button'); no.type = 'button'; no.textContent = '✕ OUT OF RANGE';
    opts.append(yes, no); wrap.appendChild(opts);

    const fb = el('rc-fb'); wrap.appendChild(fb);
    host.appendChild(wrap);

    function pick(choseFits) {
      if (ctx.isAnswered()) return;
      const correct = choseFits === fits;
      yes.disabled = true; no.disabled = true;
      (fits ? yes : no).classList.add('rc-ok');
      if (!correct) (choseFits ? yes : no).classList.add('rc-bad');
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      fb.className = 'rc-fb ' + (fits ? 'rc-in' : 'rc-out');
      fb.innerHTML = fits
        ? `✓ <b>${sign(value)}</b> is in range — it is stored as <b>${twosStr(value, n)}</b>.`
        : (value > max
          ? `✕ <b>${sign(value)}</b> is <b>out of range</b>. The largest ${n}-bit signed value is <b>+${max}</b> (<code>${twosStr(max, n)}</code>) — ${sign(value)} would need a ${n + 1}th bit.`
          : `✕ <b>${sign(value)}</b> is <b>out of range</b>. The smallest ${n}-bit signed value is <b>${min}</b> (<code>${twosStr(min, n)}</code>) — you cannot go lower in ${n} bits.`);
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: fb.textContent });
    }
    yes.addEventListener('click', () => pick(true));
    no.addEventListener('click', () => pick(false));
  },
};
