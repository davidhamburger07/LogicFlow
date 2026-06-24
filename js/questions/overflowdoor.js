// ============================================================
// questions/overflowdoor.js — OVERFLOW: cause an 8-bit overflow on purpose.
//
// A "security hack" skin over understanding 8-bit overflow. A lock holds a
// start value; the player builds a number to ADD (8 binary switches) so the
// 8-bit register OVERFLOWS (goes past 255 and wraps) to land on the target
// door code. The running sum and its wrapped 8-bit value update live, so the
// 256-wrap is visible. OVERLOAD with the wrong result = fail (first wrong),
// like the other scenario games — so the overflow concept is practised, not
// just recognised.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema (target should be < start so the ONLY route is an overflow):
//   { type:'OVERFLOW', start:250, target:8,
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
const PLACES = [128, 64, 32, 16, 8, 4, 2, 1];
function toBin(v) { return PLACES.map(pv => ((v & pv) ? 1 : 0)).join(''); }

export const overflowdoor = {
  type: 'OVERFLOW',

  render(host, question, ctx) {
    host.innerHTML = '';
    const start = question.start, target = question.target;
    const bits = new Array(8).fill(0);
    let done = false;

    const wrap = el('ov');

    // the lock readout
    const lock = el('ov-lock');
    lock.innerHTML = `<div class="ov-lockrow"><span class="ov-k">REGISTER</span><span class="ov-bin">${toBin(start)}</span><span class="ov-den">${start}</span></div>`
      + `<div class="ov-lockrow ov-target"><span class="ov-k">DOOR CODE</span><span class="ov-bin">${toBin(target)}</span><span class="ov-den">${target}</span></div>`;
    wrap.appendChild(lock);

    wrap.appendChild(el('ov-explain')).innerHTML = 'An 8-bit register only holds <b>0–255</b>. Push past 255 and there is no 9th bit to hold the carry, so the value <b>wraps back round to 0</b> — that is <b>overflow</b>. Add a number that overshoots 256 to land on the door code.';

    // the live equation
    const calc = el('ov-calc');
    wrap.appendChild(calc);

    // the addend switches
    const grid = el('ov-switches');
    const switchEls = PLACES.map((pv, i) => {
      const col = el('ov-switch');
      col.appendChild(el('ov-pv')).textContent = pv;
      const sw = el('ov-toggle', 'button');
      sw.type = 'button'; sw.textContent = '0'; sw.setAttribute('aria-label', `add ${pv}`);
      sw.addEventListener('click', () => {
        if (done) return;
        bits[i] ^= 1; sw.textContent = String(bits[i]); sw.classList.toggle('on', !!bits[i]);
        (ctx.sfx.bitClick || ctx.sfx.uiClick)(); paint();
      });
      col.appendChild(sw); grid.appendChild(col); return sw;
    });
    wrap.appendChild(grid);

    const btn = el('ov-fire', 'button');
    btn.type = 'button'; btn.textContent = '⚡ OVERLOAD LOCK';
    btn.addEventListener('click', fire);
    wrap.appendChild(btn);
    host.appendChild(wrap);

    const addend = () => bits.reduce((s, b, i) => s + (b ? PLACES[i] : 0), 0);

    function paint() {
      const a = addend(), sum = start + a, wrapped = sum % 256, over = sum > 255;
      const ready = over && wrapped === target;
      calc.innerHTML = `<span class="ov-eq">${start} + <b>${a}</b> = ${sum}</span>`
        + `<span class="ov-arrow">→ 8-bit</span>`
        + `<span class="ov-wrap${ready ? ' ov-ready' : ''}">${wrapped}</span>`
        + (over ? `<span class="ov-flag">OVERFLOW</span>` : `<span class="ov-flag ov-noflow">no overflow yet</span>`);
      btn.classList.toggle('ov-armed', ready);
    }
    paint();

    function fire() {
      if (done) return;
      const a = addend(), sum = start + a, wrapped = sum % 256, over = sum > 255;
      done = true;
      switchEls.forEach(sw => { sw.disabled = true; }); btn.disabled = true;
      const correct = over && wrapped === target;
      if (correct) { ctx.sfx.zap(); ctx.onSubmit(true); return; }
      ctx.sfx.wrong();
      const need = (256 - start + target) % 256 || 256;     // the addend that overflows to target
      const fb = !over
        ? `No overflow — ${start} + ${a} = ${sum} still fits in 8 bits. Push the total past 255.`
        : `Overflowed to ${wrapped}, but the door code is ${target}. Add ${need} (so ${start} + ${need} = ${start + need}, which wraps to ${target}).`;
      ctx.onSubmit(false, { feedbackOnWrong: fb });
    }
  },
};
