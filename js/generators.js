// ============================================================
// generators.js — procedural question generators.
//
// A "generated" question slot in content.js is just `{ gen: 'id' }`
// instead of a static question object. On load, the engine calls
// generateQuestion('id') to build a FRESH instance, which it then
// renders through the normal question-type module (MC, BINARY, …).
// Nothing else changes: the slot keeps its stable index, so mastery,
// spaced-repetition and the "Q x of N" counts all work as before — a
// missed generated slot simply regenerates a new instance on review.
//
// Generators produce computational questions (where a fixed answer
// would be memorisable). Factual/recall questions stay hand-authored.
//
// CONVENTION: standard binary, MSB on the left (8 4 2 1 for 4 bits),
// as written in real GCSE exams. Answer arrays are MSB-first.
// ============================================================

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function hex2(v) { return v.toString(16).toUpperCase().padStart(2, '0'); }

// MSB-first bit array, e.g. 13 -> [1,1,0,1]
function toBitsMSB(value, bits) {
  const a = [];
  for (let i = bits - 1; i >= 0; i--) a.push((value >> i) & 1);
  return a;
}
// the place values that are switched ON, from most to least significant
function onPlaceValues(arr) {
  const bits = arr.length;
  return arr.map((b, i) => (b ? (1 << (bits - 1 - i)) : 0)).filter(Boolean);
}
// two's-complement sum string for an 8-bit pattern, e.g. "-128 + 64 + 2"
function twosSum(bits) {
  const pv = [-128, 64, 32, 16, 8, 4, 2, 1];
  const on = bits.map((b, i) => (b ? pv[i] : 0)).filter(v => v !== 0);
  return on.length ? on.join(' + ') : '0';
}

// build `count` unique wrong options (strings), preferring the supplied
// mistake-based candidates, then padding via `fallback()`. Never the
// answer, never empty, always distinct.
function pickOptions(answer, candidates, fallback, count = 3) {
  const out = [], seen = new Set([String(answer)]);
  const add = (c) => {
    if (c == null) return;
    const s = String(c);
    if (s === '' || seen.has(s)) return;
    seen.add(s); out.push(s);
  };
  for (const c of candidates) { if (out.length < count) add(c); }
  let guard = 0;
  while (out.length < count && guard++ < 1000) add(fallback());
  return out.slice(0, count);
}
function numericFallback(answer, allowNeg = false) {
  let d = 0;
  return () => {
    d++;
    let v = Number(answer) + (Math.random() < 0.5 ? d : -d);
    if (!allowNeg && v < 0) v = Number(answer) + d;
    return v;
  };
}

