// ============================================================
// lessons.js — interactive "worked example" widgets for the learn
// screen. Each turns a topic's core method into a step-through the
// student drives, instead of a static diagram + wall of text.
//
// The engine calls renderWalkthrough(host, id) from showPhaseIntro
// when a phase declares `intro.walkthrough`. Each widget owns its DOM
// and listeners; it never touches the question flow.
// ============================================================

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function popcount(n) { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; }
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

// ── shared "signal sweep" walker ────────────────────────────
// A pulse sweeps a strip of cells left→right; cells that contribute add
// their term to a running total. cfg:
//   { qHtml, answer, cells:[{ glyph, sub, term, contribution, skip, cap }], doneCap(total) }
//   glyph = big char (bit / hex digit); sub = small label (place value / ×weight)
//   term  = readout chunk to add (HTML); contribution = number added to total
//   skip  = true → cell adds nothing (e.g. a 0 bit); cap = caption for that step
function sweepWalk(host, cfg) {
  const cells = cfg.cells;
  let step = -1, total = 0; const terms = [];

  host.innerHTML = '';
  const wrap = el('div', 'lw');
  wrap.append(el('div', 'lw-label', '▶ STEP THROUGH IT'), el('div', 'lw-q', cfg.qHtml));
  const grid = el('div', 'lw-grid');
  const colEls = cells.map(c => el('div', 'lw-col', `<span class="lw-pv">${c.sub}</span><span class="lw-bit">${c.glyph}</span>`));
  colEls.forEach(c => grid.appendChild(c));
  const cap = el('div', 'lw-cap', cfg.startCap || 'Step through each part. Add up the contributions to get the answer.');
  const readout = el('div', 'lw-readout', '<span class="lw-empty">total = 0</span>');
  const controls = el('div', 'lw-controls');
  const stepBtn = el('button', 'lw-step', 'STEP ▶');
  const againBtn = el('button', 'lw-again', '↻ TRY ANOTHER');
  stepBtn.type = 'button'; againBtn.type = 'button'; againBtn.style.display = 'none';
  controls.append(stepBtn, againBtn);
  wrap.append(grid, cap, readout, controls);
  host.appendChild(wrap);

  function paint() {
    colEls.forEach((c, i) => {
      c.classList.remove('current', 'counted', 'skipped');
      if (i === step) c.classList.add('current');
      else if (i < step) c.classList.add(cells[i].skip ? 'skipped' : 'counted');
    });
    if (terms.length) {
      readout.innerHTML = terms.map(t => `<span class="lw-term">${t}</span>`).join('<span class="lw-op">+</span>')
        + (step >= cells.length ? `<span class="lw-eq">=</span><span class="lw-total">${total}</span>` : '');
    } else {
      readout.innerHTML = step >= cells.length ? '<span class="lw-total">0</span>' : '<span class="lw-empty">total = 0</span>';
    }
  }
  function advance() {
    if (step >= cells.length) return;
    step++;
    if (step < cells.length) {
      const c = cells[step];
      if (!c.skip) { total += c.contribution; terms.push(c.term); }
      cap.innerHTML = c.cap;
    } else {
      cap.innerHTML = cfg.doneCap(total);
      stepBtn.style.display = 'none'; againBtn.style.display = '';
    }
    paint();
  }
  stepBtn.addEventListener('click', advance);
  againBtn.addEventListener('click', cfg.again);
  paint();
}

// binary → denary
function binaryWalk(host, again) {
  let value; do { value = randInt(1, 255); } while (popcount(value) < 2 || popcount(value) > 5);
  const pvs = [128, 64, 32, 16, 8, 4, 2, 1];
  const cells = pvs.map((w, i) => {
    const bit = (value >> (7 - i)) & 1;
    return { glyph: bit, sub: w, term: String(w), contribution: w, skip: !bit,
      cap: bit ? `Bit ${i + 1} is <strong>1</strong> — add <strong>${w}</strong>.` : `Bit ${i + 1} is <strong>0</strong> — skip it.` };
  });
  sweepWalk(host, {
    qHtml: `What is binary <strong>${pvs.map((w, i) => (value >> (7 - i)) & 1).join('')}</strong> in denary?`,
    startCap: 'Read each bit from the left. If the bit is 1, add its place value to the total.',
    cells, again: again || (() => binaryWalk(host)),
    doneCap: t => `Every bit read — the place values add up to <strong>${t}</strong>, the denary value.`,
  });
}

