// ============================================================
// questions/gridmul.js — GRIDMUL: long multiplication by the grid method.
//
// Both numbers are split into their place-value parts (256 → 200 + 50 + 6)
// and laid out as a grid; the student TYPES the product into every cell,
// using the zeros trick (200 × 50: do 2 × 5 = 10, count the zeros, hang
// them on the end → 10,000). The addition is scaffolded as written long
// addition throughout:
//   STEP 1 — fill every grid cell. Wrong cells are flagged and retried
//            in place (it teaches, it doesn't punish).
//   STEP 2 — one LONG-ADDITION block per grid row (stacked addends, a
//            rule, answer digit boxes, and a carry row below the sum —
//            British layout, like BINADD).
//   STEP 3 — a final long addition of the row totals. Its answer is what
//            the question is graded on.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'GRIDMUL', rows:[200,50,6], cols:[200,50,6], unit?:'colours',
//     badge, board, title, desc, hints, explain }
// ============================================================

function mk(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function fmt(n) { return n.toLocaleString('en-GB'); }
function clean(s) { return String(s).replace(/[\s,]/g, ''); }
function zeros(n) { let z = 0; while (n % 10 === 0 && n !== 0) { n /= 10; z++; } return z; }
function lead(n) { return n / Math.pow(10, zeros(n)); }

// a written long-addition block: stacked addends (+ on every row after the
// first), a rule, one input per answer digit, and a scratch carry row below.
function buildLongAdd(addends, extraCls) {
  const total = addends.reduce((s, v) => s + v, 0);
  const want = String(total);
  const digits = want.length;
  const pad = s => s.padStart(digits, ' ');

  const table = mk('gm-add' + (extraCls ? ' ' + extraCls : ''), 'table');
  addends.forEach((v, i) => {
    const tr = mk('', 'tr');
    tr.appendChild(mk('gm-op', 'td')).textContent = i > 0 ? '+' : '';
    [...pad(String(v))].forEach(ch => { tr.appendChild(mk('gm-digit', 'td')).textContent = ch.trim(); });
    table.appendChild(tr);
  });
  const ansRow = mk('gm-ans-row', 'tr');
  ansRow.appendChild(mk('gm-op', 'td'));
  const ansInputs = [];
  for (let i = 0; i < digits; i++) {
    const td = mk('', 'td');
    const input = mk('gm-adig', 'input');
    input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.maxLength = 1;
    input.setAttribute('aria-label', `answer digit ${i + 1}`);
    td.appendChild(input);
    ansRow.appendChild(td);
    ansInputs.push(input);
  }
  table.appendChild(ansRow);
  const carryRow = mk('gm-carry-row', 'tr');
  carryRow.appendChild(mk('gm-op gm-carry-label', 'td')).textContent = 'carry';
  const carryInputs = [];
  for (let i = 0; i < digits; i++) {
    const td = mk('', 'td');
    const input = mk('gm-cdig', 'input');
    input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.maxLength = 1;
    input.setAttribute('aria-label', `carry for column ${i + 1} (scratch aid)`);
    td.appendChild(input);
    carryRow.appendChild(td);
    carryInputs.push(input);
  }
  table.appendChild(carryRow);

  return {
    table, ansInputs, want,
    filled() { return ansInputs.every(a => a.value.trim() !== ''); },
    // marks each digit ok/bad; returns true when the whole answer is right
    check() {
      let ok = true;
      ansInputs.forEach((a, i) => {
        const good = a.value.trim() === want[i];
        a.classList.toggle('ok', good); a.classList.toggle('bad', !good);
        if (!good) ok = false;
      });
      return ok;
    },
    lock() { ansInputs.forEach(a => { a.disabled = true; }); carryInputs.forEach(c => { c.disabled = true; }); },
    focusEnd() { try { ansInputs[digits - 1].focus(); } catch (e) {} },
  };
}

export const gridmul = {
  type: 'GRIDMUL',

  render(host, question, ctx) {
    host.innerHTML = '';
    const rows = question.rows.slice();
    const cols = question.cols.slice();
    const rowSums = rows.map(r => cols.reduce((s, c) => s + r * c, 0));
    const answer = rowSums.reduce((s, v) => s + v, 0);

    const wrap = mk('gm');

    // ── the zeros trick, worked on this grid's own first cell ──
    const r0 = rows[0], c0 = cols[0];
    const intro = mk('gm-intro');
    intro.innerHTML = `💡 the zeros trick — e.g. <b>${fmt(r0)} × ${fmt(c0)}</b>: do <b>${lead(r0)} × ${lead(c0)} = ${lead(r0) * lead(c0)}</b>, `
      + `count the zeros (<b>${zeros(r0)} + ${zeros(c0)} = ${zeros(r0) + zeros(c0)}</b>) and hang them on the end → <b>${fmt(r0 * c0)}</b>`;
    wrap.appendChild(intro);

    // ── STEP 1 — the grid ──
    const table = mk('gm-table', 'table');
    const head = mk('', 'tr');
    head.appendChild(mk('', 'th')).textContent = '×';
    cols.forEach(c => { head.appendChild(mk('', 'th')).textContent = fmt(c); });
    table.appendChild(head);
    const cells = [];
    rows.forEach(r => {
      const tr = mk('', 'tr');
      tr.appendChild(mk('', 'th')).textContent = fmt(r);
      cols.forEach(c => {
        const td = mk('', 'td');
        const input = mk('gm-cell', 'input');
        input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.placeholder = '?';
        input.setAttribute('aria-label', `${r} times ${c}`);
        td.appendChild(input);
        tr.appendChild(td);
        cells.push({ input, want: r * c });
      });
      table.appendChild(tr);
    });
    wrap.appendChild(table);

    // ── STEP 2 — one long-addition block per grid row ──
    const stage2 = mk('gm-stage'); stage2.style.display = 'none';
    stage2.appendChild(mk('gm-stage-label')).textContent = rows.length === 1
      ? 'STEP 2 — add the cells with long addition:'
      : 'STEP 2 — add along each row with long addition:';
    const blocksWrap = mk('gm-rows-add');
    const blocks = rows.map((r, i) => {
      const holder = mk('gm-row-block');
      holder.appendChild(mk('gm-block-label')).textContent = `the ${fmt(r)} row`;
      const block = buildLongAdd(cols.map(c => r * c));
      holder.appendChild(block.table);
      blocksWrap.appendChild(holder);
      return block;
    });
    stage2.appendChild(blocksWrap);
    stage2.appendChild(mk('gm-add-note')).textContent = 'work right → left; the carry rows are scratch aids — only the answer digits are marked';
    wrap.appendChild(stage2);

    // ── STEP 3 — the final long addition of the row totals ──
    const stage3 = mk('gm-stage'); stage3.style.display = 'none';
    stage3.appendChild(mk('gm-stage-label')).textContent = 'STEP 3 — add the row totals with one last long addition:';
    const finalBlock = buildLongAdd(rowSums, 'gm-final');
    stage3.appendChild(finalBlock.table);
    stage3.appendChild(mk('gm-add-note')).textContent = 'the answer to this one is the answer to the whole question'
      + (question.unit ? ` — in ${question.unit}` : '');
    wrap.appendChild(stage3);

    const fb = mk('gm-fb'); wrap.appendChild(fb);
    const submit = mk('gm-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK GRID →';
    wrap.appendChild(submit);
    host.appendChild(wrap);

    let stage = 1;

    function checkCells() {
      if (cells.some(c => c.input.value.trim() === '')) {
        fb.className = 'gm-fb gm-no'; fb.textContent = 'Fill every cell of the grid first.'; return;
      }
      let allOk = true;
      cells.forEach(c => {
        const ok = Number(clean(c.input.value)) === c.want;
        c.input.classList.toggle('ok', ok); c.input.classList.toggle('bad', !ok);
        if (!ok) allOk = false;
      });
      if (allOk) {
        cells.forEach(c => { c.input.disabled = true; });
        stage2.style.display = '';
        stage = 2; submit.textContent = rows.length === 1 ? 'CHECK FINAL ANSWER →' : 'CHECK ROW TOTALS →';
        fb.className = 'gm-fb gm-ok'; fb.textContent = '✓ Grid correct — now add, right to left.';
        ctx.sfx.uiClick && ctx.sfx.uiClick();
        setTimeout(() => blocks[0].focusEnd(), 30);
      } else {
        fb.className = 'gm-fb gm-no'; fb.textContent = 'Not quite — fix the red cells (small digits × small digits, then hang the zeros on).';
        ctx.sfx.wrong();
      }
    }

    function checkRowSums() {
      if (blocks.some(b => !b.filled())) {
        fb.className = 'gm-fb gm-no'; fb.textContent = 'Fill every answer digit of every row before checking.'; return;
      }
      // a single-row grid has nothing left to add — its row total IS the answer
      if (rows.length === 1) {
        if (ctx.isAnswered()) return;
        const correct = blocks[0].check();
        blocks[0].lock(); submit.disabled = true;
        if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
        ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `The cells add up to ${fmt(answer)}.` });
        return;
      }
      let allOk = true;
      blocks.forEach(b => { if (!b.check()) allOk = false; });
      if (allOk) {
        blocks.forEach(b => b.lock());
        stage3.style.display = '';
        stage = 3; submit.textContent = 'CHECK FINAL ANSWER →';
        fb.className = 'gm-fb gm-ok'; fb.textContent = '✓ Row totals correct — one last addition.';
        ctx.sfx.uiClick && ctx.sfx.uiClick();
        setTimeout(() => finalBlock.focusEnd(), 30);
      } else {
        fb.className = 'gm-fb gm-no'; fb.textContent = 'Not quite — fix the red digits (remember to carry).';
        ctx.sfx.wrong();
      }
    }

    function checkAnswer() {
      if (ctx.isAnswered()) return;
      if (!finalBlock.filled()) {
        fb.className = 'gm-fb gm-no'; fb.textContent = 'Fill every answer digit (right to left, carrying as you go).'; return;
      }
      const correct = finalBlock.check();
      finalBlock.lock();
      submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `The row totals add up to ${fmt(answer)}.` });
    }

    submit.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      if (stage === 1) checkCells(); else if (stage === 2) checkRowSums(); else checkAnswer();
    });
    wrap.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault(); if (ctx.isAnswered()) return;
        if (stage === 1) checkCells(); else if (stage === 2) checkRowSums(); else checkAnswer();
      }
    });
    setTimeout(() => { try { cells[0].input.focus(); } catch (e) {} }, 50);
  },
};
