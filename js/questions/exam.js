// ============================================================
// questions/exam.js — exam-style structured question (Past Paper).
//
// Same contract as the other question types, but it reports MARKS:
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, { marks, maxMarks })
//
// The student writes their answer (active recall), reveals the mark
// scheme, and SELF-MARKS by ticking each marking point they made —
// exactly the skill examiners reward. Marks earned = ticked points
// (capped at the question's mark allocation).
//
// This module owns its own answer UI; the engine hides the read-only
// visual.js panel for EXAM and runs it only in the `pastpaper` mode.
//
// Question schema (in content.js, under phase.paper[]):
//   { type:'EXAM', badge, board, marks:4, title:'…the question…',
//     desc?, markScheme:[ '…acceptable point…', … ], explain? }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const exam = {
  type: 'EXAM',

  render(host, question, ctx) {
    host.innerHTML = '';
    const scheme = question.markScheme || [];
    const marks = question.marks || scheme.length || 1;
    let revealed = false, submitted = false;
    const ticked = new Set();

    const wrap = el('exam');
    const marksLine = el('exam-marks');
    marksLine.textContent = `[ ${marks} MARK${marks === 1 ? '' : 'S'} ]`;

    const ta = el('exam-input', 'textarea');
    ta.rows = 4;
    ta.placeholder = 'Write your answer here, then reveal the mark scheme and award yourself the marks you earned.';

    const reveal = el('exam-reveal', 'button');
    reveal.type = 'button';
    reveal.textContent = 'REVEAL MARK SCHEME →';

    const schemeBox = el('exam-scheme');
    schemeBox.style.display = 'none';
    const head = el('exam-scheme-head');
    head.textContent = 'MARK SCHEME — tick each point your answer made:';
    const points = el('exam-points');
    scheme.forEach((pt, i) => {
      const p = el('exam-point', 'button');
      p.type = 'button'; p.dataset.i = i;
      p.innerHTML = `<span class="exam-tick">+</span><span class="exam-point-text">${pt}</span>`;
      p.addEventListener('click', () => {
        if (submitted) return;
        if (ticked.has(i)) { ticked.delete(i); p.classList.remove('ticked'); }
        else { ticked.add(i); p.classList.add('ticked'); }
        p.querySelector('.exam-tick').textContent = ticked.has(i) ? '✓' : '+';
        ctx.sfx.uiClick();
        updateTally();
      });
      points.appendChild(p);
    });
    const tally = el('exam-tally');
    const submit = el('exam-submit', 'button');
    submit.type = 'button'; submit.textContent = 'SUBMIT MARKS →';
    schemeBox.append(head, points, tally, submit);

    wrap.append(marksLine, ta, reveal, schemeBox);
    host.appendChild(wrap);

    const earned = () => Math.min(ticked.size, marks);
    function updateTally() { tally.textContent = `${earned()} / ${marks} marks`; }
    updateTally();

    reveal.addEventListener('click', () => {
      if (revealed) return;
      revealed = true;
      ta.readOnly = true; ta.classList.add('locked');
      reveal.style.display = 'none';
      schemeBox.style.display = 'block';
      ctx.sfx.uiClick();
    });
    submit.addEventListener('click', () => {
      if (submitted || !revealed) return;
      submitted = true;
      wrap.classList.add('done');
      points.querySelectorAll('.exam-point').forEach(p => { p.disabled = true; });
      submit.disabled = true;
      const m = earned();
      ctx.sfx.zap();
      ctx.onSubmit(m === marks, { marks: m, maxMarks: marks });
    });
  },
};