// denary → binary (the "subtract the largest place value that fits" method)
function denBinWalk(host, again) {
  const value = randInt(20, 235);
  const pvs = [128, 64, 32, 16, 8, 4, 2, 1];
  let step = -1, remaining = value; const bits = [];

  host.innerHTML = '';
  const wrap = el('div', 'lw');
  wrap.append(el('div', 'lw-label', '▶ STEP THROUGH IT'), el('div', 'lw-q', `Convert denary <strong>${value}</strong> to 8-bit binary.`));
  const grid = el('div', 'lw-grid');
  const colEls = pvs.map(w => el('div', 'lw-col', `<span class="lw-pv">${w}</span><span class="lw-bit">?</span>`));
  colEls.forEach(c => grid.appendChild(c));
  const cap = el('div', 'lw-cap', "Start at the biggest place value. Does it fit in what's left? If yes, write 1 and subtract it; if no, write 0.");
  const readout = el('div', 'lw-readout', `<span class="lw-empty">remaining = ${value}</span>`);
  const controls = el('div', 'lw-controls');
  const stepBtn = el('button', 'lw-step', 'STEP ▶'); const againBtn = el('button', 'lw-again', '↻ TRY ANOTHER');
  stepBtn.type = 'button'; againBtn.type = 'button'; againBtn.style.display = 'none';
  controls.append(stepBtn, againBtn); wrap.append(grid, cap, readout, controls); host.appendChild(wrap);

  function paint() {
    colEls.forEach((c, i) => { c.classList.remove('current', 'counted', 'skipped'); if (i === step) c.classList.add('current'); else if (i < step) c.classList.add(bits[i] ? 'counted' : 'skipped'); });
    readout.innerHTML = step >= 8
      ? `binary <span class="lw-term">${bits.join('')}</span><span class="lw-eq">=</span><span class="lw-total">${value}</span>`
      : `<span class="lw-empty">remaining = ${remaining}</span>`;
  }
  function advance() {
    if (step >= 8) return;
    step++;
    if (step < 8) {
      const w = pvs[step];
      if (remaining >= w) { bits[step] = 1; const before = remaining; remaining -= w; cap.innerHTML = `${w} fits in ${before} — write <strong>1</strong> and subtract ${w} (remaining <strong>${remaining}</strong>).`; }
      else { bits[step] = 0; cap.innerHTML = `${w} is bigger than ${remaining} — write <strong>0</strong>.`; }
      colEls[step].querySelector('.lw-bit').textContent = String(bits[step]);
    } else { cap.innerHTML = `Done — denary ${value} is <strong>${bits.join('')}</strong> in binary.`; stepBtn.style.display = 'none'; againBtn.style.display = ''; }
    paint();
  }
  stepBtn.addEventListener('click', advance);
  againBtn.addEventListener('click', again || (() => denBinWalk(host)));
  paint();
}

// Binary Basics shows BOTH directions (TRY ANOTHER re-picks which one)
function binBasicsWalk(host) {
  const again = () => binBasicsWalk(host);
  (Math.random() < 0.5 ? binaryWalk : denBinWalk)(host, again);
}

