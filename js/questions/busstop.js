// ============================================================
// questions/busstop.js — BUSSTOP: short division, bus-stop layout.
//
// The classic written method: the divisor sits outside the "bus stop",
// the dividend's digits sit under the bar, and the student writes the
// answer digit-by-digit ON TOP, left → right, carrying each remainder
// as a little superscript box onto the front of the next digit
// (92 ÷ 4:  4 into 9 goes 2 r 1 → write 2, carry ¹ → 4 into ¹2 = 12
// goes 3 → answer 23).
//
// The carry boxes are scratch aids (never marked); only the answer
// digits are graded. Leading zeros may be typed as 0 or left blank.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema (dividend must divide exactly):
//   { type:'BUSSTOP', dividend:60000, divisor:8, unit?:'bytes',
//     walk?:true,   // WATCH mode: NEXT STEP performs each digit for the student
//     badge, board, title, desc, hints, explain }
// ============================================================

function mk(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function fmt(n) { return n.toLocaleString('en-GB'); }

export const busstop = {
  type: 'BUSSTOP',

  render(host, question, ctx) {
    if (question.walk) return renderWalk(host, question, ctx);
    host.innerHTML = '';
    const divisor = question.divisor;
    const digs = [...String(question.dividend)].map(Number);

    // expected answer digits + the remainder carried past each digit
    const tops = []; const rems = [];
    let rem = 0;
    digs.forEach(d => {
      const cur = rem * 10 + d;
      tops.push(Math.floor(cur / divisor));
      rem = cur % divisor;
      rems.push(rem);
    });
    const leadZeros = (() => { let n = 0; while (n < tops.length - 1 && tops[n] === 0) n++; return n; })();

    const wrap = mk('bs');

    const intro = mk('bs-intro');
    intro.innerHTML = `💡 the bus stop method — divide <b>left → right</b>, one digit at a time. `
      + `If ${divisor} doesn't go, write <b>0</b> (or leave it blank) and <b>carry the remainder</b> into the little box `
      + `on the front of the next digit. e.g. ${divisor} into ${digs[0]} goes <b>${tops[0]}</b> r <b>${rems[0]}</b>.`;
    wrap.appendChild(intro);

    const table = mk('bs-table', 'table');
    // answer row — one input above each dividend digit
    const ansRow = mk('bs-ans-row', 'tr');
    ansRow.appendChild(mk('bs-gap', 'td'));
    const ansInputs = [];
    digs.forEach((d, i) => {
      const td = mk('', 'td');
      const input = mk('bs-adig', 'input');
      input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.maxLength = 1;
      input.setAttribute('aria-label', `answer digit ${i + 1}`);
      td.appendChild(input);
      ansRow.appendChild(td);
      ansInputs.push(input);
    });
    table.appendChild(ansRow);
    // dividend row — the divisor outside the stop, digits (with carry boxes) inside
    const divRow = mk('bs-div-row', 'tr');
    divRow.appendChild(mk('bs-div', 'td')).textContent = String(divisor);
    const carryInputs = [];
    digs.forEach((d, i) => {
      const td = mk('bs-cell', 'td');
      if (i > 0) {
        const carry = mk('bs-cdig', 'input');
        carry.type = 'text'; carry.inputMode = 'numeric'; carry.autocomplete = 'off'; carry.maxLength = 1;
        carry.setAttribute('aria-label', `remainder carried into digit ${i + 1} (scratch aid)`);
        td.appendChild(carry);
        carryInputs.push(carry);
      }
      td.appendChild(mk('bs-dig', 'span')).textContent = String(d);
      divRow.appendChild(td);
    });
    table.appendChild(divRow);
    wrap.appendChild(table);

    const note = mk('bs-note');
    note.textContent = 'the little boxes hold the carried remainders — scratch aids, only the top row is marked'
      + (question.unit ? ` · answer is in ${question.unit}` : '');
    wrap.appendChild(note);

    const fb = mk('bs-fb'); wrap.appendChild(fb);
    const submit = mk('bs-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK →';
    wrap.appendChild(submit);
    host.appendChild(wrap);

    function check() {
      if (ctx.isAnswered()) return;
      const filled = ansInputs.every((a, i) => a.value.trim() !== '' || i < leadZeros);
      if (!filled) { fb.className = 'bs-fb bs-no'; fb.textContent = 'Fill the answer digits along the top, left to right.'; return; }
      let correct = true;
      ansInputs.forEach((a, i) => {
        const v = a.value.trim();
        const ok = v === String(tops[i]) || (i < leadZeros && v === '');
        a.classList.toggle('ok', ok); a.classList.toggle('bad', !ok);
        if (!ok) correct = false;
      });
      ansInputs.forEach(a => { a.disabled = true; });
      carryInputs.forEach(c => { c.disabled = true; });
      submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      const val = fmt(question.dividend / divisor);
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `${fmt(question.dividend)} ÷ ${divisor} = ${val}${question.unit ? ' ' + question.unit : ''}.` });
    }

    submit.addEventListener('click', check);
    wrap.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); check(); } });
    setTimeout(() => { try { ansInputs[leadZeros].focus(); } catch (e) {} }, 50);
  },
};

