// ============================================================
// questions/truthtable.js — TRUTHTABLE: complete a gate/expression's
// output column by toggling Q for each input row. The exam-accurate
// "complete the truth table" skill — you produce the column, not pick it.
//
// For bracketed expressions (Q = A AND (NOT B)), an optional WORKING
// column can be added — exactly like drawing the extra column on paper:
// the student fills the inner part (NOT B) for every row first (checked,
// retry in place), and only then does the Q column unlock.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'TRUTHTABLE', inputs:['A','B'],
//     rows:[[0,0],[0,1],[1,0],[1,1]], answer:[0,0,1,0],   // Q per row
//     work?:[ { label:'NOT B', answer:[1,0,1,0] } ],      // working columns
//     title:'Complete the truth table for Q = A AND (NOT B).',
//     badge, board, desc, hints, explain }
// ============================================================

import { gateExpr } from '../notation.js';

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

// render a structural expression spec into the board's shorthand. Operand refs:
// aWork/bWork/ofWork index into the (already-rendered) working-column exprs.
function renderSpec(spec, workExprs) {
  const a = spec.aWork != null ? workExprs[spec.aWork] : (spec.a || 'A');
  const b = spec.bWork != null ? workExprs[spec.bWork] : (spec.b || 'B');
  const of = spec.ofWork != null ? workExprs[spec.ofWork] : (spec.of || 'A');
  return spec.op === 'NOT' ? gateExpr('NOT', { a: of }) : gateExpr(spec.op, { a, b });
}

export const truthtable = {
  type: 'TRUTHTABLE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const rows = question.rows;
    const answer = question.answer;
    const inputs = question.inputs || ['A', 'B'];
    const work = question.work || [];
    const user = new Array(rows.length).fill(0);
    const workUser = work.map(() => new Array(rows.length).fill(0));

    // optional board-notated expression (the working labels + a Q = … header)
    const notate = question.notate || null;
    const workExprs = notate ? (notate.work || []).map(s => renderSpec(s, [])) : null;

    const wrap = el('tt');
    if (notate && notate.q) { const hdr = el('tt-expr'); hdr.innerHTML = 'Q = ' + renderSpec(notate.q, workExprs); wrap.appendChild(hdr); }
    const table = el('tt-table');
    const head = el('tt-row tt-head');
    inputs.forEach(h => { head.appendChild(el('tt-cell tt-in')).textContent = h; });
    work.forEach((w, wi) => { const c = el('tt-cell tt-wh'); if (workExprs) c.innerHTML = workExprs[wi]; else c.textContent = w.label; head.appendChild(c); });
    head.appendChild(el('tt-cell tt-qh')).textContent = 'Q';
    table.appendChild(head);

    const qCells = [];
    const wCells = work.map(() => []);
    rows.forEach((r, i) => {
      const row = el('tt-row');
      r.forEach(v => { row.appendChild(el('tt-cell tt-in')).textContent = String(v); });
      work.forEach((w, wi) => {
        const c = el('tt-cell tt-q tt-w', 'button');
        c.type = 'button'; c.textContent = '0';
        c.addEventListener('click', () => {
          if (ctx.isAnswered() || c.disabled) return;
          c.classList.remove('tt-bad');
          workUser[wi][i] ^= 1;
          c.textContent = String(workUser[wi][i]);
          c.classList.toggle('on', !!workUser[wi][i]);
          (ctx.sfx.bitClick || ctx.sfx.uiClick)();
        });
        wCells[wi].push(c);
        row.appendChild(c);
      });
      const q = el('tt-cell tt-q', 'button');
      q.type = 'button'; q.textContent = '0';
      q.addEventListener('click', () => {
        if (ctx.isAnswered() || q.disabled) return;
        user[i] ^= 1;
        q.textContent = String(user[i]);
        q.classList.toggle('on', !!user[i]);
        (ctx.sfx.bitClick || ctx.sfx.uiClick)();
      });
      qCells.push(q);
      row.appendChild(q);
      table.appendChild(row);
    });
    wrap.appendChild(table);

    const hint = el('tt-hint-line');
    wrap.appendChild(hint);

    const submit = el('tt-submit', 'button');
    submit.type = 'button';
    wrap.appendChild(submit);
    host.appendChild(wrap);

    let stage = work.length ? 1 : 2;
    function paintStage() {
      if (stage === 1) {
        qCells.forEach(q => { q.disabled = true; q.classList.add('tt-off'); });
        hint.textContent = `Work the brackets first: tap each row's ${work.map(w => w.label).join(' and ')} to set it, then check.`;
        submit.textContent = 'CHECK WORKING →';
      } else {
        qCells.forEach(q => { q.disabled = false; q.classList.remove('tt-off'); });
        wCells.flat().forEach(c => { c.disabled = true; });
        hint.textContent = work.length
          ? 'Working locked in — now combine the columns: tap each Q to set it.'
          : 'Tap each Q to set it to 0 or 1.';
        submit.textContent = 'CHECK →';
      }
    }
    paintStage();

    function checkWorking() {
      let allOk = true;
      work.forEach((w, wi) => {
        wCells[wi].forEach((c, i) => {
          const ok = workUser[wi][i] === w.answer[i];
          c.classList.toggle('tt-bad', !ok);
          if (!ok) allOk = false;
        });
      });
      if (allOk) {
        stage = 2; paintStage();
        ctx.sfx.uiClick && ctx.sfx.uiClick();
      } else {
        hint.textContent = 'Not quite — fix the marked rows of the working column, one row at a time.';
        ctx.sfx.wrong();
      }
    }

    function checkQ() {
      const correct = user.every((v, i) => v === answer[i]);
      qCells.forEach((c, i) => { c.disabled = true; if (user[i] !== answer[i]) c.classList.add('tt-bad'); });
      submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `The correct Q column is ${answer.join(', ')}.` });
    }

    submit.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      stage === 1 ? checkWorking() : checkQ();
    });
  },
};
