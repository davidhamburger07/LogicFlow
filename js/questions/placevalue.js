// ============================================================
// questions/placevalue.js — PLACEVALUE: build a binary number's denary
// value by tapping each lit bit to collect its place value into a running
// total. The GUIDED counterpart to the bare NUMBER pad (practice lessons
// use this; unit tests use NUMBER — scaffolding fades by context).
//
// Signed mode: the leftmost place value is negative (two's complement,
// e.g. -128 for 8 bits), so the running total can go negative.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'PLACEVALUE', bits:[1,0,1,1], signed?:bool,
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const placevalue = {
  type: 'PLACEVALUE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const bits = question.bits.slice();          // MSB-first 0/1 array
    const n = bits.length;
    const placeOf = i => {
      const p = 1 << (n - 1 - i);
      return (question.signed && i === 0) ? -p : p;
    };
    const value = bits.reduce((s, b, i) => s + (b ? placeOf(i) : 0), 0);
    const counted = new Set();                   // lit-bit indices the player has collected

    const wrap = el('pv');

    const grid = el('pv-grid');
    bits.forEach((b, i) => {
      const col = el('pv-col');
      const place = el('pv-place' + (placeOf(i) < 0 ? ' pv-neg' : ''));
      place.textContent = placeOf(i);
      const chip = el('pv-bit ' + (b ? 'lit' : 'off') + (placeOf(i) < 0 ? ' neg' : ''), b ? 'button' : 'div');
      chip.textContent = String(b);
      if (b) {
        chip.type = 'button';
        chip.addEventListener('click', () => {
          if (ctx.isAnswered()) return;
          if (counted.has(i)) { counted.delete(i); chip.classList.remove('added'); }
          else { counted.add(i); chip.classList.add('added'); }
          (ctx.sfx.bitClick || ctx.sfx.uiClick)();
          paint();
        });
      }
      col.append(place, chip);
      grid.appendChild(col);
    });
    wrap.appendChild(grid);

    // The lit bits build the working (8 + 2 + 1 = …) as a scaffold, but the
    // player must PRODUCE the total themselves — type it in, don't read it off.
    const sumLine = el('pv-sum');
    const exprSpan = el('pv-expr', 'span');
    const eq = el('pv-eq', 'span'); eq.textContent = '=';
    const input = el('pv-input', 'input');
    input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off';
    input.placeholder = '?'; input.setAttribute('aria-label', 'denary total');
    sumLine.append(exprSpan, eq, input);
    wrap.appendChild(sumLine);
    function paint() {
      const idxs = [...counted].sort((a, b) => a - b);
      exprSpan.textContent = idxs.length ? idxs.map(i => placeOf(i)).join(' + ').replace(/\+ -/g, '− ') : '—';
    }
    paint();

    const submit = el('pv-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK →';
    const check = () => {
      if (ctx.isAnswered()) return;
      const raw = input.value.trim();
      if (raw === '' || raw === '-') { input.classList.remove('pv-shake'); void input.offsetWidth; input.classList.add('pv-shake'); return; }
      const correct = Number(raw) === value;
      grid.querySelectorAll('button').forEach(b => { b.disabled = true; });
      input.disabled = true; submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `Add the place values of the lit bits — the total is ${value}.` });
    };
    submit.addEventListener('click', check);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { check(); e.preventDefault(); } });
    wrap.appendChild(submit);
    host.appendChild(wrap);
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 50);
  },
};