// logic gate → step through the four rows of its truth table
function gateWalk(host, again) {
  const gates = { AND: (a, b) => a & b, OR: (a, b) => a | b, XOR: (a, b) => a ^ b };
  const rules = { AND: 'only when BOTH inputs are 1', OR: 'when AT LEAST ONE input is 1', XOR: 'only when the inputs are DIFFERENT' };
  const gate = ['AND', 'OR', 'XOR'][randInt(0, 2)], fn = gates[gate];
  const rows = [[0, 0], [0, 1], [1, 0], [1, 1]];
  let step = -1;

  host.innerHTML = '';
  const wrap = el('div', 'lw');
  wrap.append(el('div', 'lw-label', '▶ STEP THROUGH IT'), el('div', 'lw-q', `Complete the truth table for an <strong>${gate}</strong> gate.`));
  const tt = el('div', 'lw-tt');
  tt.appendChild(el('div', 'lw-tt-row head', `<span class="lw-tt-cell">A</span><span class="lw-tt-cell">B</span><span class="lw-tt-cell">Q</span>`));
  const qRows = rows.map(([a, b]) => { const row = el('div', 'lw-tt-row', `<span class="lw-tt-cell">${a}</span><span class="lw-tt-cell">${b}</span><span class="lw-tt-cell lw-tt-q">?</span>`); tt.appendChild(row); return row; });
  const cap = el('div', 'lw-cap', `Apply the ${gate} rule to each row of inputs to find the output Q.`);
  const controls = el('div', 'lw-controls');
  const stepBtn = el('button', 'lw-step', 'STEP ▶'); const againBtn = el('button', 'lw-again', '↻ TRY ANOTHER');
  stepBtn.type = 'button'; againBtn.type = 'button'; againBtn.style.display = 'none';
  controls.append(stepBtn, againBtn); wrap.append(tt, cap, controls); host.appendChild(wrap);

  function paint() { qRows.forEach((row, i) => row.classList.toggle('current', i === step)); }
  function advance() {
    if (step >= rows.length) return;
    step++;
    if (step < rows.length) {
      const [a, b] = rows[step], q = fn(a, b), qc = qRows[step].querySelector('.lw-tt-q');
      qc.textContent = q; qc.classList.add(q ? 'on' : 'off');
      cap.innerHTML = `A = ${a}, B = ${b} → ${gate} → <strong>${q}</strong>.`;
    } else { cap.innerHTML = `The <strong>${gate}</strong> gate outputs 1 ${rules[gate]}.`; stepBtn.style.display = 'none'; againBtn.style.display = ''; }
    paint();
  }
  stepBtn.addEventListener('click', advance);
  againBtn.addEventListener('click', again || (() => gateWalk(host)));
  paint();
}

// two's complement → denary (the leftmost bit is worth -128)
function twosWalk(host) {
  let value; do { value = randInt(1, 255); } while (popcount(value) < 2 || popcount(value) > 6);
  const pvs = [-128, 64, 32, 16, 8, 4, 2, 1];
  const signed = value >= 128 ? value - 256 : value;
  const cells = pvs.map((w, i) => {
    const bit = (value >> (7 - i)) & 1;
    const neg = w < 0;
    return { glyph: bit, sub: w, term: String(w), contribution: w, skip: !bit,
      cap: bit
        ? `Bit ${i + 1} is <strong>1</strong> — add <strong>${w}</strong>${neg ? ' (the leftmost bit is <strong>negative</strong>)' : ''}.`
        : `Bit ${i + 1} is <strong>0</strong> — skip it.` };
  });
  sweepWalk(host, {
    qHtml: `What is two's complement <strong>${pvs.map((w, i) => (value >> (7 - i)) & 1).join('')}</strong> in denary?`,
    startCap: 'Same as binary, but the leftmost place value is <strong>-128</strong>, so the total can go negative.',
    cells, again: () => twosWalk(host),
    doneCap: () => `The place values add up to <strong>${signed}</strong>. The leading 1 made it negative (the -128 bit).`,
  });
}

