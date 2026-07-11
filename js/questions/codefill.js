// ============================================================
// questions/codefill.js — CODE_FILL question type ("complete the code").
//
// The student sees a program with one BLANK (the ▢ marker) and picks the
// token that belongs there (an operator, comparison, loop bound, keyword).
// The chosen token drops into the blank and is marked right/wrong.
//
// Same contract as the other question types:
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema (in content.js) — code/options/answer may each be a
// plain value (board-agnostic) or a { AQA, OCR, Eduqas } map:
//   {
//     type: 'CODE_FILL',
//     code:    '… a line with a ▢ blank …',
//     options: ['+', '-', '*', 'MOD'],   // candidate tokens
//     answer:  '+',                       // the correct token
//     badge, board, title, desc, hints, explain
//   }
// ============================================================

import { codePanel, forBoard, notationCaption, missionStrip } from './codeview.js';

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export const codefill = {
  type: 'CODE_FILL',

  render(answerHost, question, ctx) {
    answerHost.innerHTML = '';
    const _mission = missionStrip(question); if (_mission) answerHost.appendChild(_mission);
    const code = forBoard(question.code);
    const options = forBoard(question.options) || [];
    const answer = String(forBoard(question.answer));

    const wrap = document.createElement('div');
    wrap.className = 'codefill';
    const cap = notationCaption(question);
    if (cap) wrap.appendChild(cap);
    const panel = codePanel(code);
    wrap.appendChild(panel);
    const blank = panel.querySelector('.code-blank');

    const label = document.createElement('div');
    label.className = 'cf-label';
    label.textContent = '▶ Pick the missing part:';
    wrap.appendChild(label);

    const opts = document.createElement('div');
    opts.className = 'cf-opts';
    shuffle([...options]).forEach(opt => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cf-opt';
      b.textContent = opt;
      b.addEventListener('click', () => {
        if (ctx.isAnswered()) return;
        const correct = String(opt) === answer;
        if (blank) { blank.textContent = opt; blank.classList.add(correct ? 'filled-ok' : 'filled-bad'); }
        opts.querySelectorAll('.cf-opt').forEach(x => {
          x.disabled = true;
          if (String(x.textContent) === answer) x.classList.add('correct');
        });
        if (!correct) b.classList.add('chosen-bad');
        if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
        ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `The blank should be "${answer}".` });
      });
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    answerHost.appendChild(wrap);
  },
};
