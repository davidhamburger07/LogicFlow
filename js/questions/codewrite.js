// ============================================================
// questions/codewrite.js — CODE_WRITE: write a whole program.
//
// The student WRITES code in an editor (the actual program-writing
// skill — what WJEC's on-screen coding and the practical exams test),
// then reveals a MODEL ANSWER (in their board's notation) and a marking
// checklist, and SELF-MARKS by ticking each point their program does.
//
// It reports MARKS (like the EXAM type), so the engine treats it as a
// self-marked, no-lives question (half marks or more = passed). No code
// interpreter is needed — keeping the build light.
//
// Question schema (in content.js):
//   { type:'CODE_WRITE', badge, board, marks:4, title:'the task',
//     desc?, tests?:['input 4 → "even"', …],
//     starter?: '…'  OR { AQA, OCR, Eduqas },     // optional editor prefill
//     model:   { AQA, OCR, Eduqas }  OR '…',       // the model solution
//     checklist:[ '…marking point…', … ], explain? }
// ============================================================

import { codePanel, forBoard, notationCaption } from './codeview.js';

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---- Skulpt (real Python) — lazy-loaded on first RUN TESTS so it never
// weighs down the initial page load. The vendored engine lives in js/vendor.
let skulptPromise = null;
export function loadSkulpt() {
  if (window.Sk && window.Sk.builtinFiles) return Promise.resolve();
  if (skulptPromise) return skulptPromise;
  const addScript = src => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
  skulptPromise = addScript('js/vendor/skulpt.min.js').then(() => addScript('js/vendor/skulpt-stdlib.js'));
  return skulptPromise;
}

function pyErrString(e) {
  try { const s = e && e.toString && e.toString(); if (s && s !== '[object Object]') return s; } catch { /* fall through */ }
  return 'Your program could not run.';
}

// run `code` as Python 3, feeding `stdin` values to input() and capturing
// everything print()ed. Resolves { ok, out, err } — never rejects.
export function runPython(code, stdin) {
  const Sk = window.Sk;
  const queue = (stdin || []).map(String);
  let out = '';
  Sk.configure({
    output: t => { out += t; },
    read: fn => {
      if (!Sk.builtinFiles || !Sk.builtinFiles.files[fn]) throw new Error("File not found: '" + fn + "'");
      return Sk.builtinFiles.files[fn];
    },
    inputfun: () => (queue.length ? queue.shift() : ''),
    inputfunTakesPrompt: true,
    __future__: Sk.python3,
    execLimit: 5000,                 // ms — stops a runaway loop
  });
  return Sk.misceval.asyncToPromise(() => Sk.importMainWithBody('<stdin>', false, code, true))
    .then(() => ({ ok: true, out }))
    .catch(e => ({ ok: false, out, err: pyErrString(e) }));
}

// lenient output match: ignore trailing spaces, surrounding blank lines, case
function normOut(s) { return String(s).replace(/\r/g, '').replace(/[ \t]+$/gm, '').trim().toLowerCase(); }

function caseRow(c, r, pass) {
  const row = el('cw-case ' + (pass ? 'pass' : 'fail'));
  const desc = c.label || (c.stdin && c.stdin.length ? 'input: ' + c.stdin.join(', ') : (c.harness || 'no input'));
  row.innerHTML = `<div class="cw-case-head"><span class="cw-case-mark">${pass ? '✓' : '✗'}</span><span class="cw-case-desc">${escapeHtml(desc)}</span></div>`;
  if (!pass) {
    const detail = el('cw-case-detail');
    detail.innerHTML = r.ok
      ? `expected <b>${escapeHtml(c.expect)}</b> · your output <b>${escapeHtml(r.out.trim() || '(nothing)')}</b>`
      : `<span class="cw-case-err">${escapeHtml(r.err)}</span>`;
    row.appendChild(detail);
  }
  return row;
}

async function runTests(btn, host, code, cases, ctx) {
  if (!code.trim()) { host.innerHTML = '<div class="cw-run-msg">Write some code first, then run the tests.</div>'; return; }
  btn.disabled = true;
  const label = btn.textContent; btn.textContent = 'RUNNING…';
  host.innerHTML = '<div class="cw-run-msg">Starting Python…</div>';
  try { await loadSkulpt(); }
  catch { host.innerHTML = '<div class="cw-run-msg cw-case-err">Could not load the Python runner.</div>'; btn.disabled = false; btn.textContent = label; return; }
  host.innerHTML = '';
  let passed = 0;
  for (const c of cases) {
    const full = c.harness ? (code + '\n' + c.harness) : code;
    let r; try { r = await runPython(full, c.stdin); } catch (e) { r = { ok: false, out: '', err: pyErrString(e) }; }
    const ok = r.ok && normOut(r.out) === normOut(c.expect);
    if (ok) passed++;
    host.appendChild(caseRow(c, r, ok));
  }
  const all = passed === cases.length;
  const summary = el('cw-run-summary ' + (all ? 'all' : ''));
  summary.textContent = `${passed} / ${cases.length} TESTS PASSED` + (all ? '  — it does what the question asks ✓' : '');
  host.insertBefore(summary, host.firstChild);
  ctx.sfx[all ? 'zap' : 'wrong']();
  btn.disabled = false; btn.textContent = label;
}

