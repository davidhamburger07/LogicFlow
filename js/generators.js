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

import { getBoard } from './storage.js';

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function hex2(v) { return v.toString(16).toUpperCase().padStart(2, '0'); }

// "guided in practice, bare in assessment" (scaffolding fades by context):
// generators emit a guided interactive in practice, a plain input in tests —
// a test must not lay the method out for the student.
const ASSESS = ctx => ctx === 'unit-test' || ctx === 'mock';

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
// like numericFallback but returns binary strings of a fixed width (for
// binary-arithmetic distractors).
function binStringFallback(value, width) {
  let d = 0;
  return () => {
    d++;
    let v = Number(value) + (Math.random() < 0.5 ? d : -d);
    if (v < 0) v = Number(value) + d;
    return (v & ((1 << width) - 1)).toString(2).padStart(width, '0');
  };
}

// ============================================================
// BINARY (Phase 1)
// ============================================================
function binaryToDenary(opts, context) {
  const bits = (opts && opts.bits) || 4;                          // opts.bits: 8 for an exam-level question
  const value = randInt(1, (1 << bits) - 1);
  const arr = toBitsMSB(value, bits);
  const str = arr.join('');
  const pv = Array.from({ length: bits }, (_, i) => 1 << (bits - 1 - i)).join(', ');
  const on = onPlaceValues(arr);
  const base = {
    badge: 'BINARY', board: 'AQA · OCR · Eduqas',
    title: `What is the denary value of binary ${str}?`,
    hints: [`Add up the place values (${pv}) where the bit is 1.`, `${str} → ${on.join(' + ') || '0'} = ${value}.`],
    explain: `<strong>${str}</strong> → ${arr.map((b, i) => `${b}×${1 << (bits - 1 - i)}`).join(' + ')} = <strong>${value}</strong>.`,
  };
  // assessment: plain typed number. practice: guided place-value adder (tap lit bits to total).
  if (ASSESS(context)) return { ...base, type: 'NUMBER', desc: 'Read the binary number and enter its denary value.', answer: value };
  return { ...base, type: 'PLACEVALUE', desc: 'Tap each lit (1) bit to add its place value into the total.', bits: arr, signed: false };
}
function denaryToBinary(opts) {
  const bits = (opts && opts.bits) || 4;                          // opts.bits: 8 for an exam-level question
  const value = randInt(1, (1 << bits) - 1);
  const arr = toBitsMSB(value, bits);
  const on = onPlaceValues(arr);
  const pv = Array.from({ length: bits }, (_, i) => 1 << (bits - 1 - i)).join(', ');
  return {
    type: 'BINARY', badge: 'BINARY', board: 'AQA · OCR · Eduqas',
    title: `Convert denary ${value} to ${bits}-bit binary`,
    desc: `Place values (left→right): ${pv}`,
    bits, answer: arr,
    workings: { tool: 'place-value', bits, signed: false },
    hints: [`${value} = ${on.join(' + ')}. Which place values add up to ${value}?`, `Switch on the bits worth ${on.join(', ')}.`],
    explain: `<strong>${value} = ${on.join(' + ')}</strong> → ${arr.join('')}. Check: ${arr.map((b, i) => `${b}×${1 << (bits - 1 - i)}`).join(' + ')} = ${value}.`,
  };
}
function bitsValues() {
  const n = randInt(3, 8);
  const value = 2 ** n;
  return {
    type: 'NUMBER', badge: 'BINARY', board: 'AQA · OCR · Eduqas',
    title: `How many different values can ${n} bits store?`,
    desc: 'Each extra bit doubles the number of combinations (2 to the power of the bits).',
    answer: value,
    hints: [`${n} bits means 2 to the power of ${n}.`, `2^${n} = ?`],
    explain: `<strong>${n} bits = 2^${n} = ${value}</strong> different values (0 to ${value - 1}). Each extra bit doubles the number of combinations.`,
  };
}

