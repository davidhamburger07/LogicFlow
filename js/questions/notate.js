// ============================================================
// questions/notate.js — NOTATE: read the board's shorthand, name the gate.
//
// Board-driven symbol-recognition drill. Each round shows an expression in
// the player's board notation (A · B, A̅, A ∧ B …) and the student picks
// which operation it is. The rounds and the answer buttons come from the
// board's own gate set (AQA sees 4 incl. XOR; OCR sees 3, in ∧ ∨ ¬). Correct
// only if every round is right, so it tests real recognition, not guessing.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema (fully board-driven):  { type:'NOTATE', title }
// ============================================================

import { getBoard, boardRequiresGate } from '../storage.js';
import { gateExpr } from '../notation.js';

function mk(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export const notate = {
  type: 'NOTATE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const board = getBoard();
    const gates = ['AND', 'OR', 'NOT'].concat(boardRequiresGate('XOR', board) ? ['XOR'] : []);
    const tests = shuffle(gates);
    let idx = 0, mistakes = 0, busy = false;

    const wrap = mk('nt');
    const dots = mk('nt-dots');
    const dotEls = tests.map(() => { const d = mk('nt-dot'); dots.appendChild(d); return d; });
    wrap.appendChild(dots);

    const expr = mk('nt-expr'); wrap.appendChild(expr);
    const prompt = mk('nt-prompt'); wrap.appendChild(prompt);

    const btns = mk('nt-btns');
    const btnEls = gates.map(g => { const b = mk('nt-btn', 'button'); b.type = 'button'; b.textContent = g; b.dataset.gate = g; btns.appendChild(b); return b; });
    wrap.appendChild(btns);
    host.appendChild(wrap);

    function paint() {
      const g = tests[idx];
      wrap.dataset.answer = g;
      expr.innerHTML = 'Q = ' + gateExpr(g, {}, board);
      prompt.textContent = `Which operation is this shorthand? (${idx + 1} of ${tests.length})`;
      dotEls.forEach((d, i) => { d.className = 'nt-dot' + (i < idx ? ' done' : i === idx ? ' now' : ''); });
      btnEls.forEach(b => { b.className = 'nt-btn'; b.disabled = false; });
    }
    paint();

    btnEls.forEach(btn => btn.addEventListener('click', () => {
      if (ctx.isAnswered() || busy) return;
      const want = tests[idx];
      busy = true; btnEls.forEach(b => { b.disabled = true; });
      if (btn.dataset.gate === want) { btn.classList.add('good'); (ctx.sfx.uiClick || ctx.sfx.bitClick)(); }
      else { btn.classList.add('bad'); btnEls.find(b => b.dataset.gate === want).classList.add('good'); mistakes++; ctx.sfx.wrong(); }
      setTimeout(() => {
        busy = false; idx++;
        if (idx < tests.length) { paint(); return; }
        dotEls.forEach(d => { d.className = 'nt-dot done'; });
        btnEls.forEach(b => { b.disabled = true; });
        prompt.textContent = mistakes === 0 ? 'All correct — you can read your board\'s shorthand.' : `${mistakes} of ${tests.length} were wrong.`;
        const correct = mistakes === 0;
        if (correct) ctx.sfx.zap();
        ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: 'Match the symbol to the operation — check the shorthand table on the previous page.' });
      }, btn.dataset.gate === want ? 320 : 1000);
    }));
  },
};
