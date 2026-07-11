// ============================================================
// questions/qatest.js — QATEST: the "QA Tester" mini-game (robust programs).
//
// Three phases, so the student runs the real QA loop instead of just naming
// test-data categories:
//   1 BREAK IT  — the program has NO validation; feed it erroneous/invalid data
//                 and watch it wrongly accept out-of-range values (the bug).
//   2 FIX IT    — add a range check. Board-branched: AQA/OCR PICK the correct
//                 condition; Edexcel/WJEC/Eduqas TYPE the editable Python.
//   3 VERIFY    — enter the EXACT boundary values, then run normal + boundary +
//                 erroneous data through the fixed program; the level clears only
//                 when valid/boundary data is accepted and erroneous is rejected.
//
// Slider: the erroneous category reads "Invalid" for OCR, "Erroneous" otherwise.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Schema: { type:'QATEST', field:'age', range:[1,100],
//   program:{AQA,OCR,Eduqas}, fixedProgram:{AQA,OCR,Eduqas},
//   normal:['25','60'], erroneous:['-5','150','0'],
//   fixOptions:{AQA,OCR,Eduqas}, fixAnswer:{AQA,OCR,Eduqas}, explain }
// ============================================================

import { getBoard, codePanel, forBoard, missionStrip } from './codeview.js';

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function norm(s) { return String(s).toLowerCase().replace(/\s+/g, ' ').trim(); }