// hex → denary (first digit ×16, second digit ×1)
function hexWalk(host) {
  const value = randInt(20, 250);
  const hi = value >> 4, lo = value & 15;
  const hx = value.toString(16).toUpperCase().padStart(2, '0');
  const hc = hi.toString(16).toUpperCase(), lc = lo.toString(16).toUpperCase();
  const cells = [
    { glyph: hc, sub: '× 16', term: `${hi}×16`, contribution: hi * 16, skip: false,
      cap: `First digit <strong>${hc}</strong> = ${hi}, worth ×16 → ${hi} × 16 = <strong>${hi * 16}</strong>.` },
    { glyph: lc, sub: '× 1', term: `${lo}×1`, contribution: lo, skip: false,
      cap: `Second digit <strong>${lc}</strong> = ${lo}, worth ×1 → ${lo} × 1 = <strong>${lo}</strong>.` },
  ];
  sweepWalk(host, {
    qHtml: `What is hex <strong>${hx}</strong> in denary?`,
    startCap: 'A hex digit can be 0–9 then A–F (A=10 … F=15). The left digit is worth ×16, the right ×1.',
    cells, again: () => hexWalk(host),
    doneCap: t => `${hi}×16 + ${lo}×1 = <strong>${t}</strong> — the denary value of ${hx}.`,
  });
}

// one pass of bubble sort — compare each adjacent pair, swap if out of order
function bubbleWalk(host, again) {
  const n = randInt(4, 5);
  const arr = []; for (let i = 0; i < n; i++) arr.push(randInt(2, 29));
  let step = -1;

  host.innerHTML = '';
  const wrap = el('div', 'lw');
  wrap.append(el('div', 'lw-label', '▶ STEP THROUGH IT'), el('div', 'lw-q', 'Do one pass of <strong>bubble sort</strong>: compare each pair and swap if the left is bigger.'));
  const rowEl = el('div', 'lw-arr');
  const tiles = arr.map(v => el('div', 'lw-tile', String(v)));
  tiles.forEach(t => rowEl.appendChild(t));
  const cap = el('div', 'lw-cap', 'Compare the first two values. If the left one is bigger, swap them — the largest value "bubbles" to the end.');
  const controls = el('div', 'lw-controls');
  const stepBtn = el('button', 'lw-step', 'STEP ▶'); const againBtn = el('button', 'lw-again', '↻ TRY ANOTHER');
  stepBtn.type = 'button'; againBtn.type = 'button'; againBtn.style.display = 'none';
  controls.append(stepBtn, againBtn); wrap.append(rowEl, cap, controls); host.appendChild(wrap);

  function paint() {
    tiles.forEach(t => t.classList.remove('compare', 'sorted'));
    if (step >= 0 && step < n - 1) { tiles[step].classList.add('compare'); tiles[step + 1].classList.add('compare'); }
    if (step >= n - 1) tiles[n - 1].classList.add('sorted');
  }
  function advance() {
    if (step >= n - 1) return;
    step++;
    if (step < n - 1) {
      const a = arr[step], b = arr[step + 1];
      if (a > b) { arr[step] = b; arr[step + 1] = a; tiles[step].textContent = b; tiles[step + 1].textContent = a; cap.innerHTML = `Compare <strong>${a}</strong> and <strong>${b}</strong>: ${a} &gt; ${b}, so <strong>SWAP</strong>.`; }
      else { cap.innerHTML = `Compare <strong>${a}</strong> and <strong>${b}</strong>: ${a} ≤ ${b}, so <strong>KEEP</strong>.`; }
    } else { cap.innerHTML = `One pass done — the largest value (<strong>${arr[n - 1]}</strong>) has bubbled to the end.`; stepBtn.style.display = 'none'; againBtn.style.display = ''; }
    paint();
  }
  stepBtn.addEventListener('click', advance);
  againBtn.addEventListener('click', again || (() => bubbleWalk(host)));
  paint();
}

