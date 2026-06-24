// ============================================================
// questions/recall.js — RECALL: the format-rotation engine.
//
// "Keep the player on their toes": a recall question carries the SAME
// fact expressed in several formats (`forms`), and on each render one is
// picked at random and delegated to. Varying the retrieval format (pick
// from options / type the term / order / categorise) strengthens memory.
//
// Each form is a complete instance of another question type, with its own
// `title` (the prompt that suits that format). RECALL overrides the
// question-card title/desc with the chosen form's, then renders it.
//
//   render(answerHost, question, ctx) -> delegates -> ctx.onSubmit(...)
//
// Question schema:
//   { type:'RECALL', badge, board, hints?, explain?,
//     forms:[
//       { type:'MC',     title:'What is ASCII?', options:[...], answer:'...' },
//       { type:'TYPEIN', title:'Type the 7-bit text-encoding standard', answer:'ASCII' },
//     ] }
// ============================================================

import { mc } from './mc.js';
import { typein } from './typein.js';
import { order } from './order.js';
import { categorise } from './categorise.js';
import { calc } from './calc.js';

const FORMS = { MC: mc, TYPEIN: typein, ORDER: order, CATEGORISE: categorise, CALC: calc };

export const recall = {
  type: 'RECALL',

  render(host, question, ctx) {
    const forms = (question.forms || []).filter(f => FORMS[f.type]);
    if (!forms.length) { host.innerHTML = ''; ctx.onSubmit(false, {}); return; }

    const pick = forms[Math.floor(Math.random() * forms.length)];

    // adopt the chosen form's prompt in the question card
    const tEl = document.getElementById('q-title');
    if (tEl && pick.title) tEl.textContent = pick.title;
    const dEl = document.getElementById('q-desc');
    if (dEl) {
      if (pick.desc) { dEl.style.display = 'block'; dEl.textContent = pick.desc; }
      else { dEl.style.display = 'none'; }
    }

    const merged = Object.assign({ badge: question.badge, board: question.board }, pick);
    FORMS[pick.type].render(host, merged, ctx);
  },
};
