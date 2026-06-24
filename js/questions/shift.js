// ============================================================
// questions/shift.js — SHIFT: perform a binary shift, watching it happen.
//
// The player presses a SHIFT button; each press slides the bits one place
// (zeros fill the gap, the end bit drops off) with a short animation, and
// the denary value updates live so the x2 / ÷2 effect is visible. They
// CONFIRM once they've shifted by the asked amount. RESET restores the
// original to retry the count. (Logical shift; value shown unsigned.)
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'SHIFT', bits:[0,0,0,0,0,1,1,0], dir:'left'|'right', amount:1,
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function shiftOnce(bits, dir) {
  const n = bits.length;
  return dir === 'left' ? bits.slice(1).concat([0]) : [0].concat(bits.slice(0, n - 1));
}
function toVal(bits) { return bits.reduce((v, b) => v * 2 + b, 0); }

export const shift = {
  type: 'SHIFT',

  render(host, question, ctx) {
    host.innerHTML = '';
    const orig = question.bits.slice();
    const dir = question.dir === 'right' ? 'right' : 'left';
    const amount = question.amount || 1;
    const n = orig.length;
    let expected = orig.slice();
    for (let i = 0; i < amount; i++) expected = shiftOnce(expected, dir);

    let cur = orig.slice();
    let count = 0;
    let animating = false;

    const wrap = el('sh');
    const valLine = el('sh-val');
    const row = el('sh-row');
    const cells = [];
    for (let i = 0; i < n; i++) { const c = el('sh-cell'); cells.push(c); row.appendChild(c); }
    const paintCells = () => cur.forEach((b, i) => { cells[i].textContent = String(b); cells[i].classList.toggle('on', !!b); });
    const paintVal = () => {
      valLine.innerHTML = `value: <b>${toVal(cur)}</b>`
        + (count ? ` <span class="sh-count">(${count} of ${amount} shift${amount === 1 ? '' : 's'} ${dir})</span>` : '');
    };
    paintCells(); paintVal();
    wrap.append(valLine, row);

    function doShift() {
      if (ctx.isAnswered() || animating) return;
      animating = true;
      const step = cells[0].getBoundingClientRect().width + 5;
      row.style.transition = 'transform .18s ease';
      row.style.transform = `translateX(${dir === 'left' ? -step : step}px)`;
      (ctx.sfx.bitClick || ctx.sfx.uiClick)();
      setTimeout(() => {
        row.style.transition = 'none'; row.style.transform = 'none';
        cur = shiftOnce(cur, dir); count++;
        paintCells(); paintVal(); animating = false;
      }, 190);
    }

    const controls = el('sh-controls');
    const shiftBtn = el('sh-shift', 'button');
    shiftBtn.type = 'button';
    shiftBtn.textContent = dir === 'left' ? 'SHIFT ◀ LEFT' : 'SHIFT RIGHT ▶';
    shiftBtn.addEventListener('click', doShift);
    const resetBtn = el('sh-reset', 'button');
    resetBtn.type = 'button'; resetBtn.textContent = '↻ RESET';
    resetBtn.addEventListener('click', () => { if (ctx.isAnswered()) return; cur = orig.slice(); count = 0; paintCells(); paintVal(); });
    controls.append(shiftBtn, resetBtn);
    wrap.appendChild(controls);

    // STAGE 2 (optional) — once the bits are shifted, ask what the shift DID
    // to the value, so the player learns the ×2ⁿ / ÷2ⁿ rule, not just the move.
    const concept = question.concept || null;
    let stage = 1, shiftCorrect = false, picked = null, optBtns = [];
    const conceptBox = el('sh-concept');
    conceptBox.style.display = 'none';
    if (concept) {
      conceptBox.appendChild(el('sh-concept-q')).textContent = concept.prompt;
      conceptBox.appendChild(el('sh-replay-note')).textContent = '↻ Not sure? Press RESET then SHIFT above and watch the value change before you answer.';
      const optWrap = el('sh-opts');
      shuffle(concept.options).forEach(o => {
        const b = el('sh-opt', 'button'); b.type = 'button'; b.textContent = o;
        b.addEventListener('click', () => {
          if (stage !== 2 || ctx.isAnswered()) return;
          picked = o; optBtns.forEach(x => x.classList.remove('sel')); b.classList.add('sel');
          submit.disabled = false; ctx.sfx.uiClick();
        });
        optBtns.push(b); optWrap.appendChild(b);
      });
      conceptBox.appendChild(optWrap);
    }
    wrap.appendChild(conceptBox);

    const lockShift = () => { shiftBtn.disabled = true; resetBtn.disabled = true; };

    const submit = el('sh-submit', 'button');
    submit.type = 'button'; submit.textContent = concept ? 'CONFIRM SHIFT →' : 'CONFIRM →';
    submit.addEventListener('click', () => {
      if (ctx.isAnswered() || animating) return;

      // legacy / no-concept questions: single-stage, grade the shift.
      if (!concept) {
        const correct = cur.every((b, i) => b === expected[i]);
        lockShift(); submit.disabled = true;
        if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
        ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `Shift ${dir} by ${amount}: the result is ${expected.join('')} (value ${toVal(expected)}).` });
        return;
      }

      // stage 1 -> reveal the concept question
      if (stage === 1) {
        shiftCorrect = cur.every((b, i) => b === expected[i]);
        // NOTE: do NOT lock the shift controls here — the player can keep
        // shifting/resetting in stage 2 to actually SEE the ×2ⁿ / ÷2ⁿ effect
        // (e.g. if they speed-ran the first step). The shift grade is already
        // captured above; further shifting is observation only.
        conceptBox.style.display = 'block';
        stage = 2;
        submit.textContent = 'CHECK ANSWER →';
        submit.disabled = true;                      // until an option is picked
        return;
      }

      // stage 2 -> final grade (both the shift AND the concept must be right)
      const conceptCorrect = picked === concept.answer;
      const correct = shiftCorrect && conceptCorrect;
      optBtns.forEach(b => {
        b.disabled = true;
        if (b.textContent === concept.answer) b.classList.add('correct');
        else if (b.textContent === picked) b.classList.add('wrong');
      });
      submit.disabled = true;
      lockShift();
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      let fb = '';
      if (!shiftCorrect) fb += `The shift was off — ${dir} by ${amount} gives ${expected.join('')} (value ${toVal(expected)}). `;
      if (!conceptCorrect) fb += `A ${dir} shift by ${amount} ${dir === 'left' ? 'multiplies' : 'divides'} the value by ${1 << amount}.`;
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: fb.trim() });
    });
    wrap.appendChild(submit);
    host.appendChild(wrap);
  },
};
