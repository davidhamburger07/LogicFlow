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
import { getBoard } from '../storage.js';
import { preflight, friendlyError, checkSteps } from '../codelint.js';

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
    const board = getBoard();
    const runnable = !(board === 'AQA' || board === 'OCR');   // Python boards execute; the others structure-check
    let revealed = false, submitted = false;
    const ticked = new Set();

    const wrap = el('cw cw-lab');
    const marksLine = el('cw-marks');
    marksLine.textContent = `[ WRITE CODE · ${marks} MARK${marks === 1 ? '' : 'S'} ]`;
    wrap.appendChild(marksLine);

    const split = el('cw-split');
    const left = el('cw-pane cw-left');
    const right = el('cw-pane cw-right');
    split.append(left, right);
    wrap.appendChild(split);

    // ---- LEFT: mission briefing → step-by-step success criteria → hint ----
    if (question.brief) {
      const brief = el('cw-brief');
      brief.innerHTML = `<div class="cw-brief-head">📋 MISSION BRIEFING</div><div class="cw-brief-text">${question.brief}</div>`;
      left.appendChild(brief);
    }
    const steps = question.steps || [];
    let stepEls = [];
    if (steps.length) {
      const stepsBox = el('cw-steps');
      stepsBox.appendChild(el('cw-steps-head')).textContent = 'SUCCESS CRITERIA — DO THESE IN ORDER:';
      const ol = el('cw-steps-list', 'ol');
      steps.forEach(s => {
        const li = el('cw-step', 'li');
        li.innerHTML = `<span class="cw-step-state">○</span><span class="cw-step-text">${s.text || s}</span>`;
        ol.appendChild(li);
      });
      stepsBox.appendChild(ol);
      left.appendChild(stepsBox);
      stepEls = [...ol.children];
    }
    if (question.tests && question.tests.length) {
      const tests = el('cw-tests');
      tests.innerHTML = `<div class="cw-tests-head">YOUR PROGRAM SHOULD:</div><ul>${question.tests.map(t => `<li>${t}</li>`).join('')}</ul>`;
      left.appendChild(tests);
    }
    const hints = question.hints || [];
    if (hints.length) {
      let hintIdx = 0;
      const hintBtn = el('cw-hint-btn', 'button');
      hintBtn.type = 'button'; hintBtn.textContent = `💡 HINT (${hints.length})`;
      const hintOut = el('cw-hint-out');
      hintBtn.addEventListener('click', () => {
        if (hintIdx >= hints.length) return;
        const h = el('cw-hint'); h.textContent = hints[hintIdx++];
        hintOut.appendChild(h);
        hintBtn.textContent = hintIdx >= hints.length ? 'NO MORE HINTS' : `💡 HINT (${hints.length - hintIdx} left)`;
        if (hintIdx >= hints.length) hintBtn.disabled = true;
        ctx.sfx.uiClick();
      });
      left.append(hintBtn, hintOut);
    }

    // ---- RIGHT: editor → run/check → feedback terminal → modeled example ----
    right.appendChild(el('cw-label')).textContent = `▶ YOUR CODE — ${board === 'AQA' ? 'AQA pseudo-code' : board === 'OCR' ? 'OCR reference language' : 'Python'} (any notation is accepted)`;
    const ta = el('cw-input', 'textarea');
    ta.spellcheck = false; ta.autocomplete = 'off'; ta.rows = 9;
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
    right.appendChild(ta);

    const runBar = el('cw-runbar');
    const runBtn = el('cw-run-btn', 'button');
    runBtn.type = 'button';
    runBtn.textContent = runnable && question.cases && question.cases.length ? '▶ RUN & CHECK MY CODE' : '▶ CHECK MY CODE';
    const runNote = el('cw-run-note');
    runNote.textContent = runnable ? 'runs your code as real Python' : `${board} notation isn't executable — the terminal checks your structure`;
    runBar.append(runBtn, runNote);
    right.appendChild(runBar);

    const term = el('cw-terminal');
    term.innerHTML = '<div class="cw-term-line cw-term-dim">— compiler feedback appears here —</div>';
    right.appendChild(term);

    const termLine = (msg, kind) => {
      const l = el('cw-term-line' + (kind ? ' cw-term-' + kind : ''));
      l.textContent = msg; term.appendChild(l); return l;
    };
    const paintSteps = code => {
      if (!steps.length) return 0;
      const res = checkSteps(steps, code);
      let todo = 0;
      res.forEach((r, i) => {
        const elx = stepEls[i]; if (!elx) return;
        elx.className = 'cw-step ' + (r.state === 'ok' ? 'cw-step-ok' : '');
        elx.querySelector('.cw-step-state').textContent = r.state === 'ok' ? '✓' : '○';
        if (r.state === 'todo') todo++;
      });
      return todo;
    };

    runBtn.addEventListener('click', async () => {
      const code = ta.value;
      term.innerHTML = '';
      if (!code.trim()) { termLine('Write some code first — the mission briefing tells you what to build.', 'err'); return; }
      // 1) structural preflight in the player's notation
      const issues = preflight(code, board);
      issues.forEach(i => termLine((i.kind === 'hint' ? '💡 ' : '✗ ') + i.msg, i.kind === 'hint' ? 'dim' : 'err'));
      // 2) success criteria
      const todo = paintSteps(code);
      if (steps.length) termLine(todo === 0 ? '✓ every success criterion found in your code' : `○ ${todo} success ${todo === 1 ? 'criterion' : 'criteria'} not found yet — see the list on the left`, todo === 0 ? 'ok' : 'warn');
      // 3) really run it (Python boards)
      if (runnable && question.cases && question.cases.length) {
        runBtn.disabled = true; const label = runBtn.textContent; runBtn.textContent = 'RUNNING…';
        try {
          await loadSkulpt();
          let passed = 0;
          const seenErr = new Set();   // the same syntax error would repeat once per test
          for (const c of question.cases) {
            const full = c.harness ? (code + '\n' + c.harness) : code;
            let r; try { r = await runPython(full, c.stdin); } catch (e) { r = { ok: false, out: '', err: pyErrString(e) }; }
            const ok = r.ok && normOut(r.out) === normOut(c.expect);
            if (ok) { passed++; termLine(`✓ ${c.label || 'test'} — passed`, 'ok'); }
            else if (r.ok) termLine(`✗ ${c.label || 'test'} — expected "${c.expect}", your program printed "${(r.out || '').trim() || '(nothing)'}"`, 'err');
            else { const msg = '✗ ' + friendlyError(r.err, code); if (!seenErr.has(msg)) { seenErr.add(msg); termLine(msg, 'err'); } }
          }
          termLine(`${passed} / ${question.cases.length} TESTS PASSED${passed === question.cases.length ? ' — it does what the mission asks ✓' : ''}`, passed === question.cases.length ? 'ok' : 'warn');
          ctx.sfx[passed === question.cases.length ? 'zap' : 'wrong']();
        } catch (e) { termLine('Could not load the Python runner — structure checks above still apply.', 'err'); }
        runBtn.disabled = false; runBtn.textContent = label;
      } else if (!issues.length && (!steps.length || todo === 0)) {
        termLine('✓ structure looks good — reveal the model answer to mark yourself', 'ok');
        ctx.sfx.zap();
      }
    });

    // Level 2 — a modeled example of a SIMILAR task (hidden on solo/exam questions)
    if (question.example && !question.exam) {
      const exBtn = el('cw-example-btn', 'button');
      exBtn.type = 'button'; exBtn.textContent = '👁 SHOW A MODELED EXAMPLE (a similar task, solved)';
      const exBox = el('cw-example'); exBox.style.display = 'none';
      exBtn.addEventListener('click', () => {
        exBox.style.display = exBox.style.display === 'none' ? 'block' : 'none';
        ctx.sfx.uiClick();
      });
      const exCode = forBoard(question.example.code || question.example);
      exBox.innerHTML = question.example.note ? `<div class="cw-example-note">${question.example.note}</div>` : '';
      exBox.appendChild(codePanel(exCode));
      right.append(exBtn, exBox);
    }

    const reveal = el('cw-reveal', 'button');
    reveal.type = 'button'; reveal.textContent = 'REVEAL MODEL ANSWER & MARK SCHEME →';
    right.appendChild(reveal);

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