// ============================================================
// BINARY (Phase 1)
// ============================================================
function binaryToDenary() {
  const bits = 4;
  const value = randInt(1, (1 << bits) - 1);
  const arr = toBitsMSB(value, bits);
  const str = arr.join('');
  const misread = parseInt([...str].reverse().join(''), 2);       // LSB-left misreading
  const flipped = value ^ (1 << randInt(0, bits - 1));            // one bit misread
  const options = [String(value), ...pickOptions(value, [misread, flipped, value + 1, value - 1, value + 2], numericFallback(value))];
  const on = onPlaceValues(arr);
  return {
    type: 'MC', badge: 'BINARY', board: 'AQA · OCR · Eduqas',
    title: `What is the denary value of binary ${str}?`,
    desc: 'Place values (left→right): 8, 4, 2, 1',
    options, answer: String(value),
    hints: ['Add up the place values (8, 4, 2, 1) where the bit is 1.', `${str} → ${on.join(' + ') || '0'} = ${value}.`],
    explain: `<strong>${str}</strong> → ${arr.map((b, i) => `${b}×${1 << (bits - 1 - i)}`).join(' + ')} = <strong>${value}</strong>.`,
  };
}
function denaryToBinary() {
  const bits = 4;
  const value = randInt(1, (1 << bits) - 1);
  const arr = toBitsMSB(value, bits);
  const on = onPlaceValues(arr);
  return {
    type: 'BINARY', badge: 'BINARY', board: 'AQA · OCR · Eduqas',
    title: `Convert denary ${value} to 4-bit binary`,
    desc: 'Place values (left→right): 8, 4, 2, 1',
    bits, answer: arr,
    hints: [`${value} = ${on.join(' + ')}. Which place values add up to ${value}?`, `Switch on the bits worth ${on.join(', ')}.`],
    explain: `<strong>${value} = ${on.join(' + ')}</strong> → ${arr.join('')}. Check: ${arr.map((b, i) => `${b}×${1 << (bits - 1 - i)}`).join(' + ')} = ${value}.`,
  };
}
function bitsValues() {
  const n = randInt(3, 8);
  const value = 2 ** n;
  const options = [String(value), ...pickOptions(value, [2 ** (n - 1), 2 ** (n + 1), n * 2, value - 1, value + 1], numericFallback(value))];
  return {
    type: 'MC', badge: 'BINARY', board: 'AQA · OCR · Eduqas',
    title: `How many different values can ${n} bits store?`,
    desc: 'Each extra bit doubles the number of combinations',
    options, answer: String(value),
    hints: [`${n} bits means 2 to the power of ${n}.`, `2^${n} = ?`],
    explain: `<strong>${n} bits = 2^${n} = ${value}</strong> different values (0 to ${value - 1}). Each extra bit doubles the number of combinations.`,
  };
}

// ============================================================
// HEXADECIMAL (Phase 3)
// ============================================================
function hexToDenary() {
  const value = randInt(16, 255);
  const hx = hex2(value), hi = value >> 4, lo = value & 15;
  const swapped = 16 * lo + hi;           // read the digits the wrong way round
  const baseten = hi * 10 + lo;           // treated the place value as ×10 not ×16
  const options = [String(value), ...pickOptions(value, [swapped, baseten, value + 16, value - 1], numericFallback(value))];
  return {
    type: 'MC', badge: 'HEX', board: 'AQA · OCR · Eduqas',
    title: `What is the denary value of hex ${hx}?`,
    desc: 'First digit ×16, second digit ×1 (A=10 … F=15)',
    options, answer: String(value),
    hints: ['Multiply the first digit by 16 and add the second. A=10, B=11 … F=15.', `${hi}×16 + ${lo}×1 = ?`],
    explain: `<strong>${hx} = ${hi}×16 + ${lo}×1 = ${hi * 16} + ${lo} = ${value}.</strong>`,
  };
}
function denaryToHex() {
  const value = randInt(16, 255);
  const hx = hex2(value), hi = value >> 4, lo = value & 15;
  const swapped = (lo.toString(16) + hi.toString(16)).toUpperCase();
  const off = (((hi + 1) & 15).toString(16) + lo.toString(16)).toUpperCase();
  const options = [hx, ...pickOptions(hx, [swapped, off], () => hex2(randInt(16, 255)))];
  return {
    type: 'MC', badge: 'HEX', board: 'AQA · OCR · Eduqas',
    title: `What is denary ${value} in hexadecimal?`,
    desc: 'Divide by 16: the quotient is the first digit, the remainder the second',
    options, answer: hx,
    hints: [`${value} ÷ 16 = ${hi} remainder ${lo}.`, `${hi} → ${hi.toString(16).toUpperCase()}, ${lo} → ${lo.toString(16).toUpperCase()} (A–F are 10–15).`],
    explain: `<strong>${value} = ${hi}×16 + ${lo} → ${hx}.</strong> (${hi} = ${hi.toString(16).toUpperCase()}, ${lo} = ${lo.toString(16).toUpperCase()}.)`,
  };
}
function binaryToHex() {
  const value = randInt(0, 255);
  const bin = toBitsMSB(value, 8).join('');
  const hx = hex2(value), hi = value >> 4, lo = value & 15;
  const swapped = (lo.toString(16) + hi.toString(16)).toUpperCase();
  const flip = hex2(value ^ (1 << randInt(0, 7)));
  const options = [hx, ...pickOptions(hx, [swapped, flip], () => hex2(randInt(0, 255)))];
  return {
    type: 'MC', badge: 'HEX', board: 'AQA · OCR · Eduqas',
    title: `Convert binary ${bin} to hexadecimal`,
    desc: 'Split into two nibbles (groups of 4 bits) and convert each',
    options, answer: hx,
    hints: ['Split the 8 bits into two groups of four, then convert each nibble.', `${bin.slice(0, 4)} = ${hi.toString(16).toUpperCase()}, ${bin.slice(4)} = ${lo.toString(16).toUpperCase()}.`],
    explain: `<strong>${bin}</strong> → ${bin.slice(0, 4)} (${hi.toString(16).toUpperCase()}) | ${bin.slice(4)} (${lo.toString(16).toUpperCase()}) → <strong>${hx}</strong>.`,
  };
}

