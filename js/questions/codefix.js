// ============================================================
// questions/codefix.js — CODE_FIX: fix the bug (not just find it).
//
// A CODE_BUG the student actually REPAIRS. It is board-branched, because
// the exam boards assess debugging differently:
//   • AQA / OCR  → IDENTIFY the bug: click the buggy line (like CODE_BUG).
//   • Edexcel / WJEC / Eduqas  (the on-screen-coding boards) → EDIT the buggy
//     Python in place and RUN it against test cases (real Python, via Skulpt).
//     The level clears only when EVERY test case passes.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Schema (code / starter / buggyLine may each be a { AQA, OCR, Eduqas } map):
//   { type:'CODE_FIX', badge, board,
//     code:      '…' | { AQA, OCR, Eduqas },   // the buggy program
//     buggyLine: n   | { AQA, OCR },            // 0-indexed — the CLICK branch
//     starter?:  '…' | { … },                   // editor prefill (default = the Python code)
//     cases:     [ { stdin?:[…], expect:'…', label?, harness? } ],  // the EDIT branch runs these
//     fixNote?:  'total ← total + i',            // the correct line, shown after a click
//     hints, explain }
// ============================================================

import { codePanel, forBoard, notationCaption, getBoard, missionStrip } from './codeview.js';
import { loadSkulpt, runPython } from './codewrite.js';

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function normOut(s) { return String(s).replace(/\r/g, '').replace(/[ \t]+$/gm, '').trim().toLowerCase(); }

export const codefix = {
  type: 'CODE_FIX',

  render(answerHost, question, ctx) {
    answerHost.innerHTML = '';
    const _mission = missionStrip(question); if (_mission) answerHost.appendChild(_mission);
    const board = getBoard();
    // The on-screen-coding boards actually EDIT & RUN; AQA/OCR identify the line.
    const editable = (board === 'Edexcel' || board === 'WJEC' || board === 'Eduqas') && question.cases && question.cases.length;

    const wrap = el('codefix');
    const cap = notationCaption(question); if (cap) wrap.appendChild(cap);

    if (!editable) { renderClick(); } else { renderEdit(); }
    answerHost.appendChild(wrap);

    // ── CLICK branch (AQA / OCR): find the buggy line ──────────────
    function renderClick() {
      const buggy = Number(forBoard(question.buggyLine));
      const hint = el('cf-hint'); hint.textContent = '▶ Click the line with the bug:'; wrap.appendChild(hint);
      const panel = codePanel(forBoard(question.code));
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
          const note = question.fixNote ? ` The fix: <code>${escapeHtml(question.fixNote)}</code>.` : '';
          ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `Not that line — the bug is on line ${buggy + 1}.${note}` });
        });
      });
    }

    // ── EDIT branch (Edexcel / WJEC / Eduqas): repair & run ────────
    function renderEdit() {
      const hint = el('cf-hint'); hint.innerHTML = '▶ This program has one bug. <b>Fix the code</b>, then run the tests:'; wrap.appendChild(hint);

      const ta = el('cf-input', 'textarea');
      ta.spellcheck = false; ta.autocomplete = 'off'; ta.rows = 6;
      ta.value = forBoard(question.starter) || forBoard(question.code) || '';
      ta.addEventListener('keydown', e => {              // Tab indents rather than leaving the box
        if (e.key === 'Tab') {
          e.preventDefault();
          const s = ta.selectionStart, en = ta.selectionEnd;
          ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
          ta.selectionStart = ta.selectionEnd = s + 2;
        }
      });
      wrap.appendChild(ta);

      const runBar = el('cf-runbar');
      const runBtn = el('cf-run-btn', 'button'); runBtn.type = 'button'; runBtn.textContent = '▶ RUN TESTS';
      const runNote = el('cf-run-note'); runNote.textContent = 'runs your fixed code as Python';
      runBar.append(runBtn, runNote);
      const out = el('cf-run-out');
      wrap.append(runBar, out);
      runBtn.addEventListener('click', () => runTests(runBtn, out, ta.value));
    }

    async function runTests(btn, host, code) {
      if (ctx.isAnswered()) return;
      if (!code.trim()) { host.innerHTML = '<div class="cf-run-msg">Fix the code first, then run the tests.</div>'; return; }
      btn.disabled = true; const label = btn.textContent; btn.textContent = 'RUNNING…';
      host.innerHTML = '<div class="cf-run-msg">Starting Python…</div>';
      try { await loadSkulpt(); }
      catch { host.innerHTML = '<div class="cf-run-msg cf-case-err">Could not load the Python runner.</div>'; btn.disabled = false; btn.textContent = label; return; }
      host.innerHTML = '';
      let passed = 0;
      for (const c of question.cases) {
        const full = c.harness ? (code + '\n' + c.harness) : code;
        let r; try { r = await runPython(full, c.stdin); } catch (e) { r = { ok: false, out: '', err: 'Your program could not run.' }; }
        const ok = r.ok && normOut(r.out) === normOut(c.expect);
        if (ok) passed++;
        host.appendChild(caseRow(c, r, ok));
      }
      const all = passed === question.cases.length;
      const summary = el('cf-run-summary' + (all ? ' all' : ''));
      summary.textContent = `${passed} / ${question.cases.length} TESTS PASSED` + (all ? '  — bug fixed ✓' : '');
      host.insertBefore(summary, host.firstChild);
      btn.disabled = false; btn.textContent = label;
      if (all) { ctx.sfx.zap(); ctx.onSubmit(true, {}); }
      else { ctx.sfx.wrong(); }
    }

    function caseRow(c, r, pass) {
      const row = el('cf-case ' + (pass ? 'pass' : 'fail'));
      const desc = c.label || (c.stdin && c.stdin.length ? 'input: ' + c.stdin.join(', ') : 'no input');
      row.innerHTML = `<div class="cf-case-head"><span class="cf-case-mark">${pass ? '✓' : '✗'}</span><span class="cf-case-desc">${escapeHtml(desc)}</span></div>`;
      if (!pass) {
        const detail = el('cf-case-detail');
        detail.innerHTML = r.ok
          ? `expected <b>${escapeHtml(c.expect)}</b> · your output <b>${escapeHtml(r.out.trim() || '(nothing)')}</b>`
          : `<span class="cf-case-err">${escapeHtml(r.err)}</span>`;
        row.appendChild(detail);
      }
      return row;
    }
  },
};
