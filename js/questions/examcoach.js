// ============================================================
// questions/examcoach.js — EXAMCOACH: examiner-coached exam question.
//
// The exam-lesson question type. The student writes an answer, then reveals
// examiner guidance and marks themselves. The reveal teaches EXAM TECHNIQUE:
//   - INDICATIVE CONTENT — what a strong answer draws on
//   - ⚠ COMMON MISTAKES — why students drop marks
//   - ★ MODEL ANSWER — how to phrase a full-mark response
//
// MARKING MODE depends on the question:
//   • LEVELS OF RESPONSE (when `levels` is set) — the correct model for a
//     high-tariff "Discuss / Evaluate" answer. The indicative content is shown
//     as guidance (NOT a 1-mark-per-point tally); the student judges which BAND
//     their answer reached against level descriptors and awards a mark in that
//     band. This mirrors how real 6/8-mark questions are actually marked.
//   • POINT TALLY (fallback, no `levels`) — tick each mark point made; used for
//     short coached questions where each point is genuinely worth one mark.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(pass, { marks, maxMarks })
//
// Question schema:
//   { type:'EXAMCOACH', marks:6, title:'…', markScheme:[ '…', … ],
//     levels?:[ { band:3, lo:5, hi:6, desc:'…descriptor…' }, … ],  // high → low
//     commonMistakes:[ '…' ], modelAnswer:'…', badge, board, desc, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const examcoach = {
  type: 'EXAMCOACH',

  render(host, question, ctx) {
    host.innerHTML = '';
    const scheme = question.markScheme || [];
    const marks = question.marks || scheme.length || 1;
    const levels = Array.isArray(question.levels) && question.levels.length ? question.levels : null;
    let revealed = false, submitted = false;

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

    // ---- indicative content / mark points --------------------
    const ticked = new Set();               // used only in point-tally mode
    const head = el('exam-scheme-head');
    const points = el('exam-points');
    if (levels) {
      // guidance list — reading it is not worth a mark; the LEVEL decides the mark
      head.textContent = 'INDICATIVE CONTENT — what a strong answer draws on (you don’t need every point):';
      scheme.forEach(pt => {
        const li = el('exam-indic');
        li.innerHTML = `<span class="exam-indic-dot">•</span><span class="exam-point-text">${pt}</span>`;
        points.appendChild(li);
      });
    } else {
      head.textContent = 'MARK SCHEME — tick each point your answer made:';
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
    }
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

    // ---- levels-of-response selector -------------------------
    let chosenMark = null;
    if (levels) {
      const lvBox = el('exam-levels');
      lvBox.appendChild(el('exam-coach-head')).textContent = '📏 MARK YOURSELF BY LEVEL';
      const lvNote = el('exam-levels-note');
      lvNote.textContent = 'A real examiner marks holistically, not by counting points — pick the band your answer best matches, then the mark within it.';
      lvBox.appendChild(lvNote);

      const markRow = el('exam-mark-pick');
      markRow.style.display = 'none';

      const paintMarks = (lo, hi) => {
        markRow.innerHTML = '';
        markRow.appendChild(el('exam-mark-lbl', 'span')).textContent = 'Your mark:';
        for (let m = lo; m <= hi; m++) {
          const b = el('exam-mark-btn', 'button'); b.type = 'button'; b.textContent = String(m);
          b.addEventListener('click', () => {
            if (submitted) return;
            chosenMark = m;
            markRow.querySelectorAll('.exam-mark-btn').forEach(x => x.classList.remove('sel'));
            b.classList.add('sel');
            ctx.sfx.uiClick();
            submit.disabled = false;
          });
          markRow.appendChild(b);
        }
        markRow.style.display = 'flex';
      };

      levels.forEach(lv => {
        const card = el('exam-level', 'button'); card.type = 'button';
        const range = lv.lo === lv.hi ? `${lv.lo}` : `${lv.lo}–${lv.hi}`;
        card.innerHTML = `<span class="exam-level-band">LEVEL ${lv.band} · ${range} mark${lv.hi === 1 ? '' : 's'}</span>`
          + `<span class="exam-level-desc">${lv.desc}</span>`;
        card.addEventListener('click', () => {
          if (submitted) return;
          lvBox.querySelectorAll('.exam-level').forEach(x => x.classList.remove('sel'));
          card.classList.add('sel');
          chosenMark = null;
          submit.disabled = true;
          paintMarks(lv.lo, lv.hi);
          lvBox.appendChild(markRow);   // keep the mark picker under the chosen band
          ctx.sfx.uiClick();
        });
        lvBox.appendChild(card);
      });
      schemeBox.appendChild(lvBox);
      schemeBox.appendChild(markRow);
    }

    const submit = el('exam-submit', 'button');
    submit.type = 'button'; submit.textContent = 'SUBMIT MARKS →';
    if (levels) submit.disabled = true;   // must pick a level + mark first
    schemeBox.appendChild(submit);

    wrap.append(marksLine, ta, reveal, schemeBox);
    host.appendChild(wrap);

    const earned = () => (levels ? (chosenMark == null ? 0 : chosenMark) : Math.min(ticked.size, marks));
    function updateTally() { if (!levels) tally.textContent = `${earned()} / ${marks} marks`; }
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
      if (levels && chosenMark == null) return;
      submitted = true;
      wrap.classList.add('done');
      points.querySelectorAll('.exam-point').forEach(p => { p.disabled = true; });
      wrap.querySelectorAll('.exam-level, .exam-mark-btn').forEach(b => { b.disabled = true; });
      submit.disabled = true;
      const m = earned();
      ctx.sfx[m >= Math.ceil(marks * 0.6) ? 'zap' : 'wrong']();
      ctx.onSubmit(m === marks, { marks: m, maxMarks: marks });
    });
  },
};
