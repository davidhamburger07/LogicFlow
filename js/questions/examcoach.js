// ============================================================
// questions/examcoach.js — EXAMCOACH: examiner-coached exam question.
//
// The exam-lesson question type. Like EXAM (write -> reveal mark scheme ->
// self-mark, reports MARKS), but the reveal also teaches EXAM TECHNIQUE:
//   - the mark points (tickable)
//   - ⚠ COMMON MISTAKES — why students drop marks (e.g. "16 bits" trap)
//   - ★ MODEL ANSWER — how to phrase a full-mark response
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, { marks, maxMarks })
//
// Question schema:
//   { type:'EXAMCOACH', marks:2, title:'…', markScheme:[ '…', … ],
//     commonMistakes:[ '…trap…', … ], modelAnswer:'…full-mark phrasing…',
//     badge, board, desc, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const examcoach = {
  type: 'EXAMCOACH',

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
    ta.placeholder = 'Write your answer here, then reveal the examiner guidance and mark yourself.';

    const reveal = el('exam-reveal', 'button');
    reveal.type = 'button';
    reveal.textContent = 'REVEAL MARK SCHEME & GUIDANCE →';

    const schemeBox = el('exam-scheme');
    schemeBox.style.display = 'none';
    const head = el('exam-scheme-head');
    head.textContent = 'MARK SCHEME — tick each point your answer made:';
    const points = el('exam-points');
    scheme.forEach((pt, i) => {
      const p = el('exam-point', 'button');
      p.type = 'button';
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
    schemeBox.append(head, points, tally);

    if (question.commonMistakes && question.commonMistakes.length) {
      const box = el('exam-mistakes');
      box.innerHTML = `<div class="exam-coach-head">⚠ COMMON MISTAKES</div><ul>${question.commonMistakes.map(m => `<li>${m}</li>`).join('')}</ul>`;
      schemeBox.appendChild(box);
    }
    if (question.modelAnswer) {
      const box = el('exam-model');
      box.innerHTML = `<div class="exam-coach-head">★ MODEL ANSWER</div><div class="exam-model-text">${question.modelAnswer}</div>`;
      schemeBox.appendChild(box);
    }

    const submit = el('exam-submit', 'button');
    submit.type = 'button'; submit.textContent = 'SUBMIT MARKS →';
    schemeBox.appendChild(submit);

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