export const qatest = {
  type: 'QATEST',

  render(host, question, ctx) {
    host.innerHTML = '';
    const _mission = missionStrip(question); if (_mission) host.appendChild(_mission);
    const board = getBoard();
    const errLabel = board === 'OCR' ? 'Invalid' : 'Erroneous';   // slider: OCR = "Invalid", AQA/others = "Erroneous"
    const editable = board === 'Edexcel' || board === 'WJEC' || board === 'Eduqas';
    const lo = question.range[0], hi = question.range[1];
    const field = question.field || 'value';
    let phase = 1, fixed = false;

    const wrap = el('qa'); wrap.dataset.range = lo + ',' + hi;
    const steps = el('qa-steps');
    ['1 · BREAK IT', '2 · FIX IT', '3 · VERIFY'].forEach((t, i) => { const s = el('qa-step'); s.textContent = t; s.dataset.n = String(i + 1); steps.appendChild(s); });
    wrap.appendChild(steps);
    const progHost = el('qa-prog'); wrap.appendChild(progHost);
    const consoleEl = el('qa-console'); wrap.appendChild(consoleEl);
    const controls = el('qa-controls'); wrap.appendChild(controls);
    const fb = el('qa-fb'); wrap.appendChild(fb);
    host.appendChild(wrap);

    const paintSteps = () => steps.querySelectorAll('.qa-step').forEach(s => { const n = Number(s.dataset.n); s.classList.toggle('qa-step-on', n === phase); s.classList.toggle('qa-step-done', n < phase); });
    const renderProg = () => { progHost.innerHTML = ''; progHost.appendChild(codePanel(forBoard(fixed ? question.fixedProgram : question.program))); };

    function log(input, res, cls) {
      const line = el('qa-log qa-log-' + cls);
      line.innerHTML = `<span class="qa-log-in">${field} = ${input}</span> <span class="qa-log-arrow">→</span> <span class="qa-log-st">${res.label}</span> <span class="qa-log-why">${res.why}</span>`;
      consoleEl.appendChild(line); consoleEl.scrollTop = consoleEl.scrollHeight;
    }
    function run(value) {
      const s = String(value).trim(); const n = Number(s);
      if (s === '') return { st: 'crash', label: 'CRASH', why: 'no input entered (presence error)' };
      if (Number.isNaN(n)) return { st: 'crash', label: 'CRASH', why: `"${s}" is not a number (runtime error)` };
      const inRange = n >= lo && n <= hi;
      if (fixed && !inRange) return { st: 'reject', label: 'REJECTED', why: `${n} is outside ${lo}–${hi}` };
      return { st: 'accept', label: 'ACCEPTED', why: inRange ? `${n} accepted` : `${n} accepted — but it is out of range!`, bad: !inRange };
    }

    // ── PHASE 1 · BREAK IT ──────────────────────────────
    function phase1() {
      phase = 1; fixed = false; paintSteps(); renderProg(); consoleEl.innerHTML = ''; controls.innerHTML = ''; fb.className = 'qa-fb'; fb.textContent = '';
      const intro = el('qa-intro'); intro.innerHTML = `You're the QA tester. This program should only accept a <b>${field}</b> of <b>${lo}–${hi}</b>, but it has <b>no validation</b>. Feed it <b>${errLabel.toLowerCase()}</b> data and prove it accepts what it shouldn't.`;
      controls.appendChild(intro);
      const bank = el('qa-bank');
      bank.appendChild(el('qa-bank-lbl')).textContent = errLabel.toUpperCase() + ' DATA — click to test:';
      const chips = el('qa-chips');
      question.erroneous.forEach(v => {
        const b = el('qa-chip', 'button'); b.type = 'button'; b.textContent = v;
        b.addEventListener('click', () => {
          if (ctx.isAnswered()) return;
          const res = run(v); log(v, res, res.bad ? 'bad' : res.st);
          if (res.bad || res.st === 'crash') { ctx.sfx.wrong(); showFix(); } else (ctx.sfx.uiClick || ctx.sfx.bitClick)();
        });
        chips.appendChild(b);
      });
      bank.appendChild(chips); controls.appendChild(bank);
    }
    function showFix() {
      if (controls.querySelector('.qa-next')) return;
      fb.className = 'qa-fb qa-fb-bug'; fb.innerHTML = `✗ <b>BUG CONFIRMED</b> — ${errLabel.toLowerCase()} data slipped through with no check. Now add one.`;
      const nx = el('qa-next', 'button'); nx.type = 'button'; nx.textContent = 'FIX IT →'; nx.addEventListener('click', phase2); controls.appendChild(nx);
    }

    // ── PHASE 2 · FIX IT ────────────────────────────────
    function phase2() {
      phase = 2; paintSteps(); consoleEl.innerHTML = ''; controls.innerHTML = ''; fb.className = 'qa-fb'; fb.textContent = '';
      const intro = el('qa-intro'); intro.innerHTML = `Add a <b>range check</b> so a ${field} outside ${lo}–${hi} is <b>rejected</b>. Give the condition that should be TRUE for bad data — <code>IF ▢ THEN reject</code>:`;
      controls.appendChild(intro);
      const answer = norm(forBoard(question.fixAnswer));
      if (editable) {
        const row = el('qa-fixrow');
        const inp = el('qa-fixinput', 'input'); inp.type = 'text'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.placeholder = `${field} < ${lo} or ${field} > ${hi}`;
        const btn = el('qa-fixcheck', 'button'); btn.type = 'button'; btn.textContent = 'APPLY FIX →';
        const check = () => { if (norm(inp.value) === answer) applyFix(); else { fb.className = 'qa-fb qa-fb-no'; fb.textContent = `Not quite — reject when the ${field} is below ${lo} OR above ${hi}.`; ctx.sfx.wrong(); } };
        btn.addEventListener('click', check); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
        row.append(inp, btn); controls.appendChild(row);
        setTimeout(() => { try { inp.focus(); } catch (e) {} }, 40);
      } else {
        const opts = el('qa-fixopts');
        forBoard(question.fixOptions).forEach(o => {
          const b = el('qa-fixopt', 'button'); b.type = 'button'; b.textContent = o;
          if (norm(o) === answer) b.dataset.correct = '1';
          b.addEventListener('click', () => {
            if (ctx.isAnswered() || b.disabled) return;
            if (norm(o) === answer) { b.classList.add('qa-ok'); applyFix(); }
            else { b.classList.add('qa-bad'); b.disabled = true; fb.className = 'qa-fb qa-fb-no'; fb.textContent = 'That rejects the wrong values — try again.'; ctx.sfx.wrong(); }
          });
          opts.appendChild(b);
        });
        controls.appendChild(opts);
      }
    }
    function applyFix() { fixed = true; ctx.sfx.zap(); fb.className = 'qa-fb qa-fb-ok'; fb.textContent = '✓ Range check added — now verify it works.'; controls.querySelectorAll('button,input').forEach(x => { x.disabled = true; }); setTimeout(phase3, 550); }

    // ── PHASE 3 · VERIFY ────────────────────────────────
    function phase3() {
      phase = 3; paintSteps(); renderProg(); consoleEl.innerHTML = ''; controls.innerHTML = ''; fb.className = 'qa-fb'; fb.textContent = '';
      const intro = el('qa-intro'); intro.innerHTML = `Now verify. First enter the <b>two boundary values</b> — the exact edges of ${lo}–${hi} — then run every test.`;
      controls.appendChild(intro);
      const brow = el('qa-boundrow'); brow.appendChild(el('qa-bound-lbl')).textContent = 'BOUNDARY VALUES:';
      const b1 = el('qa-boundinput', 'input'); b1.type = 'text'; b1.inputMode = 'numeric'; b1.autocomplete = 'off'; b1.placeholder = 'low edge';
      const b2 = el('qa-boundinput', 'input'); b2.type = 'text'; b2.inputMode = 'numeric'; b2.autocomplete = 'off'; b2.placeholder = 'high edge';
      brow.append(b1, b2); controls.appendChild(brow);
      const runBtn = el('qa-runall', 'button'); runBtn.type = 'button'; runBtn.textContent = '▶ RUN ALL TESTS'; controls.appendChild(runBtn);
      runBtn.addEventListener('click', () => {
        if (ctx.isAnswered()) return;
        const bs = [Number(b1.value), Number(b2.value)].sort((a, b) => a - b);
        if (!(bs[0] === lo && bs[1] === hi)) { fb.className = 'qa-fb qa-fb-no'; fb.innerHTML = `The boundaries of ${lo}–${hi} are exactly <b>${lo}</b> and <b>${hi}</b> — enter those two.`; ctx.sfx.wrong(); return; }
        consoleEl.innerHTML = '';
        const tests = [...question.normal.map(v => ({ v, cat: 'normal' })), { v: String(lo), cat: 'boundary' }, { v: String(hi), cat: 'boundary' }, ...question.erroneous.map(v => ({ v, cat: 'erroneous' }))];
        let allPass = true;
        tests.forEach(tt => {
          const res = run(tt.v);
          const shouldAccept = tt.cat !== 'erroneous';
          const ok = res.st !== 'crash' && (res.st === 'accept') === shouldAccept;
          if (!ok) allPass = false;
          log(tt.v + ` (${tt.cat === 'erroneous' ? errLabel.toLowerCase() : tt.cat})`, res, ok ? 'accept' : 'bad');
        });
        if (allPass) { fb.className = 'qa-fb qa-fb-ok'; fb.innerHTML = `✓ <b>ALL TESTS PASS</b> — normal &amp; boundary accepted, ${errLabel.toLowerCase()} rejected. The program is robust!`; runBtn.disabled = true; b1.disabled = true; b2.disabled = true; ctx.sfx.zap(); ctx.onSubmit(true, {}); }
        else { fb.className = 'qa-fb qa-fb-no'; fb.textContent = 'Some tests failed — check the console.'; ctx.sfx.wrong(); }
      });
    }

    phase1();
  },
};