// Caesar cipher — shift each letter of a word forward by N (Z wraps to A)
function caesarWalk(host, again) {
  const words = ['CAT', 'DOG', 'CODE', 'BYTE', 'LOGIC', 'DATA', 'BINARY', 'EXAM'];
  const word = words[randInt(0, words.length - 1)];
  const shift = randInt(1, 5);
  const enc = ch => String.fromCharCode((ch.charCodeAt(0) - 65 + shift) % 26 + 65);
  let step = -1; const cipher = [];

  host.innerHTML = '';
  const wrap = el('div', 'lw');
  wrap.append(el('div', 'lw-label', '▶ STEP THROUGH IT'), el('div', 'lw-q', `Encrypt <strong>${word}</strong> with a Caesar shift of <strong>${shift}</strong>.`));
  const grid = el('div', 'lw-grid');
  const colEls = [...word].map(ch => el('div', 'lw-col', `<span class="lw-pv">${ch}</span><span class="lw-bit">?</span>`));
  colEls.forEach(c => grid.appendChild(c));
  const cap = el('div', 'lw-cap', `Shift each letter forward ${shift} place${shift > 1 ? 's' : ''} in the alphabet (Z wraps back to A).`);
  const readout = el('div', 'lw-readout', '<span class="lw-empty">cipher = …</span>');
  const controls = el('div', 'lw-controls');
  const stepBtn = el('button', 'lw-step', 'STEP ▶'); const againBtn = el('button', 'lw-again', '↻ TRY ANOTHER');
  stepBtn.type = 'button'; againBtn.type = 'button'; againBtn.style.display = 'none';
  controls.append(stepBtn, againBtn); wrap.append(grid, cap, readout, controls); host.appendChild(wrap);

  function paint() {
    colEls.forEach((c, i) => { c.classList.remove('current', 'counted'); if (i === step) c.classList.add('current'); else if (i < step) c.classList.add('counted'); });
    readout.innerHTML = cipher.length ? `cipher = <span class="lw-total">${cipher.join('')}</span>` : '<span class="lw-empty">cipher = …</span>';
  }
  function advance() {
    if (step >= word.length) return;
    step++;
    if (step < word.length) {
      const ch = word[step], e = enc(ch); cipher[step] = e;
      colEls[step].querySelector('.lw-bit').textContent = e;
      cap.innerHTML = `<strong>${ch}</strong> shifted by ${shift} → <strong>${e}</strong>.`;
    } else { cap.innerHTML = `<strong>${word}</strong> with a shift of ${shift} encrypts to <strong>${cipher.join('')}</strong>.`; stepBtn.style.display = 'none'; againBtn.style.display = ''; }
    paint();
  }
  stepBtn.addEventListener('click', advance);
  againBtn.addEventListener('click', again || (() => caesarWalk(host)));
  paint();
}

// ── shared "stepped list" walker ────────────────────────────
// Reveals a sequence of lines one at a time (current highlighted). Good
// for a multi-step calculation or a fixed sequence of stages.
//   cfg = { qHtml, startCap, lines:[{ tag, html, cap }], doneCap(), again }
function stepList(host, cfg) {
  let step = -1;
  host.innerHTML = '';
  const wrap = el('div', 'lw');
  wrap.append(el('div', 'lw-label', '▶ STEP THROUGH IT'), el('div', 'lw-q', cfg.qHtml));
  const list = el('div', 'lw-list');
  const liEls = cfg.lines.map(l => { const li = el('div', 'lw-li', `<span class="lw-li-tag">${l.tag}</span><span class="lw-li-text">${l.html}</span>`); list.appendChild(li); return li; });
  const cap = el('div', 'lw-cap', cfg.startCap || 'Press STEP to work through it one stage at a time.');
  const controls = el('div', 'lw-controls');
  const stepBtn = el('button', 'lw-step', 'STEP ▶'); const againBtn = el('button', 'lw-again', '↻ TRY ANOTHER');
  stepBtn.type = 'button'; againBtn.type = 'button'; againBtn.style.display = 'none';
  controls.append(stepBtn, againBtn); wrap.append(list, cap, controls); host.appendChild(wrap);

  function paint() { liEls.forEach((li, i) => { li.classList.toggle('show', i <= step); li.classList.toggle('current', i === step); }); }
  function advance() {
    if (step >= cfg.lines.length) return;
    step++;
    if (step < cfg.lines.length) cap.innerHTML = cfg.lines[step].cap;
    else { cap.innerHTML = cfg.doneCap(); stepBtn.style.display = 'none'; againBtn.style.display = ''; }
    paint();
  }
  stepBtn.addEventListener('click', advance);
  againBtn.addEventListener('click', cfg.again);
  paint();
}