// ============================================================
// HEXADECIMAL (Phase 3)
// ============================================================
function hexToDenary(opts, context) {
  const value = randInt(16, 255);
  const hx = hex2(value), hi = value >> 4, lo = value & 15;
  const hiChar = hi.toString(16).toUpperCase(), loChar = lo.toString(16).toUpperCase();
  const base = {
    badge: 'HEX', board: 'AQA · OCR · Eduqas',
    title: `What is the denary value of hex ${hx}?`,
    hints: ['Multiply the first digit by 16 and add the second. A=10, B=11 … F=15.', `${hi}×16 + ${lo}×1 = ?`],
    explain: `<strong>${hx} = ${hi}×16 + ${lo}×1 = ${hi * 16} + ${lo} = ${value}.</strong>`,
  };
  // assessment: plain typed number. practice: guided ×16 / ×1 breakdown.
  if (ASSESS(context)) return { ...base, type: 'NUMBER', desc: 'Enter the denary value (first digit ×16, second ×1).', answer: value };
  return {
    ...base, type: 'CALC', desc: 'Each hex digit: A=10 … F=15. Multiply the first by 16, then add the second.',
    formula: `${hx} = (first digit × 16) + second digit`,
    steps: [
      { expr: `${hi} (${hiChar}) × 16`, answer: hi * 16 },
      { expr: `{prev} + ${lo} (${loChar})`, answer: value, unit: 'denary' },
    ],
  };
}
function denaryToHex(opts, context) {
  const value = randInt(16, 255);
  const hx = hex2(value), hi = value >> 4, lo = value & 15;
  return {
    // hex-digit picker (0–F per digit) in both contexts — it IS the natural input.
    type: 'HEXPICK', badge: 'HEX', board: 'AQA · OCR · Eduqas',
    title: `What is denary ${value} in hexadecimal?`,
    desc: 'Set each hex digit (0–9, A–F). Divide by 16: quotient = first digit, remainder = second.',
    answer: hx,
    hints: [`${value} ÷ 16 = ${hi} remainder ${lo}.`, `${hi} → ${hi.toString(16).toUpperCase()}, ${lo} → ${lo.toString(16).toUpperCase()} (A–F are 10–15).`],
    explain: `<strong>${value} = ${hi}×16 + ${lo} → ${hx}.</strong> (${hi} = ${hi.toString(16).toUpperCase()}, ${lo} = ${lo.toString(16).toUpperCase()}.)`,
  };
}
function binaryToHex() {
  const value = randInt(0, 255);
  const bin = toBitsMSB(value, 8);
  const hx = hex2(value), hi = value >> 4, lo = value & 15;
  return {
    // hex picker with the NIBBLE BRIDGE: each digit shows its 4 source bits.
    type: 'HEXPICK', badge: 'HEX', board: 'AQA · OCR · Eduqas',
    title: `Convert binary ${bin.join('')} to hexadecimal`,
    desc: 'Read each 4-bit nibble shown above the digit and pick its hex value.',
    answer: hx, nibbles: [toBitsMSB(hi, 4), toBitsMSB(lo, 4)],
    hints: ['Split the 8 bits into two nibbles (groups of 4), then convert each.', `${bin.slice(0, 4).join('')} = ${hi.toString(16).toUpperCase()}, ${bin.slice(4).join('')} = ${lo.toString(16).toUpperCase()}.`],
    explain: `<strong>${bin.join('')}</strong> → ${bin.slice(0, 4).join('')} (${hi.toString(16).toUpperCase()}) | ${bin.slice(4).join('')} (${lo.toString(16).toUpperCase()}) → <strong>${hx}</strong>.`,
  };
}
// hex -> 8-bit binary, answered by PRODUCING the bits (generative; harder than MC)
function hexToBinary() {
  const value = randInt(16, 255);
  const hx = hex2(value), hi = value >> 4, lo = value & 15;
  const arr = toBitsMSB(value, 8);
  const hiNib = toBitsMSB(hi, 4).join(''), loNib = toBitsMSB(lo, 4).join('');
  const hChar = hi.toString(16).toUpperCase(), lChar = lo.toString(16).toUpperCase();
  return {
    type: 'BINARY', badge: 'HEX', board: 'AQA · OCR · Eduqas',
    title: `Convert hex ${hx} to 8-bit binary`,
    desc: 'Convert each hex digit to a 4-bit nibble, then join the two nibbles.',
    bits: 8, answer: arr,
    workings: { tool: 'place-value', bits: 8, signed: false },
    hints: [`Each hex digit is 4 bits: ${hChar} = ${hiNib}, ${lChar} = ${loNib}.`, `Join them: ${hiNib} ${loNib}.`],
    explain: `<strong>${hx}</strong> → ${hChar} (${hiNib}) | ${lChar} (${loNib}) → <strong>${arr.join('')}</strong>. Convert each hex digit to 4 bits and concatenate.`,
  };
}
// MULTI-STEP: add two 8-bit binary numbers, then express the result in hex.
function addToHex() {
  const a = randInt(20, 110), b = randInt(20, 110);             // sum <= 220 → fits 2 hex digits
  const sum = a + b;
  const aBin = a.toString(2).padStart(8, '0'), bBin = b.toString(2).padStart(8, '0');
  const answer = hex2(sum);
  const noCarry = hex2((a ^ b) & 0xFF);                         // added without carrying, then converted
  const swapped = answer[1] + answer[0];                        // hex digits the wrong way round
  const off = hex2((sum + 16) & 0xFF);                          // wrong high nibble
  const options = [answer, ...pickOptions(answer, [noCarry, swapped, off], () => hex2(randInt(16, 255)))];
  return {
    type: 'MC', badge: 'HEX', board: 'AQA · OCR · Eduqas',
    title: `Add the binary numbers ${aBin} + ${bBin}, then give the result in hexadecimal.`,
    desc: 'Two steps: add the binary numbers, then convert the 8-bit result to hex (two nibbles).',
    options, answer,
    hints: [`Step 1 — add: ${aBin} (${a}) + ${bBin} (${b}) = ${sum}.`, `Step 2 — convert ${sum} (binary ${sum.toString(2).padStart(8, '0')}) to hex by nibbles → ${answer}.`],
    explain: `<strong>${answer}.</strong> Step 1: ${a} + ${b} = ${sum}. Step 2: ${sum} = binary ${sum.toString(2).padStart(8, '0')} → split into nibbles ${sum.toString(2).padStart(8, '0').slice(0, 4)} | ${sum.toString(2).padStart(8, '0').slice(4)} → <strong>${answer}</strong>.`,
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
      options: ['0', '1'], answer: String(out),
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
    options: ['0', '1'], answer: String(out),
    hints: [`An ${gate} gate ${GATE_INFO[gate]}.`, `${a} ${gate} ${b} = ?`],
    explain: `<strong>${a} ${gate} ${b} = ${out}.</strong> An ${gate} gate ${GATE_INFO[gate]}.`,
  };
}

