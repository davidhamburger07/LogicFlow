// ============================================================
// questions/searchtrace.js — SEARCHTRACE: step through a search.
//
// LINEAR / simple BINARY: the player clicks the element the algorithm checks
// next (left-to-right, or the middle of the current range). First wrong click
// ends the trace.
//
// RIGOROUS BINARY (computeMid:true): the player must (1) CALCULATE the midpoint
// index with integer division `mid = (lo + hi) / 2`, then (2) physically DISCARD
// a half by choosing keep-LEFT / keep-RIGHT / FOUND — the engine does neither
// for them. With `trap:true` the list is deliberately UNSORTED, so a correct
// trace walks past a target that IS in the list — proving the sorted precondition.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'SEARCHTRACE', method:'linear'|'binary', list:[…], target:9,
//     computeMid?:bool, trap?:bool, badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const searchtrace = {
  type: 'SEARCHTRACE',

  render(host, question, ctx) {
    if (question.method === 'binary' && question.computeMid) return renderBinaryCompute(host, question, ctx);
    renderSimple(host, question, ctx);
  },
};

// ── simple linear / click-the-middle binary (unchanged behaviour) ──
function renderSimple(host, question, ctx) {
  host.innerHTML = '';
  const list = question.list.slice();
  const target = question.target;
  const method = question.method === 'binary' ? 'binary' : 'linear';
  const n = list.length;
  let lo = 0, hi = n - 1, ptr = 0, checks = 0, done = false;

  const wrap = el('se');
  const info = el('se-info');
  wrap.appendChild(info);
  const row = el('se-row');
  const cells = list.map((v, i) => {
    const c = el('se-cell', 'button');
    c.type = 'button';
    c.innerHTML = `<span class="se-val">${v}</span><span class="se-idx">${i}</span>`;
    c.addEventListener('click', () => onClick(i));
    row.appendChild(c);
    return c;
  });
  wrap.appendChild(row);
  host.appendChild(wrap);

  const expected = () => (method === 'binary' ? Math.floor((lo + hi) / 2) : ptr);
  function paint() {
    if (method === 'binary') cells.forEach((c, i) => c.classList.toggle('se-out', i < lo || i > hi));
    const prompt = done ? ''
      : method === 'binary' ? `Searching range [${lo}–${hi}] — click the MIDDLE element.`
        : `Click element ${ptr} (the next one in line).`;
    info.innerHTML = `Find <b>${target}</b>${method === 'binary' ? ' (binary search)' : ' (linear search)'} · checks: <b>${checks}</b><br><span class="se-prompt">${prompt}</span>`;
  }
  paint();

  function finish(success) {
    done = true;
    cells.forEach(c => { c.disabled = true; });
    paint();
    if (success) { ctx.sfx.zap(); ctx.onSubmit(true, {}); }
    else { ctx.sfx.wrong(); ctx.onSubmit(false, { feedbackOnWrong: method === 'binary' ? 'A binary search always checks the MIDDLE of the current range, then halves it.' : 'A linear search checks each element in order from the start.' }); }
  }

  function onClick(i) {
    if (done) return;
    if (i !== expected()) { cells[i].classList.add('se-wrong'); finish(false); return; }
    checks++;
    cells[i].classList.add('se-checked');
    if (list[i] === target) { cells[i].classList.add('se-found'); finish(true); return; }
    if (method === 'binary') { if (list[i] < target) lo = i + 1; else hi = i - 1; }
    else ptr++;
    paint();
  }
}