// ============================================================
// LOGIC GATES (Phase 2)
// ============================================================
const GATE_INFO = {
  AND: 'outputs 1 only when BOTH inputs are 1',
  OR: 'outputs 1 when AT LEAST ONE input is 1',
  XOR: 'outputs 1 only when the inputs are DIFFERENT',
  NOT: 'inverts its single input (1→0, 0→1)',
};
function logicGate() {
  const gate = ['AND', 'OR', 'XOR', 'NOT'][randInt(0, 3)];
  if (gate === 'NOT') {
    const a = randInt(0, 1), out = a ? 0 : 1;
    return {
      type: 'MC', badge: 'LOGIC GATE', board: 'AQA · OCR · Eduqas',
      title: `NOT gate: input = ${a}. What is the output?`,
      desc: 'The NOT gate inverts (flips) its single input',
      options: [String(out), String(1 - out), 'Undefined', 'Error'], answer: String(out),
      hints: ['NOT simply flips the bit.', `NOT ${a} = ?`],
      explain: `<strong>NOT ${a} = ${out}.</strong> The NOT gate ${GATE_INFO.NOT}.`,
    };
  }
  const a = randInt(0, 1), b = randInt(0, 1);
  const out = gate === 'AND' ? (a & b) : gate === 'OR' ? (a | b) : (a ^ b);
  return {
    type: 'MC', badge: 'LOGIC GATE', board: 'AQA · OCR · Eduqas',
    title: `${gate} gate: A = ${a}, B = ${b}. What is the output?`,
    desc: `An ${gate} gate ${GATE_INFO[gate]}`,
    options: [String(out), String(1 - out), 'Undefined', 'Error'], answer: String(out),
    hints: [`An ${gate} gate ${GATE_INFO[gate]}.`, `${a} ${gate} ${b} = ?`],
    explain: `<strong>${a} ${gate} ${b} = ${out}.</strong> An ${gate} gate ${GATE_INFO[gate]}.`,
  };
}

// ============================================================
// TWO'S COMPLEMENT (Phase 9)
// ============================================================
function twosToDenary() {
  const u = randInt(1, 255);
  const signed = u >= 128 ? u - 256 : u;
  const bits = toBitsMSB(u, 8), str = bits.join('');
  const options = [String(signed), ...pickOptions(signed, [u, -signed, signed + 1, signed - 1], numericFallback(signed, true))];
  return {
    type: 'MC', badge: "TWO'S COMPLEMENT", board: 'AQA · OCR',
    title: `What is the denary value of two's complement ${str}?`,
    desc: 'Place values (left→right): -128, 64, 32, 16, 8, 4, 2, 1',
    options, answer: String(signed),
    hints: [bits[0] ? 'The leading bit is 1, so the number is negative (the -128 column is ON).' : 'The leading bit is 0, so read it as a normal positive binary number.', `Add the ON place values: ${twosSum(bits)}.`],
    explain: `<strong>${str}</strong> → ${twosSum(bits)} = <strong>${signed}</strong>.`,
  };
}
function twosNegate() {
  const v = randInt(1, 127);
  const neg = (256 - v) & 255;
  const ans = toBitsMSB(neg, 8).join('');
  const posStr = toBitsMSB(v, 8).join('');
  const flipOnly = toBitsMSB((~v) & 255, 8).join('');
  const options = [ans, ...pickOptions(ans, [flipOnly, posStr, toBitsMSB((neg + 1) & 255, 8).join('')], () => toBitsMSB(randInt(128, 255), 8).join(''))];
  return {
    type: 'MC', badge: "TWO'S COMPLEMENT", board: 'AQA · OCR',
    title: `What is the 8-bit two's complement representation of -${v}?`,
    desc: `Method: write +${v}, flip all the bits, then add 1`,
    options, answer: ans,
    hints: [`+${v} = ${posStr}.`, `Flip → ${flipOnly}, then add 1.`],
    explain: `<strong>-${v}:</strong> +${v} = ${posStr} → flip the bits → ${flipOnly} → add 1 → <strong>${ans}</strong>.`,
  };
}