// ============================================================
// TWO'S COMPLEMENT (Phase 9)
// ============================================================
function twosToDenary(opts, context) {
  const u = randInt(1, 255);
  const signed = u >= 128 ? u - 256 : u;
  const bits = toBitsMSB(u, 8), str = bits.join('');
  const base = {
    badge: "TWO'S COMPLEMENT", board: 'AQA · OCR',
    title: `What is the denary value of two's complement ${str}?`,
    hints: [bits[0] ? 'The leading bit is 1, so the number is negative (the -128 column is ON).' : 'The leading bit is 0, so read it as a normal positive binary number.', `Add the ON place values: ${twosSum(bits)}.`],
    explain: `<strong>${str}</strong> → ${twosSum(bits)} = <strong>${signed}</strong>.`,
  };
  // assessment: plain typed number (may be negative). practice: signed place-value adder (-128 column).
  if (ASSESS(context)) return { ...base, type: 'NUMBER', signed: true, desc: 'Enter the denary value (it may be negative).', answer: signed };
  return { ...base, type: 'PLACEVALUE', signed: true, desc: 'Tap each lit bit to total it up — the leftmost column is worth −128.', bits };
}
function twosNegate(opts, context) {
  const v = randInt(1, 127);
  const neg = (256 - v) & 255;
  const negArr = toBitsMSB(neg, 8);
  const posArr = toBitsMSB(v, 8);
  const flipOnly = toBitsMSB((~v) & 255, 8).join('');
  const base = {
    badge: "TWO'S COMPLEMENT", board: 'AQA · OCR',
    title: `Represent −${v} in 8-bit two's complement.`,
    hints: [`+${v} = ${posArr.join('')}.`, `Flip → ${flipOnly}, then add 1.`],
    explain: `<strong>−${v}:</strong> +${v} = ${posArr.join('')} → flip the bits → ${flipOnly} → add 1 → <strong>${negArr.join('')}</strong>.`,
  };
  // assessment: bit-toggle the answer yourself. practice: guided flip + 1.
  if (ASSESS(context)) return { ...base, type: 'BINARY', desc: "Toggle the bits to give the two's complement.", bits: 8, answer: negArr };
  return { ...base, type: 'FLIPADD', desc: 'Flip every bit, then add 1.', pos: posArr };
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
function fileSizeImage(opts, context) {
  const w = randInt(2, 20) * 10, h = randInt(2, 20) * 10;
  const depth = [2, 3, 4, 8][randInt(0, 3)];
  const bits = w * h * depth;
  const base = {
    badge: 'DATA', board: 'AQA · OCR · Eduqas',
    title: `An image is ${w} pixels wide and ${h} pixels high with a colour depth of ${depth} bits. What is its uncompressed file size in bits?`,
    hints: ['Multiply width × height to get the number of pixels.', `${w} × ${h} × ${depth} = ?`],
    explain: `<strong>${w} × ${h} × ${depth} = ${bits} bits.</strong> File size = width × height × colour depth.`,
  };
  // assessment: plain typed number. practice: guided W × H × depth.
  if (ASSESS(context)) return { ...base, type: 'NUMBER', desc: 'File size (bits) = width × height × colour depth.', unit: 'bits', answer: bits };
  return {
    ...base, type: 'CALC', desc: 'File size = width × height × colour depth.',
    formula: 'size (bits) = width × height × colour depth',
    steps: [
      { expr: `${w} × ${h}`, answer: w * h, unit: 'pixels' },
      { expr: `{prev} × ${depth}`, answer: bits, unit: 'bits' },
    ],
  };
}

// ============================================================
// PROGRAMMING traces (CODE_TRACE) — generated fresh each load so the
// output can't be memorised. The code is built in every board's
// notation (AQA pseudo-code / OCR ERL / Python); the answer is the
// same for all, computed here in JS.
// ============================================================
function traceQ(code, answer, desc, hints, explain, brief) {
  return {
    type: 'CODE_TRACE', badge: 'TRACE', board: 'AQA · OCR · Eduqas',
    title: 'What does this program output?', desc, code, answer: String(answer), hints, explain, brief,
  };
}
function codeArith() {
  const ops = ['+', '-', '*'];
  const op = ops[randInt(0, 2)];
  let a = randInt(2, 12), b = randInt(2, 12);
  if (op === '-' && b > a) { const t = a; a = b; b = t; }      // keep the result non-negative
  const r = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const aqa = `a ← ${a}\nb ← ${b}\nOUTPUT a ${op} b`;
  const py = `a = ${a}\nb = ${b}\nprint(a ${op} b)`;
  return traceQ({ AQA: aqa, OCR: py, Eduqas: py }, r,
    'Work out a and b, then apply the operator.',
    [`First find a and b: a = ${a}, b = ${b}.`, `${a} ${op} ${b} = ?`],
    `<strong>Output: ${r}.</strong> a = ${a} and b = ${b}, so a ${op} b = ${r}.`,
    `A score screen combines two stored values and shows the result. Trace what appears.`);
}
function codeModDiv(opts) {
  const op = (opts && opts.op) || (Math.random() < 0.5 ? 'MOD' : 'DIV');
  const y = randInt(2, 9);
  const x = randInt(y + 1, 60);
  const r = op === 'MOD' ? x % y : Math.floor(x / y);
  const pyOp = op === 'MOD' ? '%' : '//';
  return traceQ({ AQA: `x ← ${x}\nOUTPUT x ${op} ${y}`, OCR: `x = ${x}\nprint(x ${op} ${y})`, Eduqas: `x = ${x}\nprint(x ${pyOp} ${y})` }, r,
    op === 'MOD' ? 'MOD gives the remainder after division.' : 'DIV gives the whole-number part of a division.',
    [`Work out ${x} ÷ ${y}.`, op === 'MOD' ? `${x} = ${Math.floor(x / y)} × ${y} + ${r}, so the remainder is ${r}.` : `${x} ÷ ${y} = ${(x / y).toFixed(2)}, so the whole part is ${r}.`],
    `<strong>Output: ${r}.</strong> ${x} ${op} ${y} = ${r} (${op === 'MOD' ? 'the remainder' : 'the whole-number part'}).`,
    op === 'MOD' ? `A game shares ${x} coins between ${y} players — this code works out what's LEFT OVER.` : `A game shares ${x} coins between ${y} players — this code works out how many WHOLE coins each gets.`);
}
function codeForSum() {
  const n = randInt(3, 7);
  const sum = n * (n + 1) / 2;
  return traceQ({
    AQA: `total ← 0\nFOR i ← 1 TO ${n}\n  total ← total + i\nENDFOR\nOUTPUT total`,
    OCR: `total = 0\nfor i = 1 to ${n}\n  total = total + i\nnext i\nprint(total)`,
    Eduqas: `total = 0\nfor i in range(1, ${n + 1}):\n  total = total + i\nprint(total)`,
  }, sum, `The loop runs with i = 1 to ${n}.`,
    ['Add i to total each pass — make a trace table.', `1 + 2 + … + ${n} = ${sum}.`],
    `<strong>Output: ${sum}.</strong> The loop adds 1, 2, … ${n} to total: 1 + 2 + … + ${n} = ${sum}.`,
    `A step-challenge app banks 1 point on day 1, 2 on day 2 … up to day ${n}, then shows the total.`);
}
function codeWhileCount() {
  const limit = [16, 20, 24, 30, 40, 50, 100][randInt(0, 6)];
  let n = 1, count = 0;
  while (n < limit) { n *= 2; count++; }
  return traceQ({
    AQA: `n ← 1\ncount ← 0\nWHILE n < ${limit}\n  n ← n * 2\n  count ← count + 1\nENDWHILE\nOUTPUT count`,
    OCR: `n = 1\ncount = 0\nwhile n < ${limit}\n  n = n * 2\n  count = count + 1\nendwhile\nprint(count)`,
    Eduqas: `n = 1\ncount = 0\nwhile n < ${limit}:\n  n = n * 2\n  count = count + 1\nprint(count)`,
  }, count, 'Count how many times the loop runs before n reaches the limit.',
    ['n doubles each pass: 1, 2, 4, 8 … Track n and count.', `n must reach ${limit} or more; that takes ${count} doublings.`],
    `<strong>Output: ${count}.</strong> n doubles each pass (1 → 2 → 4 …) and count rises each time. After ${count} passes n ≥ ${limit}, so the loop stops with count = ${count}.`,
    `A savings pot doubles every week — this code counts how many weeks until it reaches £${limit}.`);
}
function codeArrayIndex() {
  const len = randInt(3, 5);
  const arr = []; for (let i = 0; i < len; i++) arr.push(randInt(1, 30));
  const idx = randInt(0, len - 1);
  const lit = `[${arr.join(', ')}]`;
  return traceQ({ AQA: `nums ← ${lit}\nOUTPUT nums[${idx}]`, OCR: `nums = ${lit}\nprint(nums[${idx}])`, Eduqas: `nums = ${lit}\nprint(nums[${idx}])` },
    arr[idx], 'Array indexes start at 0.',
    [`Count positions from 0: nums[0] = ${arr[0]}, nums[1] = ${arr[1]} …`, `nums[${idx}] is position ${idx}.`],
    `<strong>Output: ${arr[idx]}.</strong> Indexes start at 0, so nums[${idx}] = ${arr[idx]}.`,
    `A playlist stores its track lengths in an array — the app is reading the track at position ${idx}.`);
}

// ============================================================
// DATA REPRESENTATION DEPTH — binary arithmetic + data units
// ============================================================
function binaryAdd(opts) {
  const bits = (opts && opts.bits) || 4;                          // opts.bits: 8 for exam-level addition
  const hi = (1 << bits) - 1;
  const lo = Math.max(2, hi >> 3);
  // AQA assesses adding up to THREE binary numbers; OCR/Edexcel/Eduqas only two.
  const three = getBoard() === 'AQA' && bits === 8 && !(opts && opts.two);
  if (three) {
    const a = randInt(lo, hi - 2 * lo);
    const b = randInt(lo, hi - a - lo);
    const c = randInt(lo, hi - a - b);                            // a + b + c <= hi → clean 8-bit result, no overflow
    const sum = a + b + c;
    const aArr = toBitsMSB(a, bits), bArr = toBitsMSB(b, bits), cArr = toBitsMSB(c, bits);
    return {
      type: 'BINADD', badge: 'BINARY ADD ×3', board: 'AQA', enforceCarry: true,
      a: aArr, b: bArr, c: cArr,
      title: `AQA: add these THREE ${bits}-bit binary numbers`,
      desc: 'Fill the carry row and the sum. Three 1s in a column write 1 and carry 1 — with a carry in, a column can even carry 2.',
      hints: ['Work right to left: 1 + 1 + 1 = 11 (write 1, carry 1). With a carried-in 1 a column can total 4 → write 0, carry 2.', `${a} + ${b} + ${c} = ${sum} = ${toBitsMSB(sum, bits).join('')}.`],
      explain: `<strong>${aArr.join('')} + ${bArr.join('')} + ${cArr.join('')} = ${toBitsMSB(sum, bits).join('')}.</strong> In denary that is ${a} + ${b} + ${c} = ${sum}. Add each column right-to-left; three 1s make 11 (write 1, carry 1).`,
    };
  }
  const a = randInt(lo, hi - lo);
  const b = randInt(lo, hi - a);                                  // a + b <= hi → clean fixed-width result, no overflow
  const sum = a + b;
  const aArr = toBitsMSB(a, bits), bArr = toBitsMSB(b, bits);
  return {
    // carry-row addition canvas: fill the carries AND toggle the result.
    type: 'BINADD', badge: 'BINARY ADD', board: 'AQA · OCR · Eduqas', enforceCarry: true,
    a: aArr, b: bArr,
    title: `Add these ${bits}-bit binary numbers`,
    desc: 'Fill the carry row and the sum, working column by column from the right.',
    hints: ['Work right to left; carry a 1 whenever a column totals 2 (10) or 3 (11).', `${aArr.join('')} (${a}) + ${bArr.join('')} (${b}) = ${sum} = ${toBitsMSB(sum, bits).join('')}.`],
    explain: `<strong>${aArr.join('')} + ${bArr.join('')} = ${toBitsMSB(sum, bits).join('')}.</strong> In denary that is ${a} + ${b} = ${sum}. Add each column right-to-left, carrying a 1 whenever a column totals 2 or more.`,
  };
}
function binaryShift() {
  const bits = 8;
  const dir = Math.random() < 0.5 ? 'left' : 'right';
  const amount = randInt(1, 2);
  const value = (dir === 'left') ? randInt(1, 1 << (bits - amount - 1)) : randInt(1 << (amount + 1), 200);
  const arr = toBitsMSB(value & 0xFF, bits);
  const result = (dir === 'left') ? (value << amount) & 0xFF : (value >> amount);
  const factor = 1 << amount;
  const pl = amount > 1 ? 's' : '';
  const effect = (dir === 'left') ? `multiplies the value by ${factor}` : `divides the value by ${factor} (keeping the whole-number part)`;
  // Stage-2 concept question: what did the shift DO to the number? Correct
  // option first (the SHIFT module shuffles); distractors are real mistakes —
  // the opposite operation, confusing the shift COUNT with the factor, and
  // treating a shift as an add/subtract.
  const wrongFactor = amount === 1 ? 4 : 2;
  const conceptOptions = (dir === 'left')
    ? [`Multiplied it by ${factor}`, `Divided it by ${factor}`, `Multiplied it by ${wrongFactor}`, `Added ${amount} to it`]
    : [`Divided it by ${factor}`, `Multiplied it by ${factor}`, `Divided it by ${wrongFactor}`, `Subtracted ${amount} from it`];
  return {
    // animated shift: press SHIFT, watch the bits slide and the value change.
    type: 'SHIFT', badge: 'BINARY SHIFT', board: 'AQA · OCR · Eduqas',
    bits: arr, dir, amount,
    title: `Shift the 8-bit binary number ${dir.toUpperCase()} by ${amount} place${pl}`,
    desc: `Press SHIFT ${dir === 'left' ? '◀' : '▶'} ${amount} time${pl} and confirm, then say what the shift did to the value.`,
    concept: {
      prompt: `What did shifting ${dir} by ${amount} place${pl} do to the original number?`,
      options: conceptOptions,
      answer: conceptOptions[0],
    },
    hints: [`Move every bit ${amount} place${pl} to the ${dir}, filling the gaps with 0.`, `A ${dir} shift by ${amount} ${effect}: ${value} → ${result}.`],
    explain: `<strong>A ${dir} shift by ${amount} ${effect}: ${value} → ${result}.</strong> Every bit moves ${amount} place${pl} to the ${dir} (gaps filled with 0). That is why a ${dir} shift is a fast way to ${dir === 'left' ? 'multiply' : 'divide'} by ${factor}.`,
  };
}
// 8-bit binary subtraction via two's complement (a harder, exam-level skill).
// A > B is forced so the result is a positive 8-bit value.
function binarySub(opts, context) {
  const bits = 8;
  const a = randInt(20, 200), b = randInt(5, a - 1);             // a > b → non-negative result
  const diff = a - b;
  const aArr = toBitsMSB(a, bits), bArr = toBitsMSB(b, bits), ansArr = toBitsMSB(diff, bits);
  const twoC = toBitsMSB((256 - b) & 255, bits).join('');
  const base = {
    badge: 'BINARY SUB', board: 'AQA · OCR',
    title: `Using two's complement, work out ${aArr.join('')} − ${bArr.join('')}.`,
    hints: [
      `Two's complement of ${bArr.join('')}: flip every bit, then add 1 → ${twoC}.`,
      `${aArr.join('')} (${a}) − ${bArr.join('')} (${b}) = ${diff} = ${ansArr.join('')} in binary.`,
    ],
    explain: `<strong>${aArr.join('')} − ${bArr.join('')} = ${ansArr.join('')}.</strong> In denary: ${a} − ${b} = ${diff}. Method: two's complement of ${bArr.join('')} is ${twoC}; add it to ${aArr.join('')} and discard the carry out of bit 8.`,
  };
  // assessment: bit-toggle the result yourself. practice: full multi-step (negate B, add, discard carry).
  if (ASSESS(context)) return { ...base, type: 'BINARY', desc: 'Toggle the bits to give the result of the subtraction.', bits, answer: ansArr };
  return { ...base, type: 'BINSUB', desc: 'Negate B (flip + 1), then add A + (−B).', a: aArr, b: bArr };
}
function unitsConvert() {
  // WJEC uses the binary convention (×1024 per step); the other boards use decimal (×1000).
  const bin = getBoard() === 'WJEC';
  const step = bin ? 1024 : 1000;
  const kinds = [
    () => ({ q: 'How many bits are there in one byte?', a: 8 }),
    () => ({ q: 'How many bits are there in one nibble?', a: 4 }),
    () => { const n = randInt(2, 8); return { q: `How many bits are there in ${n} bytes?`, a: n * 8 }; },
    () => { const n = randInt(2, 9); return { q: `How many bytes are there in ${n} kB?`, a: n * step }; },
    () => { const n = randInt(2, 9); return { q: `How many kB are there in ${n} MB?`, a: n * step }; },
    () => { const n = randInt(2, 6); return { q: `How many MB are there in ${n} GB?`, a: n * step }; },
  ];
  const k = kinds[randInt(0, kinds.length - 1)]();
  return {
    // a single unit conversion — the number pad is the natural input.
    type: 'NUMBER', badge: 'DATA UNITS', board: bin ? 'WJEC' : 'AQA · OCR · Eduqas',
    title: k.q,
    desc: bin
      ? 'WJEC convention: 1 byte = 8 bits, and 1 kB = 1024 B, 1 MB = 1024 kB, 1 GB = 1024 MB.'
      : 'GCSE convention: 1 byte = 8 bits, and 1 kB = 1000 B, 1 MB = 1000 kB, 1 GB = 1000 MB.',
    answer: k.a,
    hints: [`1 nibble = 4 bits, 1 byte = 8 bits; each step up (kB → MB → GB) is ×${step}.`, `The answer is ${k.a}.`],
    explain: bin
      ? `<strong>${k.a}.</strong> 1 byte = 8 bits, 1 nibble = 4 bits, and on WJEC each unit step up (kB, MB, GB, TB) multiplies by <strong>1024</strong> (the binary convention: 1024 = 2¹⁰).`
      : `<strong>${k.a}.</strong> 1 byte = 8 bits, 1 nibble = 4 bits, and each unit step up (kB, MB, GB, TB) multiplies by 1000 on your board (WJEC is the exception, which uses 1024).`,
  };
}
function soundFileSize(opts, context) {
  const rate = [100, 200, 500, 1000][randInt(0, 3)];
  const depth = [8, 16][randInt(0, 1)];
  const seconds = randInt(2, 8);
  const bits = rate * depth * seconds;
  const base = {
    badge: 'SOUND', board: 'AQA · OCR · Eduqas',
    title: `A sound is sampled ${rate} times per second at ${depth}-bit, for ${seconds} seconds. What is the file size in bits?`,
    hints: ['Multiply the three numbers: sample rate × bit depth × seconds.', `${rate} × ${depth} × ${seconds} = ${bits} bits.`],
    explain: `<strong>${rate} × ${depth} × ${seconds} = ${bits} bits.</strong> Sound file size = sample rate × bit depth × duration. (To convert to bytes, divide by 8 = ${bits / 8} bytes.)`,
  };
  // assessment: plain typed number. practice: guided rate × depth × seconds.
  if (ASSESS(context)) return { ...base, type: 'NUMBER', desc: 'Sound size (bits) = sample rate × bit depth × duration.', unit: 'bits', answer: bits };
  return {
    ...base, type: 'CALC', desc: 'Sound size = sample rate × bit depth × duration (seconds).',
    formula: 'size (bits) = sample rate × bit depth × duration',
    steps: [
      { expr: `${rate} × ${depth}`, answer: rate * depth },
      { expr: `{prev} × ${seconds}`, answer: bits, unit: 'bits' },
    ],
  };
}

// ============================================================
// BOOLEAN LOGIC DEPTH — truth-table completion for gates + expressions
// ============================================================
function boolColFallback() {
  return () => { const s = []; for (let i = 0; i < 4; i++) s.push(Math.random() < 0.5 ? '1' : '0'); return s.join(', '); };
}
function boolTable() {
  const exprs = {
    'A AND B': (a, b) => (a && b) ? 1 : 0,
    'A OR B': (a, b) => (a || b) ? 1 : 0,
    'A XOR B': (a, b) => (a ^ b),
    'NOT (A AND B)': (a, b) => (a && b) ? 0 : 1,
    'NOT (A OR B)': (a, b) => (a || b) ? 0 : 1,
    'A AND (NOT B)': (a, b) => (a && !b) ? 1 : 0,
    'A OR (NOT B)': (a, b) => (a || !b) ? 1 : 0,
  };
  const keys = Object.keys(exprs);
  const expr = keys[randInt(0, keys.length - 1)];
  const rows = [[0, 0], [0, 1], [1, 0], [1, 1]];
  const fmt = fn => rows.map(([a, b]) => fn(a, b)).join(', ');
  const answerArr = rows.map(([a, b]) => exprs[expr](a, b));
  return {
    // interactive truth-table fill: toggle Q for each input row.
    type: 'TRUTHTABLE', badge: 'TRUTH TABLE', board: 'AQA · OCR · Eduqas',
    inputs: ['A', 'B'], rows, answer: answerArr,
    title: `Complete the truth table for Q = ${expr}.`,
    desc: 'Set Q (0 or 1) for each input row in turn.',
    hints: [`Apply "${expr}" to each input row in turn.`, 'Work out Q for A=0/B=0, then 0/1, then 1/0, then 1/1.'],
    explain: `<strong>Q = ${expr} → ${answerArr.join(', ')}.</strong> Evaluate the expression for each row (0,0)(0,1)(1,0)(1,1). Reminder: AND = 1 only if both are 1, OR = 1 if at least one is 1, XOR = 1 if the inputs differ, and NOT inverts.`,
  };
}

const GENERATORS = {
  binaryToDenary, denaryToBinary, bitsValues,
  hexToDenary, denaryToHex, binaryToHex, hexToBinary, addToHex,
  logicGate, boolTable,
  twosToDenary, twosNegate,
  caesarLetter, caesarDecode,
  bubbleResult, bubblePass,
  fileSizeImage,
  binaryAdd, binaryShift, binarySub, unitsConvert, soundFileSize,
  codeArith, codeModDiv, codeForSum, codeWhileCount, codeArrayIndex,
};

export function generateQuestion(genId, opts, context) {
  const fn = GENERATORS[genId];
  if (!fn) throw new Error('unknown generator: ' + genId);
  return fn(opts || {}, context);
}
export { GENERATORS };
