// ============================================================
// diagrams.js — reusable SVG diagrams for the learn screens.
//
// On-brand: Share Tech Mono, white background, blue "signal" accent, and
// theme-aware (fills/strokes use CSS custom properties so they adapt to
// light/dark). Each export is an <svg> string; the engine drops it into a
// lesson page via a page's `diagram: '<key>'` field (see SVG_DIAGRAMS).
// ============================================================

const FONT = "'Share Tech Mono', monospace";
const W = 440;   // shared viewBox width

function cell(x, y, w, h, label, o = {}) {
  const fill = o.on ? 'var(--phase-color)' : (o.bg || 'var(--surface)');
  const stroke = o.on ? 'var(--phase-color)' : (o.stroke || 'var(--border)');
  const tc = o.on ? '#fff' : (o.muted ? 'var(--ink-4)' : 'var(--ink)');
  const t = (label === '' || label == null) ? '' :
    `<text x="${x + w / 2}" y="${y + h / 2 + 1}" fill="${tc}" font-family="${FONT}" font-size="${o.fs || 15}" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>${t}`;
}
function tx(x, y, s, o = {}) {
  return `<text x="${x}" y="${y}" fill="${o.fill || 'var(--ink-3)'}" font-family="${FONT}" font-size="${o.fs || 12}"`
    + ` letter-spacing="${o.ls != null ? o.ls : 1}" text-anchor="${o.anchor || 'start'}"${o.weight ? ` font-weight="${o.weight}"` : ''}>${s}</text>`;
}
function rowCentered(vals, y, w, h, o = {}) {
  const gap = o.gap != null ? o.gap : 8;
  const total = vals.length * w + (vals.length - 1) * gap;
  let x = (W - total) / 2;
  const on = o.on || [];
  return vals.map((v, i) => { const c = cell(x, y, w, h, v, { on: on.includes(i), fs: o.fs, muted: o.muted }); x += w + gap; return c; }).join('');
}
function arrow(x1, y, x2) {                       // small horizontal arrow
  return `<line x1="${x1}" y1="${y}" x2="${x2 - 4}" y2="${y}" stroke="var(--ink-4)" stroke-width="1.5"/>`
    + `<path d="M ${x2} ${y} L ${x2 - 7} ${y - 4} L ${x2 - 7} ${y + 4} Z" fill="var(--ink-4)"/>`;
}
function wrap(vb, body) {
  // Widen every viewBox horizontally: the 12px readability floor made caption
  // text wider than the 440-unit design width, so give it margin instead of
  // letting the SVG clip it at the edges.
  const p = vb.split(' ').map(Number);
  const M = 30;
  return `<svg viewBox="${p[0] - M} ${p[1]} ${p[2] + 2 * M} ${p[3]}" class="svgd" xmlns="http://www.w3.org/2000/svg" role="img">${body}</svg>`;
}

// 1) DECIMAL vs BINARY place values — "the same idea, different base"
const decimalBinary = wrap('0 0 440 196',
  tx(220, 16, 'ONE IDEA — EACH COLUMN = THE NEXT × THE BASE', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1.5 })
  + tx(60, 44, 'DECIMAL · base 10 · ×10 each step left', { fs: 12 })
  + rowCentered(['1000', '100', '10', '1'], 52, 74, 34)
  + tx(60, 116, 'BINARY · base 2 · ×2 each step left (doubles)', { fs: 12 })
  + rowCentered(['8', '4', '2', '1'], 124, 74, 34)
  + tx(220, 184, 'to read a number, add the columns that are switched on', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 }));

// 2) bit -> nibble -> byte nesting
const bitNibbleByte = (() => {
  function group(x, y, n, w, h) { let s = '', cx = x; for (let i = 0; i < n; i++) { s += cell(cx, y, w, h, ''); cx += w + 3; } return s; }
  return wrap('0 0 440 150',
    tx(220, 16, 'BITS GROUP UP', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 2 })
    + cell(26, 48, 30, 30, '1') + tx(41, 96, '1 BIT', { anchor: 'middle', fs: 12 })
    + arrow(70, 63, 104)
    + group(116, 48, 4, 22, 30) + tx(166, 96, 'NIBBLE · 4 bits', { anchor: 'middle', fs: 12 })
    + arrow(232, 63, 252)
    + group(258, 48, 8, 18, 30) + tx(331, 96, 'BYTE · 8 bits', { anchor: 'middle', fs: 12 })
    + tx(220, 128, '1 byte = 2 nibbles = 8 bits = stores 0 to 255', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 }));
})();

// 3) storage-unit ladder (each step ×1000)
const unitLadder = (() => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let s = tx(220, 18, 'STORAGE UNITS · each one is 1000× bigger', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1.2 });
  const bw = 76, sh = 30, baseY = 168, rise = 27;
  units.forEach((u, i) => {
    const x = 16 + i * 82, top = baseY - i * rise;
    s += cell(x, top, bw, sh, u, { on: true, fs: 14 });
    if (i > 0) s += tx(x - 4, top - 6, '×1000', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  });
  return wrap('0 0 440 196', s);
})();

// 4) "subtract the biggest place value" — writing 84 in binary
const subtractMethod = wrap('0 0 440 214',
  tx(220, 16, 'WRITE 84 IN BINARY · subtract the biggest that fits, repeat', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.6 })
  + rowCentered(['128', '64', '32', '16', '8', '4', '2', '1'], 28, 46, 26, { on: [1, 3, 5], fs: 13 })
  + tx(70, 86, '84 − 64 = 20', { fs: 12, fill: 'var(--ink)' }) + tx(210, 86, '→  64 fits, write 1', { fs: 12 })
  + tx(70, 110, '20 − 16 = 4', { fs: 12, fill: 'var(--ink)' }) + tx(210, 110, '→  16 fits, write 1', { fs: 12 })
  + tx(70, 134, '4 − 4 = 0', { fs: 12, fill: 'var(--ink)' }) + tx(210, 134, '→  4 fits, write 1', { fs: 12 })
  + rowCentered(['0', '1', '0', '1', '0', '1', '0', '0'], 150, 30, 28, { on: [1, 3, 5], fs: 14 })
  + tx(220, 202, '84 = 01010100', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12 }));

// 5a) binary addition with carries (0101 + 0011 = 1000)
const binaryAddition = (() => {
  const w = 40, gap = 8, x0 = 150, lblX = 132;
  const colx = i => x0 + i * (w + gap);
  const bitRow = (vals, y, lbl, o = {}) => {
    let s = tx(lblX, y + 19, lbl, { anchor: 'end', fill: o.lblFill || 'var(--ink-3)', fs: 12 });
    vals.forEach((v, i) => { s += cell(colx(i), y, w, 28, String(v), { on: o.on && o.on.includes(i), fs: 15 }); });
    return s;
  };
  let body = tx(220, 16, 'BINARY ADDITION · right to left, carry when a column makes 2', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.2 });
  body += bitRow(['0', '1', '0', '1'], 30, '5');
  body += bitRow(['0', '0', '1', '1'], 64, '+ 3');
  body += `<line x1="${lblX + 6}" y1="100" x2="${colx(3) + w}" y2="100" stroke="var(--ink-3)" stroke-width="1.5"/>`;
  body += bitRow(['1', '0', '0', '0'], 106, '8', { on: [0], lblFill: 'var(--phase-color)' });
  // carry written BELOW the line (British column-addition style)
  body += tx(lblX, 156, 'carry', { anchor: 'end', fill: 'var(--ink-4)', fs: 12 });
  ['1', '1', '1', ''].forEach((c, i) => { if (c) body += tx(colx(i) + w / 2, 156, c, { anchor: 'middle', fill: 'var(--error-ink)', fs: 12 }); });
  body += tx(220, 184, '1+1 = 10 (write 0, carry 1)  ·  1+1+1 = 11 (write 1, carry 1)', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  return wrap('0 0 440 198', body);
})();

// 5b) binary shift — slide bits to ×2 / ÷2
const binaryShift = wrap('0 0 440 152',
  tx(220, 16, 'BINARY SHIFT · slide every bit to multiply or divide', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.3 })
  + rowCentered('00000110'.split(''), 32, 26, 24, { on: [5, 6], fs: 12 })
  + tx(220, 76, '6  — shift LEFT 1 place —  12', { anchor: 'middle', fill: 'var(--ink)', fs: 12 })
  + rowCentered('00001100'.split(''), 88, 26, 24, { on: [4, 5], fs: 12 })
  + tx(220, 136, 'left = ×2 per place · right = ÷2 per place', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 }));