// ============================================================
// CAESAR CIPHER (Phase 7)
// ============================================================
const WORDS = ['CAT', 'DOG', 'CODE', 'BYTE', 'DATA', 'LOGIC', 'CIPHER', 'BINARY', 'PIXEL', 'ARRAY', 'CLOUD', 'ROUTER', 'SERVER', 'PACKET', 'MEMORY', 'BACKUP', 'SCRIPT', 'OUTPUT'];
function shiftLetter(code, by) { return String.fromCharCode((code - 65 + by + 260) % 26 + 65); }   // +260 keeps it positive

function caesarLetter() {
  const shift = randInt(1, 25);
  const code = randInt(65, 90);
  const ch = String.fromCharCode(code);
  const enc = shiftLetter(code, shift);
  const back = shiftLetter(code, -shift);                 // shifted the wrong way
  const off = shiftLetter(enc.charCodeAt(0), 1);          // off by one
  const options = [enc, ...pickOptions(enc, [back, off, ch], () => String.fromCharCode(randInt(65, 90)))];
  return {
    type: 'MC', badge: 'ENCRYPTION', board: 'AQA · OCR · Eduqas',
    title: `Caesar cipher with shift ${shift}: what does the letter ${ch} become?`,
    desc: 'Shift the letter forward through the alphabet, wrapping Z → A',
    options, answer: enc,
    hints: [`Count ${shift} places forward from ${ch}.`, 'After Z, wrap back round to A.'],
    explain: `<strong>${ch} + ${shift} = ${enc}.</strong> A Caesar cipher shifts each letter forward by the key, wrapping past Z back to A.`,
  };
}
function caesarDecode() {
  const word = WORDS[randInt(0, WORDS.length - 1)];
  const shift = randInt(1, 25);
  const cipher = [...word].map(c => shiftLetter(c.charCodeAt(0), shift)).join('');
  return {
    type: 'CIPHER', badge: 'CIPHER WHEEL', board: 'AQA · OCR · Eduqas',
    title: `Crack the code: turn the wheel until ${cipher} reads as a word.`,
    desc: 'The shift is unknown — try shifts until the message makes sense. That is how a Caesar cipher is broken (only 25 keys to test).',
    mode: 'decode', text: cipher, shift, answer: word,
    hints: ['There are only 25 shifts to try — work through them.', 'Every letter was shifted forward by the same amount when it was encrypted.'],
    explain: `<strong>${cipher} shifted back by ${shift} = ${word}.</strong> A Caesar cipher has only 25 possible keys, so it is broken by brute force — trying each shift until readable text appears.`,
  };
}

