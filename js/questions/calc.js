// ============================================================
// questions/calc.js — CALC: a guided, step-by-step calculation.
//
// Walks the player through a method one step at a time (e.g. a file-size
// sum: width x height x depth -> bits -> ÷8 -> bytes). Each step reveals
// only after the previous is solved, so the working is built up. A step's
// expression may reference the previous result via the token {prev}.
//
// This is the GUIDED format (practice lessons); the bare NUMBER pad is the
// unguided version for unit tests. First wrong step fails the question and
// reveals the full working.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'CALC', formula?:'size = W x H x colour depth',
//     steps:[ { expr:'800 x 600 x 3', answer:1440000, unit:'bits' },
//             { expr:'{prev} ÷ 8',    answer:180000,  unit:'bytes' } ],
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function clean(s) { return String(s).replace(/[\s,]/g, ''); }

export const calc = {
  type: 'CALC',

  render(host, question, ctx) {
    host.innerHTML = '';
    const steps = question.steps;
    let active = 0;
    let failed = false;

    const wrap = el('cl');
    if (question.formula) { const f = el('cl-formula'); f.innerHTML = question.formula; wrap.appendChild(f); }
    const list = el('cl-steps');

    const exprText = i => {
      let e = steps[i].expr;
      if (e.includes('{prev}')) e = e.replace('{prev}', i > 0 ? steps[i - 1].answer : '');
      return e + ' =';
    };

    const rows = steps.map((st, i) => {
      const row = el('cl-step');
      const exprEl = el('cl-expr');
      const input = document.createElement('input');
      input.type = 'text'; input.className = 'cl-input'; input.inputMode = 'numeric'; input.placeholder = '?'; input.autocomplete = 'off'; input.spellcheck = false;
      const val = el('cl-val'); val.textContent = String(st.answer);
      const unit = el('cl-unit'); unit.textContent = st.unit || '';
      const check = el('cl-check', 'button'); check.type = 'button'; check.textContent = 'CHECK';
      row.append(exprEl, input, val, unit, check);
      list.appendChild(row);
      return { row, exprEl, input, val, unit, check, st };
    });
    wrap.appendChild(list);
    host.appendChild(wrap);

    function paint() {
      rows.forEach((r, i) => {
        if (i > active) { r.row.style.display = 'none'; return; }
        r.row.style.display = 'flex';
        const done = i < active;
        r.row.classList.toggle('cl-done', done);
        r.row.classList.toggle('cl-active', i === active && !failed);
        r.exprEl.textContent = exprText(i);
        const showInput = (i === active && !failed);
        r.input.style.display = showInput ? '' : 'none';
        r.check.style.display = showInput ? '' : 'none';
        r.val.style.display = showInput ? 'none' : '';
      });
      if (active < rows.length && !failed) setTimeout(() => { try { rows[active].input.focus(); } catch (e) {} }, 40);
    }

    function checkActive() {
      if (ctx.isAnswered() || failed) return;
      const r = rows[active];
      const correct = Number(clean(r.input.value)) === Number(r.st.answer);
      if (correct) {
        active++;
        if (active >= rows.length) {
          paint();
          rows.forEach(x => { x.input.disabled = true; x.check.disabled = true; });
          ctx.sfx.zap();
          ctx.onSubmit(true, {});
        } else { (ctx.sfx.uiClick || ctx.sfx.bitClick)(); paint(); }
      } else {
        failed = true;
        r.row.classList.add('cl-wrong');
        rows.forEach((x, i) => { x.row.style.display = 'flex'; x.input.style.display = 'none'; x.check.style.display = 'none'; x.val.style.display = ''; x.exprEl.textContent = exprText(i); x.input.disabled = true; x.check.disabled = true; });
        const last = steps[steps.length - 1];
        ctx.sfx.wrong();
        ctx.onSubmit(false, { feedbackOnWrong: `Work through it step by step — the answer is ${last.answer}${last.unit ? ' ' + last.unit : ''}.` });
      }
    }

    rows.forEach(r => {
      r.check.addEventListener('click', checkActive);
      r.input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkActive(); } });
    });
    paint();
  },
};