// 5c) overflow — the 9th bit has nowhere to go
const overflow = wrap('0 0 440 158',
  tx(220, 16, 'OVERFLOW · 8 bits cannot hold a 9th', { anchor: 'middle', fill: 'var(--error-ink)', fs: 12, ls: 0.6 })
  + tx(220, 40, '11111111 (255)  +  1', { anchor: 'middle', fill: 'var(--ink)', fs: 12 })
  + cell(56, 58, 26, 26, '1', { stroke: 'var(--error)' })
  + tx(69, 102, '✕ falls off', { anchor: 'middle', fill: 'var(--error-ink)', fs: 12 })
  + rowCentered('00000000'.split(''), 58, 26, 26, { fs: 12 })
  + tx(220, 138, 'the result wraps round to 00000000 = 0', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 }));

// 6) decimal place value broken down — the number 274
const decimalPlaceValue = (() => {
  const cols = [['100', '2'], ['10', '7'], ['1', '4']];
  const w = 86, gap = 18, h = 44;
  const total = cols.length * w + (cols.length - 1) * gap;
  let x = (W - total) / 2;
  let body = tx(220, 16, 'DECIMAL PLACE VALUE · the number 274', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.8 });
  cols.forEach(([pv, dig]) => {
    body += tx(x + w / 2, 46, '×' + pv, { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
    body += cell(x, 54, w, h, dig, { on: true, fs: 24 });
    x += w + gap;
  });
  body += tx(220, 132, '(2 × 100) + (7 × 10) + (4 × 1) = 274', { anchor: 'middle', fill: 'var(--ink)', fs: 13 });
  return wrap('0 0 440 152', body);
})();

// 7) binary history timeline
const binaryTimeline = (() => {
  const pts = [['1703', 'Leibniz'], ['1850s', 'Boole'], ['1947', 'transistor'], ['today', 'everywhere']];
  const y = 58, x0 = 50, x1 = 390, n = pts.length;
  let body = tx(220, 18, 'FROM IDEA TO EVERY DEVICE', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 2 });
  body += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="var(--border)" stroke-width="2"/>`;
  pts.forEach((p, i) => {
    const x = x0 + (x1 - x0) * i / (n - 1);
    body += `<circle cx="${x}" cy="${y}" r="6" fill="var(--phase-color)" stroke="var(--surface)" stroke-width="2"/>`
      + tx(x, y - 14, p[0], { anchor: 'middle', fill: 'var(--ink)', fs: 13 })
      + tx(x, y + 26, p[1], { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  });
  return wrap('0 0 440 96', body);
})();

// 8a) reading a two's complement number (the leftmost bit is worth −128)
const twosRead = (() => {
  const pv = ['-128', '64', '32', '16', '8', '4', '2', '1'];
  const bits = '11111011';   // = -5
  const w = 46, gap = 5, n = 8;
  const x0 = (W - (n * w + (n - 1) * gap)) / 2;
  let body = tx(220, 16, 'TWO’S COMPLEMENT · the leftmost bit is worth −128', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.2 });
  pv.forEach((p, i) => { body += tx(x0 + i * (w + gap) + w / 2, 41, p, { anchor: 'middle', fill: i === 0 ? 'var(--error-ink)' : 'var(--ink-4)', fs: i === 0 ? 11 : 12 }); });
  [...bits].forEach((b, i) => { body += cell(x0 + i * (w + gap), 48, w, 30, b, { on: b === '1', fs: 15 }); });
  body += tx(220, 116, '−128 + 64 + 32 + 16 + 8 + 2 + 1 = −5', { anchor: 'middle', fill: 'var(--ink)', fs: 12 });
  body += tx(220, 140, 'a leading 1 always means the number is negative', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  return wrap('0 0 440 154', body);
})();

// 8b) making a negative — flip every bit, then add 1  (+5 → −5)
const twosNegate = (() => {
  const w = 30, gap = 4, n = 8, x0 = 92, rowW = n * w + (n - 1) * gap;
  const bitRow = (str, y, hl) => [...str].map((c, i) => cell(x0 + i * (w + gap), y, w, 26, c, { on: c === '1' && hl, fs: 13 })).join('');
  let body = tx(220, 16, 'MAKE A NEGATIVE · flip every bit, then add 1', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.2 });
  body += tx(x0 - 8, 49, '+5', { anchor: 'end', fill: 'var(--ink)', fs: 12 }) + bitRow('00000101', 34);
  body += tx(x0 + rowW + 8, 81, '← flip', { fill: 'var(--ink-4)', fs: 12 }) + bitRow('11111010', 66);
  body += tx(x0 + rowW + 8, 113, '← add 1', { fill: 'var(--ink-4)', fs: 12 }) + bitRow('11111011', 98, true);
  body += tx(220, 152, '11111011 = −5', { anchor: 'middle', fill: 'var(--phase-color)', fs: 13 });
  return wrap('0 0 440 168', body);
})();

// 8c) the 8-bit signed range on a number line
const twosRange = (() => {
  const y = 62, x0 = 42, x1 = 398;
  let body = tx(220, 18, '8-BIT SIGNED RANGE · −128 to +127', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="var(--border)" stroke-width="2"/>`;
  const pts = [
    { x: x0, num: '−128', bin: '10000000', neg: true },
    { x: 172, num: '−1', bin: '11111111', neg: true },
    { x: 262, num: '0', bin: '00000000', neg: false },
    { x: x1, num: '+127', bin: '01111111', neg: false },
  ];
  pts.forEach(p => {
    body += `<circle cx="${p.x}" cy="${y}" r="5" fill="${p.neg ? 'var(--error-ink)' : 'var(--phase-color)'}"/>`
      + tx(p.x, y - 14, p.num, { anchor: 'middle', fill: 'var(--ink)', fs: 12 })
      + tx(p.x, y + 22, p.bin, { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  });
  body += tx((x0 + 172) / 2, y + 44, 'leading 1 = negative', { anchor: 'middle', fill: 'var(--error-ink)', fs: 12 });
  body += tx((262 + x1) / 2, y + 44, 'leading 0 = positive', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12 });
  return wrap('0 0 440 122', body);
})();

// 9a) the sixteen hex digits — 0–9 then A–F, with their denary values
const hexDigits = (() => {
  const w = 23, gap = 3, n = 16;
  const x0 = (W - (n * w + (n - 1) * gap)) / 2;
  const HEX = '0123456789ABCDEF';
  let body = tx(220, 16, 'HEXADECIMAL · SIXTEEN DIGITS: 0–9 THEN A–F', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 });
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (w + gap);
    body += cell(x, 30, w, 28, HEX[i], { on: i >= 10, fs: 13 });
    body += tx(x + w / 2, 76, String(i), { anchor: 'middle', fill: i >= 10 ? 'var(--phase-color)' : 'var(--ink-4)', fs: 12, ls: 0 });
  }
  body += tx(220, 102, 'A–F are just numbers that ran out of digits: A = 10 … F = 15', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  return wrap('0 0 440 114', body);
})();

