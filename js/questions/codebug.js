// ============================================================
// questions/codebug.js — CODE_BUG question type (spot-the-bug).
//
// The student reads a program that has ONE bug and clicks the line that
// contains it. The correct line is revealed and marked; the explanation
// names the error type (syntax / logic / runtime) and the fix.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Schema (code may be a string or a { AQA, OCR, Eduqas } map):
//   { type: 'CODE_BUG', code: '…', buggyLine: 2 /* 0-indexed */, … }
// (buggyLine may also be a per-board map if the line index differs.)
// ============================================================

import { codePanel, forBoard, notationCaption, missionStrip } from './codeview.js';

function el(cls) { const e = document.createElement('div'); if (cls) e.className = cls; return e; }

export const codebug = {
  type: 'CODE_BUG',

  render(answerHost, question, ctx) {
    answerHost.innerHTML = '';
    const _mission = missionStrip(question); if (_mission) answerHost.appendChild(_mission);
    const code = forBoard(question.code);
    const buggy = Number(forBoard(question.buggyLine));

    const wrap = el('codebug');
    const cap = notationCaption(question); if (cap) wrap.appendChild(cap);
    const hint = el('cb-hint'); hint.textContent = '▶ Click the line with the bug:'; wrap.appendChild(hint);

    const panel = codePanel(code);
    panel.classList.add('code-clickable');
    wrap.appendChild(panel);

    panel.querySelectorAll('.code-line').forEach((line, i) => {
      line.addEventListener('click', () => {
        if (ctx.isAnswered()) return;
        const correct = i === buggy;
        panel.querySelectorAll('.code-line').forEach((l, j) => {
          l.classList.add('bug-locked');
          if (j === buggy) l.classList.add('bug-correct');
        });
        if (!correct) line.classList.add('bug-wrong');
        if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
        ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `Not that line — the bug is on line ${buggy + 1}.` });
      });
    });

    answerHost.appendChild(wrap);
  },
};