// ── rigorous binary: calculate the midpoint, then discard a half ──
function renderBinaryCompute(host, question, ctx) {
  host.innerHTML = '';
  const list = question.list.slice();
  const target = question.target;
  const n = list.length;
  const trap = !!question.trap;
  let lo = 0, hi = n - 1, mid = -1, checks = 0, stage = 'mid', done = false;

  const wrap = el('se se-bin'); wrap.dataset.target = String(target);
  const info = el('se-info'); wrap.appendChild(info);
  const row = el('se-row');
  const cells = list.map((v, i) => { const c = el('se-cell'); c.innerHTML = `<span class="se-val">${v}</span><span class="se-idx">${i}</span>`; row.appendChild(c); return c; });
  wrap.appendChild(row);
  const bounds = el('se-bounds'); wrap.appendChild(bounds);
  const midRow = el('se-mid'); wrap.appendChild(midRow);
  const decideRow = el('se-decide'); decideRow.style.display = 'none';
  const bLeft = el('se-dbtn', 'button'); bLeft.type = 'button'; bLeft.textContent = '◀ keep LEFT';
  const bFound = el('se-dbtn se-dfound', 'button'); bFound.type = 'button'; bFound.textContent = '✓ FOUND';
  const bRight = el('se-dbtn', 'button'); bRight.type = 'button'; bRight.textContent = 'keep RIGHT ▶';
  decideRow.append(bLeft, bFound, bRight);
  wrap.appendChild(decideRow);
  const fb = el('se-fb'); wrap.appendChild(fb);
  host.appendChild(wrap);

  bLeft.addEventListener('click', () => decide('left'));
  bFound.addEventListener('click', () => decide('found'));
  bRight.addEventListener('click', () => decide('right'));

  function paintCells() {
    cells.forEach((c, i) => {
      c.classList.toggle('se-out', i < lo || i > hi);
      c.classList.toggle('se-mid', i === mid && stage === 'decide');
      c.classList.toggle('se-lo', !done && stage === 'mid' && i === lo && lo !== hi);
      c.classList.toggle('se-hi', !done && stage === 'mid' && i === hi && lo !== hi);
    });
  }

  function askMid() {
    stage = 'mid'; mid = -1; decideRow.style.display = 'none'; paintCells();
    info.innerHTML = `Find <b>${target}</b>${trap ? ' — <b>is this list sorted?</b>' : ''} · checks: <b>${checks}</b>`;
    bounds.innerHTML = `active range: index <b>${lo}</b> … <b>${hi}</b>`;
    midRow.innerHTML = `mid = (lo + hi) ÷ 2 = (<b>${lo}</b> + <b>${hi}</b>) ÷ 2 = `;
    const inp = el('se-midinput', 'input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.autocomplete = 'off'; inp.placeholder = '?';
    const btn = el('se-midcheck', 'button'); btn.type = 'button'; btn.textContent = 'CHECK';
    midRow.append(inp, btn);
    const check = () => {
      if (done) return;
      const want = Math.floor((lo + hi) / 2);
      if (inp.value.trim() === '') { inp.classList.add('se-shake'); setTimeout(() => inp.classList.remove('se-shake'), 350); return; }
      if (Number(inp.value) !== want) { fail(`mid = (${lo} + ${hi}) ÷ 2 = <b>${want}</b> — use integer division (round down).`); return; }
      mid = want; checks++; inp.disabled = true; btn.disabled = true;
      startDecide();
    };
    btn.addEventListener('click', check);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    setTimeout(() => { try { inp.focus(); } catch (e) {} }, 30);
  }

  function startDecide() {
    stage = 'decide'; paintCells();
    const v = list[mid];
    info.innerHTML = `Find <b>${target}</b> · checks: <b>${checks}</b><br><span class="se-prompt">Middle is index ${mid} = <b>${v}</b>. Compare with ${target}, then throw away the half that can't contain it.</span>`;
    decideRow.style.display = '';
  }

  function decide(dir) {
    if (done || stage !== 'decide') return;
    const v = list[mid];
    const correct = v === target ? 'found' : (target < v ? 'left' : 'right');
    if (dir !== correct) { fail(v === target ? `${v} = ${target} — it's FOUND.` : `${target} ${target < v ? '<' : '>'} ${v}, so keep the <b>${target < v ? 'LEFT' : 'RIGHT'}</b> half.`); return; }
    decideRow.style.display = 'none';
    if (dir === 'found') { done = true; cells[mid].classList.add('se-found'); paintCells(); succeed(); return; }
    if (dir === 'left') hi = mid - 1; else lo = mid + 1;
    if (lo > hi) { done = true; mid = -1; paintCells(); notFound(); return; }
    askMid();
  }

  function lock() { midRow.querySelectorAll('input,button').forEach(x => { x.disabled = true; }); decideRow.querySelectorAll('button').forEach(x => { x.disabled = true; }); }
  function succeed() { lock(); fb.className = 'se-fb se-fb-ok'; fb.innerHTML = `✓ Found <b>${target}</b> in <b>${checks}</b> check${checks === 1 ? '' : 's'} — each step threw away half the list.`; ctx.sfx.zap(); ctx.onSubmit(true, {}); }
  function notFound() {
    lock();
    if (trap) {
      fb.className = 'se-fb se-fb-trap';
      const idx = list.indexOf(target);
      fb.innerHTML = `⚠ Binary search says <b>NOT FOUND</b> — but ${target} <b>is</b> in the list (index ${idx >= 0 ? idx : '?'})! It got discarded because the list <b>was not sorted</b>. Binary search only works on a sorted list.`;
      ctx.sfx.wrong(); ctx.onSubmit(true, {});   // the student correctly traced the failing algorithm — that IS the lesson
    } else {
      fb.className = 'se-fb se-fb-no'; fb.textContent = 'Range is empty — target not in the list.';
      ctx.sfx.wrong(); ctx.onSubmit(true, {});
    }
  }
  function fail(why) { done = true; lock(); ctx.sfx.wrong(); ctx.onSubmit(false, { feedbackOnWrong: why.replace(/<\/?b>/g, '') }); }

  askMid();
}