// 9b) hex place value — sixteens and units (2A = 42)
const hexPlaceValue = (() => {
  const w = 64, gap = 10, x0 = (W - (2 * w + gap)) / 2;
  let body = tx(220, 16, 'HEX PLACE VALUE · SIXTEENS AND UNITS', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += tx(x0 + w / 2, 40, '× 16', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  body += tx(x0 + w + gap + w / 2, 40, '× 1', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  body += cell(x0, 48, w, 40, '2', { fs: 20 }) + cell(x0 + w + gap, 48, w, 40, 'A', { on: true, fs: 20 });
  body += tx(x0 + w + gap + w / 2, 108, 'A = 10', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0 });
  body += tx(220, 136, '(2 × 16) + (10 × 1)  =  32 + 10  =  42', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  return wrap('0 0 440 150', body);
})();

// 9c) denary -> hex — how many 16s fit, remainder becomes the second digit
const hexDivide = (() => {
  let body = tx(220, 16, 'DENARY → HEX · HOW MANY 16s FIT?', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += cell(30, 36, 62, 36, '60', { fs: 17 });
  body += arrow(100, 54, 128);
  body += cell(134, 36, 128, 36, '60 ÷ 16 = 3 r 12', { fs: 12 });
  body += arrow(270, 54, 298);
  body += cell(304, 36, 50, 36, '3', { on: true, fs: 17 }) + cell(358, 36, 50, 36, 'C', { on: true, fs: 17 });
  body += tx(325, 92, '3 × 16', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(390, 92, '12 → C', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(220, 120, 'quotient = first digit · remainder = second (10–15 → A–F)', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 132', body);
})();

// 9d) the nibble trick — split a byte into two nibbles, each becomes one hex digit
const hexNibble = (() => {
  const w = 26, gap = 4, nibGap = 26;
  const groupW = 4 * w + 3 * gap;
  const x0 = (W - (2 * groupW + nibGap)) / 2;
  const bits = '11010110';
  let body = tx(220, 16, 'THE NIBBLE TRICK · 1 HEX DIGIT = 4 BITS', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  [...bits].forEach((b, i) => {
    const x = x0 + i * (w + gap) + (i >= 4 ? nibGap - gap : 0);
    body += cell(x, 32, w, 28, b, { on: b === '1', fs: 13 });
  });
  const c1 = x0 + groupW / 2, c2 = x0 + groupW + nibGap + groupW / 2;
  [[c1, 'D', '1101 = 8+4+1 = 13'], [c2, '6', '0110 = 4+2 = 6']].forEach(([cx, d, note]) => {
    body += `<line x1="${cx}" y1="66" x2="${cx}" y2="84" stroke="var(--ink-4)" stroke-width="1.5"/>`
      + `<path d="M ${cx} 90 L ${cx - 4} 83 L ${cx + 4} 83 Z" fill="var(--ink-4)"/>`
      + cell(cx - 19, 94, 38, 34, d, { on: true, fs: 18 })
      + tx(cx, 146, note, { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  });
  body += tx(220, 172, '11010110  →  1101 | 0110  →  D6 — no maths across the whole number', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  return wrap('0 0 440 186', body);
})();

// 10a) a screen is a grid of pixels; each pixel is three lights (R G B)
const pixelRgb = (() => {
  let body = tx(220, 16, 'A SCREEN IS A GRID OF PIXELS · EACH PIXEL = 3 LIGHTS', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 });
  // the pixel grid, one pixel lit orange
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const lit = (r === 1 && c === 3);
    body += `<rect x="${28 + c * 18}" y="${34 + r * 18}" width="15" height="15" rx="2" fill="${lit ? '#FF8800' : 'var(--surface)'}" stroke="${lit ? '#FF8800' : 'var(--border)'}" stroke-width="1.2"/>`;
  }
  body += tx(81, 122, 'one pixel', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += arrow(150, 70, 186);
  // that pixel, zoomed: three light strips
  const strips = [['#FF0000', 1, 'R', '255'], ['#00CC00', 136 / 255, 'G', '136'], ['#0000FF', 0, 'B', '0']];
  strips.forEach(([col, level, lab, val], i) => {
    const x = 196 + i * 34;
    body += `<rect x="${x}" y="34" width="28" height="66" rx="3" fill="${col}" opacity="${Math.max(level, 0.08)}" stroke="var(--border)" stroke-width="1.2"/>`
      + tx(x + 14, 116, lab, { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 })
      + tx(x + 14, 130, val, { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  });
  body += arrow(310, 70, 340);
  body += `<rect x="348" y="40" width="54" height="54" rx="6" fill="#FF8800"/>`
    + tx(375, 116, '#FF8800', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  return wrap('0 0 440 142', body);
})();

// 10b) additive mixing — light, not paint (venn on a dark panel)
const rgbMix = (() => {
  let body = tx(220, 16, 'MIXING LIGHT · ADDITIVE COLOUR', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += `<rect x="88" y="26" width="264" height="132" rx="8" fill="#0b0e13"/>`;
  body += `<g>`
    + `<circle cx="192" cy="72" r="40" fill="#FF0000" style="mix-blend-mode:screen"/>`
    + `<circle cx="248" cy="72" r="40" fill="#00FF00" style="mix-blend-mode:screen"/>`
    + `<circle cx="220" cy="116" r="40" fill="#0000FF" style="mix-blend-mode:screen"/>`
    + `</g>`;
  body += tx(220, 178, 'R+G = YELLOW · R+B = MAGENTA · G+B = CYAN · ALL THREE = WHITE', { anchor: 'middle', fill: 'var(--ink-3)', fs: 12, ls: 0.3 });
  body += tx(220, 196, 'light ADDS (screens) — unlike paint, which absorbs', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 206', body);
})();

// 10c) anatomy of #RRGGBB — three pairs, three channels
const hexAnatomy = (() => {
  const pairs = [['FF', 'RED', '255', '#DC2626'], ['88', 'GREEN', '136', '#059669'], ['00', 'BLUE', '0', '#2563EB']];
  const w = 62, gap = 12, x0 = 96;
  let body = tx(220, 16, 'ANATOMY OF A COLOUR CODE', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += tx(x0 - 22, 66, '#', { fill: 'var(--ink)', fs: 24, ls: 0 });
  pairs.forEach(([dig, lab, val, col], i) => {
    const x = x0 + i * (w + gap);
    body += tx(x + w / 2, 38, lab, { anchor: 'middle', fill: col, fs: 12, ls: 1 });
    body += `<rect x="${x}" y="46" width="${w}" height="34" rx="4" fill="var(--surface)" stroke="${col}" stroke-width="2"/>`
      + `<text x="${x + w / 2}" y="64" fill="var(--ink)" font-family="${FONT}" font-size="17" text-anchor="middle" dominant-baseline="central">${dig}</text>`
      + tx(x + w / 2, 96, '= ' + val, { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  });
  body += `<rect x="336" y="46" width="34" height="34" rx="5" fill="#FF8800"/>`;
  body += tx(220, 122, 'full red + some green + no blue  =  ORANGE', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  return wrap('0 0 440 134', body);
})();

// 10d) one channel's brightness scale — 00 (off) to FF (full)
const channelScale = (() => {
  let body = tx(220, 16, 'ONE CHANNEL = ONE BYTE · 00 (OFF) → FF (FULL)', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 });
  body += `<defs><linearGradient id="chscale" x1="0" y1="0" x2="1" y2="0">`
    + `<stop offset="0" stop-color="#000000"/><stop offset="1" stop-color="#FF0000"/></linearGradient></defs>`;
  body += `<rect x="50" y="32" width="340" height="26" rx="4" fill="url(#chscale)" stroke="var(--border)" stroke-width="1.2"/>`;
  [['00', '0', 0], ['40', '64', 0.25], ['80', '128', 0.5], ['C0', '192', 0.75], ['FF', '255', 1]].forEach(([hex, den, f]) => {
    const x = 50 + 340 * f;
    body += `<line x1="${x}" y1="58" x2="${x}" y2="66" stroke="var(--ink-4)" stroke-width="1.2"/>`
      + tx(x, 80, hex, { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 })
      + tx(x, 94, den, { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  });
  return wrap('0 0 440 106', body);
})();

// 11a) text is numbers — the ASCII idea (A=65 … + the 'H' chain)
const asciiMap = (() => {
  let body = tx(220, 16, 'TEXT IS NUMBERS · THE ASCII CODE', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  ['A', 'B', 'C', 'D'].forEach((ch, i) => {
    const x = 78 + i * 50;
    body += cell(x, 30, 40, 30, ch, { fs: 15 });
    body += tx(x + 20, 76, String(65 + i), { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  });
  body += tx(310, 52, '…each letter is', { fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(310, 66, 'the one before + 1', { fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += cell(60, 96, 40, 30, 'H', { on: true, fs: 15 }) + arrow(108, 111, 136);
  body += cell(142, 96, 52, 30, '72', { fs: 14 }) + arrow(202, 111, 230);
  [...'01001000'].forEach((b, i) => { body += cell(236 + i * 21, 96, 18, 30, b, { on: b === '1', fs: 12 }); });
  body += tx(220, 148, "text = each character's number in binary ('a' = 97)", { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  return wrap('0 0 440 160', body);
})();

// 11a-ii) the full 7-bit ASCII table (codes 0–127) — an HTML table, not SVG;
// the lesson renderer innerHTMLs the diagram string either way.
const asciiTable = (() => {
  const CTRL = ['NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI', 'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US'];
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const glyph = c => {
    if (c < 32) return `<span class="at-ctrl">${CTRL[c]}</span>`;
    if (c === 32) return `<span class="at-ctrl">SP</span>`;
    if (c === 127) return `<span class="at-ctrl">DEL</span>`;
    return `<b>${esc(String.fromCharCode(c))}</b>`;
  };
  const ANCHORS = new Set([48, 65, 97]);   // '0', 'A', 'a' — the codes worth memorising
  let rows = '';
  for (let r = 0; r < 32; r++) {
    let cells = '';
    for (let col = 0; col < 4; col++) {
      const c = r + col * 32;
      const hi = ANCHORS.has(c) ? ' at-hi' : '';
      cells += `<td class="at-dec${hi}">${c}</td><td class="at-ch${hi}">${glyph(c)}</td>`;
    }
    rows += `<tr>${cells}</tr>`;
  }
  const head = '<tr>' + '<th>Dec</th><th>Chr</th>'.repeat(4) + '</tr>';
  return `<div class="at-wrap"><div class="at-cap">THE FULL 7-BIT ASCII TABLE · CODES 0–127</div>`
    + `<div class="at-scroll"><table class="at-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`
    + `<div class="at-note">The <span class="at-hi-key">highlighted</span> codes are the anchors worth memorising: <b>'0' = 48</b>, <b>'A' = 65</b>, <b>'a' = 97</b> — everything else you count on from there. Codes <b>0–31</b> and <b>127</b> are non-printing <b>control codes</b> (NUL, tab, line-feed…); <b>32</b> is space.</div></div>`;
})();

// 11b) a 1-bit bitmap — pixels are bits
const bitmapGrid = (() => {
  const rows = ['00111100', '01000010', '10100101', '10000001', '10100101', '10011001', '01000010', '00111100'];
  const px = 14, x0 = 96, y0 = 30;
  let body = tx(220, 16, 'AN IMAGE IS A GRID OF PIXELS · 1-BIT = 2 COLOURS', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 });
  rows.forEach((r, ri) => {
    [...r].forEach((b, ci) => {
      body += `<rect x="${x0 + ci * px}" y="${y0 + ri * px}" width="${px - 1}" height="${px - 1}" fill="${b === '1' ? 'var(--ink)' : 'var(--surface)'}" stroke="var(--border)" stroke-width="0.6"/>`;
    });
    body += tx(x0 + 8 * px + 14, y0 + ri * px + px / 2 + 3, r, { fill: ri === 0 ? 'var(--phase-color)' : 'var(--ink-4)', fs: 12, ls: 1.5 });
  });
  body += tx(220, 158, 'size = width × height × colour depth = 8 × 8 × 1 = 64 bits', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  return wrap('0 0 440 170', body);
})();

// 11c) sound — sample the wave at regular intervals
const soundSampling = (() => {
  const y0 = 84, amp = 40;
  const wave = x => y0 - amp * Math.sin((x - 50) / 52);
  let pts = [];
  for (let x = 50; x <= 390; x += 4) pts.push(`${x},${wave(x).toFixed(1)}`);
  let body = tx(220, 16, 'SOUND · MEASURE (SAMPLE) THE WAVE AT REGULAR INTERVALS', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 });
  body += `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--ink-4)" stroke-width="1.5"/>`;
  for (let x = 60; x <= 380; x += 32) {
    const y = wave(x);
    body += `<line x1="${x}" y1="${y0 + amp + 4}" x2="${x}" y2="${y}" stroke="var(--phase-color)" stroke-width="1" opacity="0.45"/>`
      + `<circle cx="${x}" cy="${y}" r="3.4" fill="var(--phase-color)"/>`;
  }
  body += `<line x1="46" y1="${y0 + amp + 4}" x2="394" y2="${y0 + amp + 4}" stroke="var(--border)" stroke-width="1"/>`;
  body += tx(220, 152, 'each dot becomes a binary number — more samples = truer sound', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  body += tx(220, 170, 'size (bits) = sample rate × bit depth × seconds', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  return wrap('0 0 440 182', body);
})();

// 11d) compression — the two routes and what you get back
const compressionPaths = (() => {
  let body = tx(220, 16, 'COMPRESSION · TWO ROUTES', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += cell(30, 62, 92, 40, 'ORIGINAL', { fs: 12 });
  body += tx(76, 116, '10 MB', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += `<line x1="126" y1="74" x2="196" y2="48" stroke="var(--ink-4)" stroke-width="1.5"/>`
    + `<line x1="126" y1="90" x2="196" y2="116" stroke="var(--ink-4)" stroke-width="1.5"/>`;
  body += cell(202, 30, 104, 34, 'LOSSLESS', { on: true, fs: 12 });
  body += tx(254, 78, 'ZIP · PNG · FLAC', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += cell(202, 100, 104, 34, 'LOSSY', { fs: 12 });
  body += tx(254, 148, 'JPEG · MP3 · MPEG', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += arrow(312, 47, 336) + arrow(312, 117, 336);
  body += tx(342, 42, '≈ 6 MB', { fill: 'var(--ink)', fs: 12, ls: 0 })
    + tx(342, 56, 'exact original', { fill: 'var(--success-ink, #16a34a)', fs: 12, ls: 0 })
    + tx(342, 67, 'comes back ✓', { fill: 'var(--success-ink, #16a34a)', fs: 12, ls: 0 });
  body += tx(342, 112, '≈ 2 MB', { fill: 'var(--ink)', fs: 12, ls: 0 })
    + tx(342, 126, 'data gone', { fill: 'var(--error-ink, #dc2626)', fs: 12, ls: 0 })
    + tx(342, 137, 'for good ✗', { fill: 'var(--error-ink, #dc2626)', fs: 12, ls: 0 });
  return wrap('0 0 440 162', body);
})();

// 12) logic-gate helpers — the four GCSE gate symbols
function gateAND(x, y) {
  return `<path d="M ${x},${y} h 20 a 20,20 0 0 1 0,40 h -20 z" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>`;
}
function gateOR(x, y) {
  return `<path d="M ${x},${y} q 12,20 0,40 q 24,0 40,-20 q -16,-20 -40,-20 z" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>`;
}
function gateXOR(x, y) {
  return gateOR(x + 7, y) + `<path d="M ${x},${y} q 12,20 0,40" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
}
function gateNOT(x, y) {
  return `<path d="M ${x},${y} l 30,20 l -30,20 z" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>`
    + `<circle cx="${x + 35}" cy="${y + 20}" r="4.5" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>`;
}
function stub(x1, y, x2, on) {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${on ? 'var(--phase-color)' : 'var(--border)'}" stroke-width="2"/>`;
}

// 12a) the four gate symbols + their one-line rules
const gateSymbols = (() => {
  let body = tx(220, 16, 'THE FOUR GATES · SYMBOL AND RULE', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  const items = [
    { x: 30, draw: () => stub(14, 40, 30, 1) + stub(14, 60, 30, 1) + gateAND(30, 30) + stub(70, 50, 86, 1), name: 'AND', rule1: '1 only if', rule2: 'BOTH are 1' },
    { x: 136, draw: () => stub(120, 40, 140, 1) + stub(120, 60, 140, 1) + gateOR(136, 30) + stub(176, 50, 192, 1), name: 'OR', rule1: '1 if at least', rule2: 'ONE is 1' },
    { x: 242, draw: () => stub(226, 40, 249, 1) + stub(226, 60, 249, 1) + gateXOR(242, 30) + stub(289, 50, 305, 1), name: 'XOR', rule1: '1 only if', rule2: 'they DIFFER' },
    { x: 352, draw: () => stub(336, 50, 352, 1) + gateNOT(352, 30) + stub(392, 50, 408, 1), name: 'NOT', rule1: 'flips its', rule2: 'one input' },
  ];
  items.forEach(g => {
    body += g.draw();
    const cx = g.x + (g.name === 'NOT' ? 20 : 22);
    body += tx(cx, 92, g.name, { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 1 });
    body += tx(cx, 108, g.rule1, { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
    body += tx(cx, 119, g.rule2, { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  });
  return wrap('0 0 440 130', body);
})();

// 12b) anatomy of a truth table (AND) — every input combo, in binary order
const truthAnatomy = (() => {
  const rows = [['0', '0', '0'], ['0', '1', '0'], ['1', '0', '0'], ['1', '1', '1']];
  const w = 34, x0 = 128, y0 = 30;
  let body = tx(220, 16, 'A TRUTH TABLE · EVERY COMBINATION, IN BINARY ORDER', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 });
  ['A', 'B', 'Q'].forEach((h, c) => { body += cell(x0 + c * (w + 4), y0, w, 24, h, { muted: c < 2, on: c === 2, fs: 12 }); });
  rows.forEach((r, ri) => {
    r.forEach((v, c) => { body += cell(x0 + c * (w + 4), y0 + 28 + ri * 28, w, 24, v, { on: c === 2 && v === '1', fs: 12 }); });
  });
  body += tx(x0 - 12, y0 + 42, 'count 00, 01,', { anchor: 'end', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(x0 - 12, y0 + 54, '10, 11 — like', { anchor: 'end', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(x0 - 12, y0 + 66, 'binary counting', { anchor: 'end', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(x0 + 3 * (w + 4) + 8, y0 + 42, '← apply the rule to', { fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(x0 + 3 * (w + 4) + 8, y0 + 54, 'each row (AND: only', { fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(x0 + 3 * (w + 4) + 8, y0 + 66, 'the 1,1 row gives 1)', { fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(220, y0 + 28 + 4 * 28 + 14, '2 inputs → 2² = 4 rows · 3 inputs would need 8', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  return wrap('0 0 440 186', body);
})();

// 12c) chaining gates — one gate's output feeds the next
const gateChain = (() => {
  let body = tx(220, 16, 'CHAIN GATES · Q = (A OR B) AND C', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += tx(58, 46, 'A=1', { anchor: 'end', fill: 'var(--ink)', fs: 12, ls: 0 }) + stub(64, 42, 96, 1);
  body += tx(58, 66, 'B=0', { anchor: 'end', fill: 'var(--ink-4)', fs: 12, ls: 0 }) + stub(64, 62, 96, 0);
  body += gateOR(96, 32) + tx(114, 88, 'OR', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  body += stub(136, 52, 196, 1) + tx(166, 46, '1', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0 });
  body += tx(158, 96, 'C=1', { anchor: 'end', fill: 'var(--ink)', fs: 12, ls: 0 }) + stub(164, 92, 196, 1);
  body += `<line x1="196" y1="92" x2="196" y2="72" stroke="var(--phase-color)" stroke-width="2"/>` + stub(196, 72, 200, 1);
  body += gateAND(200, 42) + tx(220, 108, 'AND', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  body += stub(240, 62, 296, 1);
  body += cell(296, 48, 44, 28, 'Q=1', { on: true, fs: 12 });
  body += tx(220, 136, 'work LEFT → RIGHT: OR(1,0) = 1 first, then AND(1,1) = 1', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  return wrap('0 0 440 148', body);
})();

// 13a) inside the CPU — CU, ALU, registers, and RAM over the bus
const cpuParts = (() => {
  let body = tx(220, 16, 'INSIDE THE CPU', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += `<rect x="40" y="30" width="234" height="128" rx="6" fill="none" stroke="var(--phase-color)" stroke-width="2"/>`;
  body += tx(52, 46, 'CPU', { fill: 'var(--phase-color)', fs: 12, ls: 2 });
  body += cell(56, 56, 64, 40, 'CU', { fs: 13 });
  body += tx(88, 108, 'directs', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += cell(56, 116, 64, 34, 'ALU', { fs: 13 });
  body += tx(88, 130, '', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  ['PC', 'MAR', 'MDR', 'CIR'].forEach((r, i) => {
    body += cell(150, 52 + i * 26, 108, 22, r, { fs: 12, muted: false });
  });
  body += tx(204, 46, 'REGISTERS', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 1 });
  body += `<line x1="274" y1="84" x2="330" y2="84" stroke="var(--ink-4)" stroke-width="2"/>`
    + `<path d="M 330 84 L 322 79 L 322 89 Z" fill="var(--ink-4)"/>`
    + `<line x1="330" y1="104" x2="274" y2="104" stroke="var(--ink-4)" stroke-width="2"/>`
    + `<path d="M 274 104 L 282 99 L 282 109 Z" fill="var(--ink-4)"/>`;
  body += tx(302, 76, 'bus', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += cell(330, 64, 74, 58, 'RAM', { on: true, fs: 14 });
  body += tx(367, 136, 'main memory', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(220, 176, 'the CU directs · the ALU calculates · the registers hold the work', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12 });
  return wrap('0 0 440 186', body);
})();

// 13b) the fetch choreography — PC → MAR → RAM → MDR → CIR, then PC+1
const fdeSteps = (() => {
  const boxes = ['PC', 'MAR', 'RAM', 'MDR', 'CIR'];
  const w = 58, gap = 26, x0 = (W - (5 * w + 4 * gap)) / 2;
  let body = tx(220, 16, 'THE FETCH · WHERE THE INSTRUCTION TRAVELS', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  boxes.forEach((b, i) => {
    const x = x0 + i * (w + gap);
    body += cell(x, 34, w, 32, b, { on: b === 'RAM', fs: 12 });
    if (i < 4) {
      body += arrow(x + w + 3, 50, x + w + gap - 3);
      body += tx(x + w + gap / 2, 44, String(i + 1), { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0 });
    }
  });
  body += tx(x0 + w / 2, 84, '5: PC + 1', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0 });
  body += tx(220, 108, '1 PC to MAR · 2 read RAM · 3 into MDR · 4 copy to CIR · 5 PC + 1', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(220, 128, 'then DECODE (the CU reads the CIR) → EXECUTE (e.g. the ALU calculates)', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  return wrap('0 0 440 140', body);
})();

// 13c) the memory hierarchy — small & fast at the top, huge & slow below
const memoryHierarchy = (() => {
  const rows = [
    ['REGISTERS', 130, 'fastest · a few bytes'],
    ['CACHE', 190, 'very fast · MBs'],
    ['RAM', 255, 'fast · GBs'],
    ['SECONDARY STORAGE', 330, ''],
  ];
  let body = tx(220, 16, 'THE MEMORY HIERARCHY', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  rows.forEach(([label, w2, note], i) => {
    const x = (W - w2) / 2, y = 30 + i * 34;
    body += cell(x, y, w2, 26, label, { on: i === 0, fs: 12 });
    if (note) body += tx(x + w2 + 10, y + 17, note, { fill: 'var(--ink-4)', fs: 12, ls: 0 });
  });
  body += tx(30, 96, '▲ faster', { fill: 'var(--phase-color)', fs: 12, ls: 0 });
  body += tx(30, 112, '▼ bigger', { fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(220, 176, 'secondary storage: slowest but huge (TBs) — and the only non-volatile level', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(220, 192, 'closer to the CPU = faster but smaller (and pricier per byte)', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 202', body);
})();

// 14a) the three storage technologies — magnetic, optical, solid-state
const storageTech = (() => {
  let body = tx(220, 16, 'THREE WAYS TO TRAP A BIT', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  // magnetic: platter + head arm
  body += `<circle cx="80" cy="72" r="34" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>`
    + `<circle cx="80" cy="72" r="20" fill="none" stroke="var(--border)" stroke-width="1.2"/>`
    + `<circle cx="80" cy="72" r="4" fill="var(--ink)"/>`
    + `<line x1="118" y1="38" x2="88" y2="66" stroke="var(--phase-color)" stroke-width="3" stroke-linecap="round"/>`;
  body += tx(80, 124, 'MAGNETIC', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 1 });
  body += tx(80, 138, 'spinning platters', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(80, 149, '+ moving head', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  // optical: disc + laser beam
  body += `<circle cx="220" cy="72" r="34" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>`
    + `<circle cx="220" cy="72" r="7" fill="var(--overlay, #fff)" stroke="var(--ink)" stroke-width="1.5"/>`
    + `<path d="M 198 60 A 26 26 0 0 1 244 66" fill="none" stroke="var(--border)" stroke-width="1.2" stroke-dasharray="2 3"/>`
    + `<line x1="232" y1="104" x2="226" y2="80" stroke="var(--error-ink, #dc2626)" stroke-width="2"/>`;
  body += tx(220, 124, 'OPTICAL', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 1 });
  body += tx(220, 138, 'pits & lands', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(220, 149, 'read by a laser', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  // solid-state: chip with pins
  body += `<rect x="330" y="48" width="60" height="48" rx="4" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>`;
  for (let i = 0; i < 4; i++) {
    body += `<line x1="${339 + i * 14}" y1="40" x2="${339 + i * 14}" y2="48" stroke="var(--ink-4)" stroke-width="2"/>`
      + `<line x1="${339 + i * 14}" y1="96" x2="${339 + i * 14}" y2="104" stroke="var(--ink-4)" stroke-width="2"/>`;
  }
  body += tx(360, 76, 'FLASH', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += tx(360, 124, 'SOLID-STATE', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 1 });
  body += tx(360, 138, 'charge in transistors', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(360, 149, 'no moving parts', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 160', body);
})();

// 14b) virtual memory — RAM overflows into a slice of the disk
const virtualMemory = (() => {
  let body = tx(220, 16, 'VIRTUAL MEMORY · WHEN RAM RUNS OUT', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += `<rect x="52" y="34" width="120" height="96" rx="5" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
  body += tx(112, 50, 'RAM (full!)', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    body += `<rect x="${62 + c * 34}" y="${58 + r * 22}" width="30" height="18" rx="2" fill="var(--phase-color)" opacity="${0.9 - (r * 3 + c) * 0.06}"/>`;
  }
  body += arrow(180, 82, 240);
  body += tx(210, 72, 'page out', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += `<rect x="246" y="34" width="150" height="96" rx="5" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
  body += tx(321, 50, 'SECONDARY STORAGE', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0.5 });
  body += `<rect x="256" y="58" width="130" height="38" rx="3" fill="var(--surface)" stroke="var(--phase-color)" stroke-width="2" stroke-dasharray="5 3"/>`;
  body += tx(321, 80, 'VIRTUAL MEMORY', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 });
  body += tx(321, 112, 'the rest: your files', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(220, 152, 'lets more programs run at once — but the disk is MUCH slower than real RAM', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 164', body);
})();

// 15a) the software layers — apps talk to the OS, the OS talks to hardware
const osLayers = (() => {
  const rows = [
    ['YOU & YOUR APPS', 'games · apps', false],
    ['OPERATING SYSTEM', 'Windows · iOS', true],
    ['HARDWARE', 'CPU · devices', false],
  ];
  let body = tx(220, 16, 'THE LAYERS · WHO TALKS TO WHOM', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  rows.forEach(([label, sub, on], i) => {
    const y = 30 + i * 46;
    body += cell(90, y, 260, 30, label, { on, fs: 12 });
    body += tx(360, y + 19, sub, { fill: 'var(--ink-4)', fs: 12, ls: 0 });
    if (i < 2) {
      body += `<line x1="212" y1="${y + 30}" x2="212" y2="${y + 46}" stroke="var(--ink-4)" stroke-width="1.5"/>`
        + `<path d="M 212 ${y + 30} L 208 ${y + 37} L 216 ${y + 37} Z" fill="var(--ink-4)"/>`
        + `<line x1="228" y1="${y + 30}" x2="228" y2="${y + 46}" stroke="var(--ink-4)" stroke-width="1.5"/>`
        + `<path d="M 228 ${y + 46} L 224 ${y + 39} L 232 ${y + 39} Z" fill="var(--ink-4)"/>`;
    }
  });
  body += tx(220, 172, 'apps never touch the hardware directly — every request goes through the OS', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 182', body);
})();

// 15b) the six jobs of the OS
const osJobs = (() => {
  const jobs = [
    ['PROCESSOR', 'shares CPU time'],
    ['MEMORY', 'allocates RAM'],
    ['PERIPHERALS', 'via device drivers'],
    ['FILES', 'folders & saving'],
    ['USERS', 'logins & rights'],
    ['INTERFACE', 'what you see'],
  ];
  const w = 128, h = 44, gapX = 14, gapY = 14;
  const x0 = (W - (3 * w + 2 * gapX)) / 2;
  let body = tx(220, 16, 'THE SIX JOBS OF THE OPERATING SYSTEM', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  jobs.forEach(([name, sub], i) => {
    const x = x0 + (i % 3) * (w + gapX), y = 30 + Math.floor(i / 3) * (h + gapY);
    body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>`
      + tx(x + w / 2, y + 19, name, { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 })
      + tx(x + w / 2, y + 34, sub, { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  });
  body += tx(220, 152, 'one manager, six responsibilities — exams ask you to NAME and DESCRIBE them', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 162', body);
})();

// 16a) the ladder of languages — high-level → assembly → machine code
const languageLevels = (() => {
  const rows = [
    ['HIGH-LEVEL', 'total = price * qty', 'humans write here', false],
    ['ASSEMBLY', 'LDA price · MUL qty', 'mnemonics · ~1:1', false],
    ['MACHINE CODE', '10110101 00000011', 'the CPU runs here', true],
  ];
  const labels = ['compiler / interpreter', 'assembler'];
  let body = tx(220, 16, 'THE LADDER OF LANGUAGES', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  rows.forEach(([name, code, note, on], i) => {
    const y = 30 + i * 52;
    body += cell(56, y, 116, 32, name, { on, fs: 12 });
    body += `<rect x="180" y="${y}" width="150" height="32" rx="4" fill="var(--surface)" stroke="var(--border)" stroke-width="1.2"/>`
      + tx(255, y + 20, code, { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
    body += tx(340, y + 20, note, { fill: 'var(--ink-4)', fs: 12, ls: 0 });
    if (i < 2) {
      body += `<line x1="114" y1="${y + 32}" x2="114" y2="${y + 52}" stroke="var(--ink-4)" stroke-width="1.5"/>`
        + `<path d="M 114 ${y + 52} L 110 ${y + 45} L 118 ${y + 45} Z" fill="var(--ink-4)"/>`
        + tx(122, y + 46, labels[i], { fill: 'var(--phase-color)', fs: 12, ls: 0 });
    }
  });
  body += tx(220, 178, 'every program ends up as machine code — translators do the climbing down', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 188', body);
})();

// 16b) compiler vs interpreter — two routes from source to running code
const compilerInterpreter = (() => {
  let body = tx(220, 16, 'TWO WAYS TO RUN HIGH-LEVEL CODE', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += cell(30, 62, 92, 40, 'SOURCE', { fs: 12 });
  body += tx(76, 116, 'your .py file', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += `<line x1="126" y1="74" x2="192" y2="48" stroke="var(--ink-4)" stroke-width="1.5"/>`
    + `<line x1="126" y1="90" x2="192" y2="116" stroke="var(--ink-4)" stroke-width="1.5"/>`;
  body += cell(198, 30, 110, 34, 'COMPILER', { on: true, fs: 12 });
  body += tx(253, 78, 'whole program, once', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += cell(198, 100, 110, 34, 'INTERPRETER', { fs: 12 });
  body += tx(253, 148, 'one line at a time', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += arrow(314, 47, 338) + arrow(314, 117, 338);
  body += tx(342, 40, 'EXECUTABLE file', { fill: 'var(--ink)', fs: 12, ls: 0 })
    + tx(342, 54, 'fast · standalone', { fill: 'var(--success-ink, #16a34a)', fs: 12, ls: 0 })
    + tx(342, 65, 'errors at the end', { fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(342, 110, 'runs immediately', { fill: 'var(--ink)', fs: 12, ls: 0 })
    + tx(342, 124, 'stops at 1st error', { fill: 'var(--success-ink, #16a34a)', fs: 12, ls: 0 })
    + tx(342, 135, 'slower · needs it', { fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 162', body);
})();

// 17a) LAN vs WAN — one site's network, joined to the world through a router
const lanWan = (() => {
  let body = tx(220, 16, 'LAN · WAN · AND THE INTERNET BETWEEN', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += `<rect x="24" y="30" width="150" height="112" rx="8" fill="none" stroke="var(--phase-color)" stroke-width="2"/>`;
  body += tx(99, 46, 'LAN · one site', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 });
  [['💻', 46, 62], ['💻', 88, 62], ['🖨', 130, 62]].forEach(([ic, x, y]) => {
    body += `<rect x="${x}" y="${y}" width="28" height="24" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="1.2"/>`
      + `<text x="${Number(x) + 14}" y="${Number(y) + 16}" font-size="12" text-anchor="middle">${ic}</text>`;
  });
  body += cell(58, 104, 84, 26, 'ROUTER', { on: true, fs: 12 });
  [['60', '86'], ['102', '86'], ['144', '86']].forEach(([x]) => {
    body += `<line x1="${x}" y1="86" x2="100" y2="104" stroke="var(--border)" stroke-width="1.2"/>`;
  });
  body += `<line x1="142" y1="117" x2="196" y2="94" stroke="var(--ink-4)" stroke-width="2" stroke-dasharray="5 3"/>`;
  body += `<ellipse cx="240" cy="86" rx="44" ry="28" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>`;
  body += tx(240, 82, 'THE INTERNET', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0.5 });
  body += tx(240, 94, '(a WAN)', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += `<line x1="284" y1="86" x2="330" y2="86" stroke="var(--ink-4)" stroke-width="2" stroke-dasharray="5 3"/>`;
  body += `<rect x="330" y="56" width="86" height="60" rx="8" fill="none" stroke="var(--border)" stroke-width="2"/>`;
  body += tx(373, 74, 'another LAN', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(373, 92, '(a school,', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(373, 103, 'an office…)', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(220, 166, 'a LAN covers one site — the WAN links sites over huge distances', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 176', body);
})();

// 17b) the journey of a message — split, route independently, reassemble
const packetJourney = (() => {
  let body = tx(220, 16, 'PACKET SWITCHING · SPLIT → ROUTE → REASSEMBLE', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 });
  body += cell(24, 56, 66, 48, 'MSG', { fs: 12 });
  body += arrow(94, 80, 116);
  [0, 1, 2].forEach(i => {
    body += `<rect x="120" y="${44 + i * 26}" width="52" height="20" rx="3" fill="var(--surface)" stroke="var(--phase-color)" stroke-width="1.5"/>`
      + tx(146, 57 + i * 26, '#' + (i + 1) + ' +IP', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  });
  body += `<ellipse cx="248" cy="80" rx="48" ry="34" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  body += tx(248, 77, 'routers', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(248, 89, 'different paths!', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0 });
  body += `<path d="M 176 52 Q 220 34 292 60" fill="none" stroke="var(--ink-4)" stroke-width="1.2"/>`
    + `<path d="M 176 80 Q 248 80 296 78" fill="none" stroke="var(--ink-4)" stroke-width="1.2"/>`
    + `<path d="M 176 108 Q 224 126 294 96" fill="none" stroke="var(--ink-4)" stroke-width="1.2"/>`;
  [0, 1, 2].forEach(i => {
    body += `<rect x="306" y="${44 + i * 26}" width="52" height="20" rx="3" fill="var(--surface)" stroke="var(--phase-color)" stroke-width="1.5"/>`
      + tx(332, 57 + i * 26, '#' + (i + 1), { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  });
  body += arrow(362, 80, 384);
  body += cell(388, 56, 40, 48, '✓', { on: true, fs: 14 });
  body += tx(220, 140, 'each packet: dest IP + sequence number → reassembled in order', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 150', body);
})();

// 17c) star vs mesh topologies
const topologies = (() => {
  let body = tx(220, 16, 'TWO WAYS TO WIRE A NETWORK', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  const node = (x, y, on) => `<circle cx="${x}" cy="${y}" r="9" fill="${on ? 'var(--phase-color)' : 'var(--surface)'}" stroke="${on ? 'var(--phase-color)' : 'var(--ink)'}" stroke-width="2"/>`;
  // star: central switch + 5 spokes
  const scx = 110, scy = 86;
  const spokes = [[110, 40], [62, 68], [158, 68], [70, 126], [150, 126]];
  spokes.forEach(([x, y]) => { body += `<line x1="${scx}" y1="${scy}" x2="${x}" y2="${y}" stroke="var(--border)" stroke-width="1.5"/>`; });
  spokes.forEach(([x, y]) => { body += node(x, y, false); });
  body += node(scx, scy, true);
  body += tx(110, 156, 'STAR', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 1 });
  body += tx(110, 170, 'all through one central switch', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(110, 181, 'the centre must not fail', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  // mesh: 5 interconnected nodes
  const m = [[330, 40], [282, 76], [378, 76], [298, 128], [362, 128]];
  const links = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4], [1, 4], [2, 3]];
  links.forEach(([a, b]) => { body += `<line x1="${m[a][0]}" y1="${m[a][1]}" x2="${m[b][0]}" y2="${m[b][1]}" stroke="var(--border)" stroke-width="1.5"/>`; });
  m.forEach(([x, y]) => { body += node(x, y, false); });
  body += tx(330, 156, 'MESH', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 1 });
  body += tx(330, 170, 'many routes between devices', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(330, 181, 'a dead link just reroutes', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 192', body);
})();

// 18a) the Caesar cipher — shift the alphabet by a key
const caesarShiftD = (() => {
  const A = 'ABCDEFGHIJ';
  const w = 30, gap = 4, x0 = (W - (10 * w + 9 * gap)) / 2;
  let body = tx(220, 16, 'THE CAESAR CIPHER · SHIFT EVERY LETTER BY THE KEY', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 });
  body += tx(x0 - 10, 49, 'plain', { anchor: 'end', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  [...A].forEach((ch, i) => { body += cell(x0 + i * (w + gap), 32, w, 26, ch, { muted: true, fs: 12 }); });
  body += tx(x0 - 10, 95, 'shift 3', { anchor: 'end', fill: 'var(--phase-color)', fs: 12, ls: 0 });
  [...A].forEach((ch, i) => {
    const shifted = String.fromCharCode((ch.charCodeAt(0) - 65 + 3) % 26 + 65);
    body += cell(x0 + i * (w + gap), 78, w, 26, shifted, { on: i === 2, fs: 12 });
  });
  body += `<line x1="${x0 + 2 * (w + gap) + w / 2}" y1="58" x2="${x0 + 2 * (w + gap) + w / 2}" y2="78" stroke="var(--phase-color)" stroke-width="2"/>`;
  body += tx(220, 128, 'C becomes F — so  CAT → FDW.  Decode = shift back the other way', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  body += tx(220, 146, 'only 25 possible keys — a computer (or a patient human) can try them all', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 156', body);
})();

// 18b) symmetric vs asymmetric keys
const encKeys = (() => {
  let body = tx(220, 16, 'ONE KEY, OR A KEY PAIR?', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += tx(110, 38, 'SYMMETRIC', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 1 });
  body += cell(38, 48, 52, 30, 'YOU', { fs: 12 }) + cell(130, 48, 52, 30, 'BANK', { fs: 12 });
  body += `<line x1="94" y1="63" x2="126" y2="63" stroke="var(--ink-4)" stroke-width="1.5"/>`;
  body += `<text x="110" y="58" font-size="12" text-anchor="middle">🔑</text>`;
  body += tx(110, 96, 'the SAME shared key', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(110, 108, 'locks and unlocks', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(110, 126, 'fast — but how do you share', { anchor: 'middle', fill: 'var(--error-ink, #dc2626)', fs: 12, ls: 0 });
  body += tx(110, 137, 'the key safely?', { anchor: 'middle', fill: 'var(--error-ink, #dc2626)', fs: 12, ls: 0 });
  body += `<line x1="220" y1="34" x2="220" y2="140" stroke="var(--border)" stroke-width="1.2" stroke-dasharray="4 4"/>`;
  body += tx(330, 38, 'ASYMMETRIC', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 1 });
  body += cell(252, 48, 70, 30, 'PUBLIC', { on: true, fs: 12 }) + cell(338, 48, 70, 30, 'PRIVATE', { fs: 12 });
  body += tx(284, 96, 'shared openly', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(284, 108, 'anyone can LOCK', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(380, 96, 'kept secret', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(380, 108, 'it UNLOCKS', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(330, 130, 'strangers can send secrets —', { anchor: 'middle', fill: 'var(--success-ink, #16a34a)', fs: 12, ls: 0 });
  body += tx(330, 141, 'no shared secret needed', { anchor: 'middle', fill: 'var(--success-ink, #16a34a)', fs: 12, ls: 0 });
  body += tx(220, 162, 'HTTPS: asymmetric agrees a key → fast symmetric does the rest', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  return wrap('0 0 440 172', body);
})();

// 18c) the threat map — three families of attack
const threatMap = (() => {
  const cols = [
    ['MALWARE', ['virus', 'worm', 'trojan', 'ransomware'], 'attacks the SOFTWARE'],
    ['SOCIAL ENGINEERING', ['phishing', 'shouldering', 'blagging'], 'attacks the PERSON'],
    ['DIRECT ATTACKS', ['brute force', 'DDoS', 'SQL injection'], 'attacks the SYSTEM'],
  ];
  const w = 128, gap = 14, x0 = (W - (3 * w + 2 * gap)) / 2;
  let body = tx(220, 16, 'KNOW YOUR ENEMY · THREE FAMILIES OF ATTACK', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 });
  cols.forEach(([name, items, sub], i) => {
    const x = x0 + i * (w + gap);
    body += `<rect x="${x}" y="30" width="${w}" height="${34 + items.length * 16 + 8}" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>`
      + `<rect x="${x}" y="30" width="${w}" height="22" rx="5" fill="var(--phase-color)"/>`
      + `<text x="${x + w / 2}" y="45" fill="#fff" font-family="${FONT}" font-size="12" text-anchor="middle" letter-spacing="0.5">${name}</text>`;
    items.forEach((it, k) => { body += tx(x + w / 2, 68 + k * 16, it, { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 }); });
    body += tx(x + w / 2, 30 + 34 + items.length * 16 + 22, sub, { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  });
  body += tx(220, 172, 'defences layer too: firewall · anti-malware · access levels · training', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 182', body);
})();

// 19a) the computational-thinking toolkit
const ctToolkit = (() => {
  const tools = [
    ['DECOMPOSITION', 'break it into sub-problems'],
    ['ABSTRACTION', 'strip irrelevant detail'],
    ['PATTERN RECOGNITION', 'spot reusable similarities'],
    ['ALGORITHMIC THINKING', 'exact steps, in order'],
  ];
  const w = 196, h = 44, gapX = 16, gapY = 14;
  const x0 = (W - (2 * w + gapX)) / 2;
  let body = tx(220, 16, 'THE THINKING TOOLKIT · USE BEFORE CODING', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  tools.forEach(([name, sub], i) => {
    const x = x0 + (i % 2) * (w + gapX), y = 30 + Math.floor(i / 2) * (h + gapY);
    body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>`
      + tx(x + w / 2, y + 19, name, { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 })
      + tx(x + w / 2, y + 34, sub, { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  });
  body += tx(220, 152, '"make a game" → decompose → abstract → spot patterns → write the algorithm', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 162', body);
})();

// 19b) binary search halves the sorted list each check
const searchHalving = (() => {
  const list = [1, 3, 5, 7, 9, 11, 13, 15];
  const w = 40, gap = 5, x0 = (W - (8 * w + 7 * gap)) / 2;
  const rowOf = (y, activeLo, activeHi, checkIdx) => list.map((v, i) => {
    const out = i < activeLo || i > activeHi;
    return cell(x0 + i * (w + gap), y, w, 28, String(v), { on: i === checkIdx, muted: out, bg: out ? 'var(--overlay, #fff)' : undefined, fs: 12 });
  }).join('');
  let body = tx(220, 16, 'BINARY SEARCH FOR 11 · HALVE THE SORTED LIST', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 0.5 });
  body += tx(x0 - 8, 48, '1', { anchor: 'end', fill: 'var(--phase-color)', fs: 12, ls: 0 }) + rowOf(32, 0, 7, 3);
  body += tx(220, 78, 'check the middle (7) — 11 is bigger, so bin the left half', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  body += tx(x0 - 8, 108, '2', { anchor: 'end', fill: 'var(--phase-color)', fs: 12, ls: 0 }) + rowOf(92, 4, 7, 5);
  body += tx(220, 144, 'found in 2 checks — a linear search could have needed 6', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0 });
  body += tx(220, 162, '1,000 items → ~10 checks · 1,000,000 → ~20 — sorted lists only', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 172', body);
})();

// 19c) one pass of a bubble sort on [5,3,8,1]
const bubblePassD = (() => {
  const rows = [
    [[5, 3, 8, 1], 0, 'compare 5,3 → 5 is bigger → SWAP'],
    [[3, 5, 8, 1], 1, 'compare 5,8 → in order → KEEP'],
    [[3, 5, 8, 1], 2, 'compare 8,1 → 8 is bigger → SWAP'],
    [[3, 5, 1, 8], -1, 'the LARGEST has bubbled to the end ✓'],
  ];
  const w = 34, gap = 5, x0 = 60;
  let body = tx(220, 16, 'ONE BUBBLE-SORT PASS · [5, 3, 8, 1]', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  rows.forEach(([arr, cmp, note], r) => {
    const y = 30 + r * 36;
    arr.forEach((v, i) => {
      const hot = cmp >= 0 && (i === cmp || i === cmp + 1);
      body += cell(x0 + i * (w + gap), y, w, 26, String(v), { on: hot, fs: 12 });
    });
    body += tx(x0 + 4 * (w + gap) + 8, y + 17, note, { fill: r === 3 ? 'var(--ink)' : 'var(--ink-4)', fs: 12, ls: 0 });
  });
  body += tx(220, 182, 'repeat passes until one whole pass needs no swaps — then the list is sorted', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 192', body);
})();

// 12d) the working-column method for a bracketed expression
const ttWorking = (() => {
  const rows = [
    ['0', '0', '1', '0'],
    ['0', '1', '0', '0'],
    ['1', '0', '1', '1'],
    ['1', '1', '0', '0'],
  ];
  const w = 52, gap = 5, x0 = (W - (4 * w + 3 * gap)) / 2, y0 = 46;
  let body = tx(220, 16, 'BRACKETS? DRAW A WORKING COLUMN', { anchor: 'middle', fill: 'var(--phase-color)', fs: 12, ls: 1 });
  body += tx(220, 34, 'Q = A AND (NOT B)', { anchor: 'middle', fill: 'var(--ink)', fs: 12, ls: 0.5 });
  ['A', 'B', 'NOT B', 'Q'].forEach((h, c) => {
    body += cell(x0 + c * (w + gap), y0, w, 24, h, { muted: c < 2, on: c === 3, fs: 12 });
    if (c === 2) body += `<rect x="${x0 + 2 * (w + gap)}" y="${y0}" width="${w}" height="24" rx="3" fill="none" stroke="var(--warn-ink, #b45309)" stroke-width="2" stroke-dasharray="4 3"/>`;
  });
  rows.forEach((r, ri) => {
    r.forEach((v, c) => {
      const y = y0 + 28 + ri * 28;
      body += cell(x0 + c * (w + gap), y, w, 24, v, { on: c === 3 && v === '1', muted: c < 2, fs: 12 });
      if (c === 2) body += `<rect x="${x0 + 2 * (w + gap)}" y="${y}" width="${w}" height="24" rx="3" fill="none" stroke="var(--warn-ink, #b45309)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    });
  });
  body += tx(220, y0 + 28 + 4 * 28 + 18, '1: fill NOT B for every row (just flip B) · 2: THEN Q = A AND that column', { anchor: 'middle', fill: 'var(--ink-4)', fs: 12, ls: 0 });
  return wrap('0 0 440 210', body);
})();

export const SVG_DIAGRAMS = {
  'tt-working': ttWorking,
  'lan-wan': lanWan,
  'topologies': topologies,
  'caesar-strip': caesarShiftD,
  'enc-keys': encKeys,
  'threat-map': threatMap,
  'ct-toolkit': ctToolkit,
  'search-halving': searchHalving,
  'bubble-pass': bubblePassD,
  'packet-journey': packetJourney,
  'language-levels': languageLevels,
  'compiler-interpreter': compilerInterpreter,
  'os-layers': osLayers,
  'os-jobs': osJobs,
  'storage-tech': storageTech,
  'virtual-memory': virtualMemory,
  'cpu-parts': cpuParts,
  'fde-steps': fdeSteps,
  'memory-hierarchy': memoryHierarchy,
  'gate-symbols': gateSymbols,
  'truth-table-anatomy': truthAnatomy,
  'gate-chain': gateChain,
  'ascii-map': asciiMap,
  'ascii-table': asciiTable,
  'bitmap-grid': bitmapGrid,
  'sound-sampling': soundSampling,
  'compression-paths': compressionPaths,
  'twos-read': twosRead,
  'twos-negate': twosNegate,
  'twos-range': twosRange,
  'hex-digits': hexDigits,
  'hex-place-value': hexPlaceValue,
  'hex-divide': hexDivide,
  'hex-nibble': hexNibble,
  'pixel-rgb': pixelRgb,
  'rgb-mix': rgbMix,
  'hex-anatomy': hexAnatomy,
  'channel-scale': channelScale,
  'decimal-binary': decimalBinary,
  'decimal-place-value': decimalPlaceValue,
  'binary-timeline': binaryTimeline,
  'bit-nibble-byte': bitNibbleByte,
  'unit-ladder': unitLadder,
  'subtract-method': subtractMethod,
  'binary-addition': binaryAddition,
  'binary-shift': binaryShift,
  'overflow': overflow,
};