// WATCH mode — the same bus stop, but a NEXT STEP button performs each digit
// for the student with narration (does it go? write the digit, carry the
// remainder), then reads the answer off the top. Non-failable.
function renderWalk(host, question, ctx) {
  host.innerHTML = '';
  const divisor = question.divisor;
  const digs = [...String(question.dividend)].map(Number);
  const tops = []; const rems = [];
  let rem = 0;
  digs.forEach(d => {
    const cur = rem * 10 + d;
    tops.push(Math.floor(cur / divisor));
    rem = cur % divisor;
    rems.push(rem);
  });

  const wrap = mk('bs bs-walk');
  const say = mk('bs-say');
  say.innerHTML = `Watch <b>${fmt(question.dividend)} ÷ ${divisor}</b> step by step: work <b>left → right</b>, one digit at a time, carrying each remainder onto the front of the next digit. Press <b>NEXT STEP</b>.`;
  wrap.appendChild(say);

  const table = mk('bs-table', 'table');
  const ansRow = mk('bs-ans-row', 'tr');
  ansRow.appendChild(mk('bs-gap', 'td'));
  const ansCells = digs.map(() => { const td = mk('', 'td'); const s = mk('bs-adig bs-wcell', 'span'); td.appendChild(s); ansRow.appendChild(td); return s; });
  table.appendChild(ansRow);
  const divRow = mk('bs-div-row', 'tr');
  divRow.appendChild(mk('bs-div', 'td')).textContent = String(divisor);
  const carryCells = [];
  const digCells = digs.map((d, i) => {
    const td = mk('bs-cell', 'td');
    if (i > 0) { const c = mk('bs-cdig bs-wcell', 'span'); td.appendChild(c); carryCells.push(c); }
    const span = mk('bs-dig', 'span'); span.textContent = String(d);
    td.appendChild(span);
    divRow.appendChild(td);
    return span;
  });
  table.appendChild(divRow);
  wrap.appendChild(table);

  let pos = 0;
  const next = mk('bs-next', 'button');
  next.type = 'button'; next.textContent = '▶ NEXT STEP';
  next.addEventListener('click', () => {
    if (pos >= digs.length) return;
    const i = pos;
    const cur = i === 0 ? digs[0] : rems[i - 1] * 10 + digs[i];
    digCells.forEach(c => c.classList.remove('bs-cur'));
    digCells[i].classList.add('bs-cur');
    ansCells[i].textContent = String(tops[i]);
    ansCells[i].classList.add('bs-pop');
    if (tops[i] === 0 && cur < divisor) {
      say.innerHTML = `<b>${divisor} into ${cur}?</b> Doesn't go — write <b>0</b> on top and carry the <b>${rems[i]}</b> onto the front of the next digit.`;
    } else {
      say.innerHTML = `<b>${divisor} into ${cur}?</b> Goes <b>${tops[i]}</b> times (${tops[i]} × ${divisor} = ${tops[i] * divisor})`
        + (rems[i] ? `, remainder <b>${rems[i]}</b> — write ${tops[i]}, carry the ${rems[i]}.` : ` exactly — write ${tops[i]}, nothing to carry.`);
    }
    if (rems[i] > 0 && i + 1 < digs.length) { carryCells[i].textContent = String(rems[i]); carryCells[i].classList.add('bs-pop'); }
    (ctx.sfx.bitClick || ctx.sfx.uiClick)(true);
    pos++;
    if (pos >= digs.length) {
      digCells[i].classList.remove('bs-cur');
      const val = fmt(question.dividend / divisor);
      say.innerHTML += `<br>✓ Now read the answer off the <b>top row</b>: <b>${val}</b>${question.unit ? ' ' + question.unit : ''}. The carried remainders are the whole trick — now you do one.`;
      next.textContent = '✓ DONE'; next.disabled = true;
      ctx.sfx.zap();
      ctx.onSubmit(true, {});
    }
  });
  wrap.appendChild(next);
  host.appendChild(wrap);
}
