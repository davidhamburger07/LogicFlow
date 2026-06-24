// ============================================================
// questions/codeview.js — shared code rendering for the programming
// question types (CODE_TRACE, CODE_FILL, …).
//
//   - a syntax-highlighted code panel with line numbers
//   - per-board notation resolution (a field may be a plain string/array,
//     or a { AQA, OCR, Eduqas } map — the player's board picks the variant)
//   - a blank slot (the ▢ marker) for "complete the code" questions
// ============================================================

import { getBoard } from '../storage.js';

export { getBoard };

export const NOTATION = { AQA: 'AQA pseudo-code', OCR: 'OCR reference language', Eduqas: 'Python (Eduqas)', WJEC: 'Python (WJEC)' };

const KEYWORDS = new Set([
  'IF', 'THEN', 'ELSE', 'ELSEIF', 'ELIF', 'ENDIF', 'WHILE', 'ENDWHILE', 'FOR', 'TO', 'STEP', 'NEXT', 'ENDFOR',
  'IN', 'RANGE', 'REPEAT', 'UNTIL', 'DO', 'OUTPUT', 'INPUT', 'USERINPUT', 'PRINT', 'LEN', 'MOD', 'DIV',
  'AND', 'OR', 'NOT', 'TRUE', 'FALSE', 'SUBROUTINE', 'ENDSUBROUTINE', 'RETURN', 'CONSTANT', 'RECORD',
]);

export function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// light, theme-independent syntax highlight (one line of pseudo-code)
export function highlight(line) {
  let out = '';
  const re = /(#.*)|('[^']*'|"[^"]*")|(\b\d+\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\s])/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m[1]) out += `<span class="code-comment">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="code-str">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="code-num">${m[3]}</span>`;
    else if (m[4]) out += KEYWORDS.has(m[4].toUpperCase()) ? `<span class="code-kw">${esc(m[4])}</span>` : esc(m[4]);
    else if (m[5]) out += m[5];
    else if (m[6] === '▢') out += '<span class="code-blank">▢</span>';
    else out += esc(m[6]);
  }
  return out;
}

export function codePanel(code) {
  const panel = document.createElement('div');
  panel.className = 'code-panel';
  const lines = String(code).replace(/\r/g, '').replace(/\t/g, '  ').split('\n');
  panel.innerHTML = lines.map((ln, i) =>
    `<div class="code-line"><span class="code-ln">${i + 1}</span><span class="code-src">${highlight(ln) || ' '}</span></div>`).join('');
  return panel;
}

// resolve a value that may be board-agnostic (string / array) or a
// { AQA, OCR, Eduqas } map, for the player's current board.
export function forBoard(val, board = getBoard()) {
  if (val == null) return val;
  if (typeof val !== 'object' || Array.isArray(val)) return val;   // primitives + arrays are board-agnostic
  // a { AQA, OCR, Eduqas } map is per-board; WJEC uses the same Python as Eduqas
  return val[board] || (board === 'WJEC' && val.Eduqas) || val.AQA || Object.values(val)[0];
}

// a small caption naming the notation — only when the code is board-specific
export function notationCaption(question) {
  if (typeof question.code === 'string') return null;
  const cap = document.createElement('div');
  cap.className = 'code-notation';
  cap.textContent = NOTATION[getBoard()] || getBoard();
  return cap;
}