// ============================================================
// BUBBLE SORT (Phase 6)
// ============================================================
function shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function isSorted(a) { for (let i = 0; i < a.length - 1; i++) if (a[i] > a[i + 1]) return false; return true; }
function randomArray(n) { const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9]; let a; do { shuffleArr(pool); a = pool.slice(0, n); } while (isSorted(a)); return a; }
function onePass(a) { const r = [...a]; for (let i = 0; i < r.length - 1; i++) if (r[i] > r[i + 1]) { const t = r[i]; r[i] = r[i + 1]; r[i + 1] = t; } return r; }
function passDecisions(a) { const r = [...a], d = []; for (let i = 0; i < r.length - 1; i++) { if (r[i] > r[i + 1]) { d.push('swap'); const t = r[i]; r[i] = r[i + 1]; r[i + 1] = t; } else d.push('keep'); } return d; }
function swapAdjacent(a) { const r = [...a]; const i = randInt(0, r.length - 2); [r[i], r[i + 1]] = [r[i + 1], r[i]]; return r; }
const fmt = a => `[${a.join(', ')}]`;

function bubbleResult() {
  const arr = randomArray(4);
  const result = onePass(arr);
  const cands = [fmt([...arr].sort((a, b) => a - b)), fmt(arr), fmt(onePass([...arr].reverse())), fmt(swapAdjacent(result))];
  const options = [fmt(result), ...pickOptions(fmt(result), cands, () => fmt(shuffleArr([...arr])))];
  return {
    type: 'MC', badge: 'ALGORITHM', board: 'AQA · OCR · Eduqas',
    title: `After one pass of Bubble Sort on ${fmt(arr)}, what is the result?`,
    desc: 'Compare each adjacent pair left to right, swapping if the left is larger',
    options, answer: fmt(result),
    hints: ['Only swap when the left value is larger than the one to its right.', 'Work left to right through each adjacent pair; the largest value bubbles to the end.'],
    explain: `<strong>${passDecisions(arr).join(', ')} → ${fmt(result)}.</strong> One full pass compares each adjacent pair, swapping if the left is larger; the largest value bubbles to the end.`,
  };
}
function bubblePass() {
  const arr = randomArray(4);
  return {
    type: 'TRACE', badge: 'TRACE', board: 'AQA · OCR · Eduqas',
    title: `Trace one pass of Bubble Sort on ${fmt(arr)}.`,
    desc: 'Work left to right. At each highlighted pair, choose SWAP if the left value is larger, otherwise KEEP.',
    array: arr,
    hints: ['Bubble Sort compares each adjacent pair and swaps only when the left value is larger.', 'Go left to right; the largest value bubbles to the end of the list.'],
    explain: `<strong>One pass: ${passDecisions(arr).join(', ')} → ${fmt(onePass(arr))}.</strong> The largest value bubbles to the end of the list.`,
  };
}

// ============================================================
// FILE SIZE (Phase 10)
// ============================================================
function fileSizeImage() {
  const w = randInt(2, 20) * 10, h = randInt(2, 20) * 10;
  const depth = [2, 3, 4, 8][randInt(0, 3)];
  const bits = w * h * depth;
  const options = [String(bits), ...pickOptions(bits, [w * h, bits * 8, Math.round(bits / depth), w + h + depth], numericFallback(bits))];
  return {
    type: 'MC', badge: 'DATA', board: 'AQA · OCR · Eduqas',
    title: `An image is ${w} pixels wide and ${h} pixels high with a colour depth of ${depth} bits. What is its uncompressed file size in bits?`,
    desc: 'File size (bits) = width × height × colour depth',
    options, answer: String(bits),
    hints: ['Multiply width × height to get the number of pixels.', `${w} × ${h} × ${depth} = ?`],
    explain: `<strong>${w} × ${h} × ${depth} = ${bits} bits.</strong> File size = width × height × colour depth.`,
  };
}

const GENERATORS = {
  binaryToDenary, denaryToBinary, bitsValues,
  hexToDenary, denaryToHex, binaryToHex,
  logicGate,
  twosToDenary, twosNegate,
  caesarLetter, caesarDecode,
  bubbleResult, bubblePass,
  fileSizeImage,
};

export function generateQuestion(genId, opts) {
  const fn = GENERATORS[genId];
  if (!fn) throw new Error('unknown generator: ' + genId);
  return fn(opts || {});
}
export { GENERATORS };
