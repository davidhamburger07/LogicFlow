// ============================================================
// questions/translate.js — TRANSLATE: compiler vs interpreter, shown.
//
// The same buggy program is run two ways so the student SEES the difference
// the exam keeps asking about. COMPILE translates the whole program first, so
// it reports the error before anything runs (no output). INTERPRET runs line
// by line, so earlier lines produce output before it stops at the error. Try
// both to clear it.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'TRANSLATE',
//     code:[ { text:'…' }, { text:'…', out:'printed output' }, { text:'…', error:true }, … ],
//     errorMsg:'…why line N fails…', badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export const translate = {
  type: 'TRANSLATE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const code = question.code || [];
    let errLine = code.findIndex(l => l.error); if (errLine < 0) errLine = code.length - 1;
    const errMsg = question.errorMsg || 'a type error';
    let compiled = false, interpreted = false, animating = false, done = false;
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const wrap = el('tr');
    wrap.appendChild(el('tr-lbl')).textContent = 'YOUR PROGRAM';
    const panel = el('tr-code');
    const lineEls = code.map((l, i) => { const ln = el('tr-line'); ln.innerHTML = `<span class="tr-num">${i + 1}</span><span class="tr-src">${esc(l.text)}</span>`; panel.appendChild(ln); return ln; });
    wrap.appendChild(panel);
    const ctrls = el('tr-ctrls');
    const cBtn = el('tr-compile', 'button'); cBtn.type = 'button'; cBtn.textContent = '▶ COMPILE';
    const iBtn = el('tr-interpret', 'button'); iBtn.type = 'button'; iBtn.textContent = '▶ INTERPRET (line by line)';
    ctrls.append(cBtn, iBtn); wrap.appendChild(ctrls);
    const status = el('tr-status'); wrap.appendChild(status);
    wrap.appendChild(el('tr-lbl')).textContent = 'OUTPUT';
    const out = el('tr-out'); wrap.appendChild(out);
    const note = el('tr-note'); wrap.appendChild(note);
    host.appendChild(wrap);

    function paintStatus() { status.innerHTML = `<span class="tr-chip ${compiled ? 'on' : ''}">${compiled ? '✓' : '○'} tried the COMPILER</span><span class="tr-chip ${interpreted ? 'on' : ''}">${interpreted ? '✓' : '○'} tried the INTERPRETER</span>`; }
    function clearHi() { lineEls.forEach(l => l.classList.remove('tr-active', 'tr-err')); }
    function setBtns(dis) { cBtn.disabled = dis; iBtn.disabled = dis; }
    paintStatus();
    out.innerHTML = '<span class="tr-out-empty">press COMPILE or INTERPRET to run it</span>';

    cBtn.addEventListener('click', () => { if (!animating && !done) runCompile(); });
    iBtn.addEventListener('click', () => { if (!animating && !done) runInterpret(); });

    async function runCompile() {
      animating = true; setBtns(true); clearHi();
      out.innerHTML = '<span class="tr-out-empty">translating the whole program…</span>';
      note.className = 'tr-note'; note.textContent = 'COMPILING — translating every line into machine code first…';
      for (let i = 0; i <= errLine; i++) { lineEls[i].classList.add('tr-active'); await sleep(280); if (i < errLine) lineEls[i].classList.remove('tr-active'); }
      lineEls[errLine].classList.remove('tr-active'); lineEls[errLine].classList.add('tr-err');
      out.innerHTML = '<span class="tr-out-empty">— nothing ran —</span>';
      note.className = 'tr-note tr-note-err';
      note.innerHTML = `✗ <b>COMPILE ERROR (line ${errLine + 1}):</b> ${esc(errMsg)}. A compiler translates the <b>whole program first</b>, so it caught the error before running anything — the program won't run <b>at all</b> until it's fixed.`;
      compiled = true; paintStatus(); animating = false; setBtns(false); check();
    }

    async function runInterpret() {
      animating = true; setBtns(true); clearHi(); out.innerHTML = '';
      note.className = 'tr-note'; note.textContent = 'INTERPRETING — translating and running one line at a time…';
      for (let i = 0; i < code.length; i++) {
        clearHi(); lineEls[i].classList.add('tr-active'); await sleep(420);
        if (code[i].error) {
          lineEls[i].classList.remove('tr-active'); lineEls[i].classList.add('tr-err');
          note.className = 'tr-note tr-note-err';
          note.innerHTML = `✗ <b>ERROR (line ${i + 1}):</b> ${esc(errMsg)}. The interpreter runs <b>line by line</b> — lines 1–${i} already ran (see the output), and it stopped the moment it reached this line.`;
          break;
        }
        if (code[i].out != null) { const o = el('tr-out-line'); o.textContent = code[i].out; out.appendChild(o); }
      }
      if (!out.children.length) out.innerHTML = '<span class="tr-out-empty">(no output before the error)</span>';
      interpreted = true; paintStatus(); animating = false; setBtns(false); check();
    }

    function check() {
      if (compiled && interpreted && !done) {
        done = true; clearHi(); setBtns(true);
        note.className = 'tr-note tr-note-win';
        note.innerHTML = '✓ <b>Same program, two translators.</b> The <b>compiler</b> translated everything first and caught the error before anything ran (no output); the <b>interpreter</b> ran partway, printing "Hello Sam", before stopping at the error. Compiler = all-at-once (a fast standalone program); interpreter = line-by-line (instant start, stops at the first error — great for debugging).';
        ctx.sfx.zap(); ctx.onSubmit(true);
      }
    }
  },
};
