// ============================================================
// questions/codetrace.js — CODE_TRACE question type.
//
// The student READS a short program and works out exactly what it
// prints (a "trace the output" / trace-table skill — the most-examined
// part of the programming strand). They TYPE the output; it is not
// multiple choice, so they produce the answer rather than recognise it.
//
// Same contract as the other question types:
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema (in content.js):
//   {
//     type: 'CODE_TRACE',
//     code:   '…program…'  OR  { AQA, OCR, Eduqas }  (per-board notation),
//     answer: 'the exact text the program outputs',   // compared leniently
//     badge, board, title, desc, hints, explain
//   }
//
// The trace answer is the same whatever the board's notation, so it is
// authored once. Code rendering is shared via codeview.js, and this
// module owns its visual (the engine hides the read-only panel).
// ============================================================

import { codePanel, forBoard, notationCaption, missionStrip } from './codeview.js';
import { loadSkulpt, runPython } from './codewrite.js';

// lenient compare: trim, drop surrounding quotes, collapse spaces, case-insensitive
function norm(s) {
  return String(s).trim().replace(/^["']+|["']+$/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export const codetrace = {
  type: 'CODE_TRACE',

  render(answerHost, question, ctx) {
    answerHost.innerHTML = '';
    const _mission = missionStrip(question); if (_mission) answerHost.appendChild(_mission);
    const wrap = document.createElement('div');
    wrap.className = 'codetrace';

    const cap = notationCaption(question);
    if (cap) wrap.appendChild(cap);
    wrap.appendChild(codePanel(forBoard(question.code)));

    const box = document.createElement('div');
    box.className = 'ct-answer';
    box.innerHTML = '<span class="ct-label">▶ Type what this program prints:</span>';
    const row = document.createElement('div');
    row.className = 'ct-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ct-input';
    input.placeholder = 'the output…';
    input.autocomplete = 'off';
    input.spellcheck = false;
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'ct-submit';
    submit.textContent = 'CHECK →';
    row.appendChild(input);
    row.appendChild(submit);
    box.appendChild(row);
    wrap.appendChild(box);

    // post-answer "▶ Run it" — execute the Python version to show the real
    // output (lazy-loads Skulpt), so a wrong trace is corrective.
    const runRow = document.createElement('div');
    runRow.className = 'ct-run-row';
    runRow.style.display = 'none';
    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'ct-run-btn';
    runBtn.textContent = '▶ Run it';
    const runOut = document.createElement('div');
    runOut.className = 'ct-run-out';
    runRow.append(runBtn, runOut);
    wrap.appendChild(runRow);
    runBtn.addEventListener('click', async () => {
      runBtn.disabled = true;
      runOut.textContent = 'Running…';
      try { await loadSkulpt(); } catch { runOut.textContent = 'Could not load the runner.'; runBtn.disabled = false; return; }
      const py = typeof question.code === 'string' ? question.code : (question.code.Eduqas || question.code.OCR || question.code.AQA);
      const r = await runPython(py, []);
      runOut.innerHTML = r.ok
        ? `<span class="ct-run-label">Actual output:</span> <span class="ct-run-val">${escapeHtml(r.out.trim() || '(no output)')}</span>`
        : `<span class="ct-run-err">${escapeHtml(r.err)}</span>`;
    });

    answerHost.appendChild(wrap);

    const go = () => {
      if (ctx.isAnswered()) return;
      const correct = norm(input.value) === norm(question.answer);
      input.disabled = true;
      submit.disabled = true;
      runRow.style.display = 'flex';
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : {
        feedbackOnWrong: `Trace it line by line, tracking each variable — the output is "${question.answer}".`,
      });
    };
    submit.addEventListener('click', go);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 60);
  },
};