// image file size: width × height × colour depth = bits, ÷ 8 = bytes
function fileSizeWalk(host, again) {
  let W, H, D; do { W = randInt(4, 16); H = randInt(4, 16); D = [1, 2, 4, 8][randInt(0, 3)]; } while ((W * H * D) % 8 !== 0);
  const px = W * H, bits = px * D, bytes = bits / 8;
  stepList(host, {
    qHtml: `An image is <strong>${W}</strong> pixels wide, <strong>${H}</strong> high, with a colour depth of <strong>${D}</strong> bit${D > 1 ? 's' : ''}. Work out its file size.`,
    startCap: 'File size (bits) = width × height × colour depth — then ÷ 8 for bytes.',
    lines: [
      { tag: 'STEP 1', html: `width × height = ${W} × ${H} = <strong>${px}</strong> pixels`, cap: `Multiply the dimensions: ${W} × ${H} = <strong>${px}</strong> pixels.` },
      { tag: 'STEP 2', html: `× colour depth = ${px} × ${D} = <strong>${bits}</strong> bits`, cap: `Each pixel needs ${D} bit${D > 1 ? 's' : ''}: ${px} × ${D} = <strong>${bits}</strong> bits.` },
      { tag: 'STEP 3', html: `÷ 8 = ${bits} ÷ 8 = <strong>${bytes}</strong> bytes`, cap: `8 bits = 1 byte, so divide by 8: ${bits} ÷ 8 = <strong>${bytes}</strong> bytes.` },
    ],
    doneCap: () => `File size = <strong>${bits} bits</strong> = <strong>${bytes} bytes</strong>.`,
    again: again || (() => fileSizeWalk(host)),
  });
}

// the fetch–decode–execute cycle, one micro-step at a time
function fdeWalk(host, again) {
  stepList(host, {
    qHtml: 'Step through one <strong>fetch–decode–execute</strong> cycle.',
    startCap: 'The CPU repeats three stages: fetch the instruction, decode it, then execute it.',
    lines: [
      { tag: 'FETCH', html: '<strong>PC → MAR</strong> — the next instruction\'s address is copied to the MAR', cap: 'The Program Counter holds the address of the next instruction — copy it to the MAR.' },
      { tag: 'FETCH', html: '<strong>RAM → MDR</strong> — the instruction at that address is read into the MDR', cap: 'Read the instruction at that address from RAM into the MDR.' },
      { tag: 'FETCH', html: '<strong>MDR → CIR</strong> — the instruction is moved into the CIR', cap: 'Move the fetched instruction into the Current Instruction Register.' },
      { tag: 'FETCH', html: '<strong>PC + 1</strong> — the Program Counter is incremented', cap: 'Increment the PC so it points at the following instruction.' },
      { tag: 'DECODE', html: 'the <strong>CU</strong> decodes the instruction in the CIR', cap: 'The Control Unit works out what the instruction means.' },
      { tag: 'EXECUTE', html: 'the <strong>ALU</strong> (or other unit) carries out the instruction', cap: 'The instruction is executed — e.g. the ALU does arithmetic or logic.' },
    ],
    doneCap: () => "That's one full cycle — it repeats billions of times every second.",
    again: again || (() => fdeWalk(host)),
  });
}

const WALKTHROUGHS = { binary: binBasicsWalk, twos: twosWalk, hex: hexWalk, gate: gateWalk, bubble: bubbleWalk, caesar: caesarWalk, fileSize: fileSizeWalk, fde: fdeWalk };

export function renderWalkthrough(host, id) {
  const fn = WALKTHROUGHS[id];
  if (fn) { try { fn(host); } catch (e) { host.remove(); } }
  else host.remove();
}