export const codewrite = {
  type: 'CODE_WRITE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const scheme = question.checklist || [];
    const marks = question.marks || scheme.length || 1;
    let revealed = false, submitted = false;
    const ticked = new Set();

    const wrap = el('cw');
    const marksLine = el('cw-marks');
    marksLine.textContent = `[ WRITE CODE · ${marks} MARK${marks === 1 ? '' : 'S'} ]`;
    wrap.appendChild(marksLine);

    if (question.tests && question.tests.length) {
      const tests = el('cw-tests');
      tests.innerHTML = `<div class="cw-tests-head">YOUR PROGRAM SHOULD:</div><ul>${question.tests.map(t => `<li>${t}</li>`).join('')}</ul>`;
      wrap.appendChild(tests);
    }

    wrap.appendChild(el('cw-label')).textContent = '▶ YOUR CODE — write it in any notation you like';
    const ta = el('cw-input', 'textarea');
    ta.spellcheck = false; ta.autocomplete = 'off'; ta.rows = 7;
    ta.placeholder = 'Write your program here…';
    const starter = forBoard(question.starter);
    if (starter) ta.value = starter;
    // Tab indents by two spaces instead of leaving the box
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 2;
      }
    });
    wrap.appendChild(ta);

    // ▶ RUN TESTS — execute the student's code (as Python) against the
    // question's test cases and show pass/fail, just like an on-screen exam.
    if (question.cases && question.cases.length) {
      const runBar = el('cw-runbar');
      const runBtn = el('cw-run-btn', 'button');
      runBtn.type = 'button'; runBtn.textContent = '▶ RUN TESTS';
      const runNote = el('cw-run-note'); runNote.textContent = 'runs your code as Python';
      runBar.append(runBtn, runNote);
      const runOut = el('cw-run-out');
      wrap.append(runBar, runOut);
      runBtn.addEventListener('click', () => runTests(runBtn, runOut, ta.value, question.cases, ctx));
    }

    const reveal = el('cw-reveal', 'button');
    reveal.type = 'button'; reveal.textContent = 'REVEAL MODEL ANSWER & MARK SCHEME →';
    wrap.appendChild(reveal);

    const schemeBox = el('cw-scheme');
    schemeBox.style.display = 'none';
    schemeBox.appendChild(el('cw-model-head')).textContent = 'MODEL ANSWER';
    const cap = notationCaption({ code: question.model });
    if (cap) schemeBox.appendChild(cap);
    schemeBox.appendChild(codePanel(forBoard(question.model)));

    schemeBox.appendChild(el('cw-points-head')).textContent = 'MARK YOUR CODE — tick each point your program does:';
    const points = el('cw-points');
    scheme.forEach((pt, i) => {
      const p = el('cw-point', 'button');
      p.type = 'button'; p.dataset.i = i;
      p.innerHTML = `<span class="cw-tick">+</span><span class="cw-point-text">${pt}</span>`;
      p.addEventListener('click', () => {
        if (submitted) return;
        if (ticked.has(i)) { ticked.delete(i); p.classList.remove('ticked'); }
        else { ticked.add(i); p.classList.add('ticked'); }
        p.querySelector('.cw-tick').textContent = ticked.has(i) ? '✓' : '+';
        ctx.sfx.uiClick();
        updateTally();
      });
      points.appendChild(p);
    });
    schemeBox.appendChild(points);
    const tally = el('cw-tally');
    schemeBox.appendChild(tally);
    const submit = el('cw-submit', 'button');
    submit.type = 'button'; submit.textContent = 'SUBMIT MARKS →';
    schemeBox.appendChild(submit);
    wrap.appendChild(schemeBox);
    host.appendChild(wrap);

    const earned = () => Math.min(ticked.size, marks);
    function updateTally() { tally.textContent = `${earned()} / ${marks} marks`; }
    updateTally();

    reveal.addEventListener('click', () => {
      if (revealed) return;
      revealed = true;
      ta.readOnly = true; ta.classList.add('locked');
      reveal.style.display = 'none';
      schemeBox.style.display = 'flex';
      ctx.sfx.uiClick();
    });
    submit.addEventListener('click', () => {
      if (submitted || !revealed) return;
      submitted = true;
      wrap.classList.add('done');
      points.querySelectorAll('.cw-point').forEach(p => { p.disabled = true; });
      submit.disabled = true;
      const m = earned();
      ctx.sfx.zap();
      ctx.onSubmit(m === marks, { marks: m, maxMarks: marks });
    });
  },
};
