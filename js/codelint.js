// ============================================================
// codelint.js — friendly "compiler feedback" for the code lab.
//
// Three layers, all advisory (never block the student):
//   1. preflight(code, board)    — per-notation structural checks with
//      line-numbered, plain-English advice ("line 4 needs a colon").
//   2. friendlyError(err, code)  — translate a raw Skulpt/Python error
//      into advice a GCSE student can act on.
//   3. checkSteps(steps, code)   — tick off the question's step-by-step
//      success criteria against the code (regex per step, notation-loose).
//
// AQA pseudo-code and OCR ERL are not executable, so for those boards the
// terminal runs layers 1 + 3 only and says so honestly.
// ============================================================

const line = (n, msg, kind = 'warn') => ({ line: n, msg, kind });

// ---- layer 1: per-notation structural preflight ----
export function preflight(code, board) {
  const out = [];
  const lines = code.replace(/\r/g, '').split('\n');
  const px = board === 'AQA' ? pfAqa : board === 'OCR' ? pfOcr : pfPython;
  px(lines, out);
  // shared: unbalanced brackets across the whole program
  const open = (code.match(/\(/g) || []).length, close = (code.match(/\)/g) || []).length;
  if (open !== close) out.push(line(0, `your brackets don't balance — ${open} opening "(" vs ${close} closing ")"`));
  return out;
}

function pfPython(lines, out) {
  lines.forEach((raw, i) => {
    const t = raw.trim(); if (!t || t.startsWith('#')) return;
    const n = i + 1;
    if (/^(if|elif|else|while|for|def)\b/.test(t) && !/[:：]\s*(#.*)?$/.test(t))
      out.push(line(n, `line ${n}: this "${t.split(/[\s(]/)[0]}" line needs a colon ( : ) at the end`));
    if (/^(if|while|elif)\b/.test(t) && /[^=!<>]=[^=]/.test(t.replace(/[:：]\s*$/, '')) && !/==/.test(t))
      out.push(line(n, `line ${n}: use == to compare (a single = puts a value INTO a variable)`));
    if (/^print\s+[^(\s]/.test(t))
      out.push(line(n, `line ${n}: Python 3's print needs brackets — print(…)`));
    if (/\binput\s*\(/.test(t) && /[<>]=?\s*\d|[-+*/]\s*\d/.test(t) === false && /int\s*\(/.test(t) === false && /=\s*input/.test(t) && lines.some(l => /[<>]|[-+*\/]|==/.test(l) && new RegExp('\\b' + (t.split('=')[0] || '').trim() + '\\b').test(l)))
      out.push(line(n, `line ${n}: input() gives TEXT — wrap it as int(input()) if you'll do maths or comparisons with it`, 'hint'));
    // indentation after a colon line
    if (i > 0) {
      const prev = lines[i - 1].trim();
      if (/[:：]\s*(#.*)?$/.test(prev) && t && !/^\s/.test(raw) && !/^(else|elif|except)\b/.test(t) && prev !== t)
        out.push(line(n, `line ${n}: the line after a colon should be indented (2 or 4 spaces)`));
    }
  });
}

function pfAqa(lines, out) {
  const text = lines.join('\n');
  lines.forEach((raw, i) => {
    const t = raw.trim(); if (!t) return;
    const n = i + 1;
    if (/^IF\b/i.test(t) && !/\bTHEN\b/i.test(t))
      out.push(line(n, `line ${n}: AQA pseudo-code writes IF … THEN`));
    if (/^[a-zA-Z_]\w*\s*=(?!=)/.test(t) && !/[<>!]=/.test(t))
      out.push(line(n, `line ${n}: AQA uses ← for assignment (a ← 5); = is for comparing`, 'hint'));
  });
  [['IF', 'ENDIF'], ['WHILE', 'ENDWHILE'], ['FOR', 'ENDFOR']].forEach(([a, b]) => {
    const opens = (text.match(new RegExp('^\\s*' + a + '\\b', 'gmi')) || []).length;
    const closes = (text.match(new RegExp('^\\s*' + b + '\\b', 'gmi')) || []).length;
    if (opens > closes) out.push(line(0, `every ${a} needs a matching ${b} — you have ${opens} ${a} but ${closes} ${b}`));
  });
}

function pfOcr(lines, out) {
  const text = lines.join('\n');
  lines.forEach((raw, i) => {
    const t = raw.trim(); if (!t) return;
    const n = i + 1;
    if (/^if\b/i.test(t) && !/\bthen\b/i.test(t))
      out.push(line(n, `line ${n}: OCR reference language writes if … then`));
  });
  [['if', 'endif'], ['while', 'endwhile'], ['for', 'next']].forEach(([a, b]) => {
    const opens = (text.match(new RegExp('^\\s*' + a + '\\b', 'gmi')) || []).length;
    const closes = (text.match(new RegExp('^\\s*' + b + '\\b', 'gmi')) || []).length;
    if (opens > closes) out.push(line(0, `every ${a} needs a matching ${b} — you have ${opens} ${a} but ${closes} ${b}`));
  });
}

// ---- layer 2: translate a raw Python error into actionable advice ----
export function friendlyError(err, code) {
  const s = String(err || '');
  const m = s.match(/on line (\d+)/) || s.match(/line (\d+)/);
  const n = m ? Number(m[1]) : 0;
  const srcLine = n ? (code.split('\n')[n - 1] || '').trim() : '';
  if (/SyntaxError/i.test(s)) {
    if (/^(if|elif|else|while|for|def)\b/.test(srcLine) && !/:\s*$/.test(srcLine))
      return `line ${n}: syntax error — this "${srcLine.split(/[\s(]/)[0]}" line is missing its colon ( : ) at the end`;
    return `line ${n || '?'}: syntax error — Python couldn't read this line. Check for missing colons, brackets or quotes${srcLine ? ` in:  ${srcLine}` : ''}`;
  }
  if (/IndentationError/i.test(s)) return `line ${n || '?'}: indentation error — the lines inside an if/while/for must all be indented by the same amount`;
  const nameM = s.match(/NameError.*name '([^']+)'/);
  if (nameM) return `line ${n || '?'}: you used "${nameM[1]}" before creating it — check the spelling, or assign it a value first`;
  if (/TypeError/i.test(s) && /str|int/.test(s)) return `line ${n || '?'}: type mix-up — input() gives TEXT. Use int(input()) before comparing or doing maths with it`;
  if (/ZeroDivisionError/i.test(s)) return `line ${n || '?'}: your program divided by zero`;
  if (/TimeLimitError|execLimit|timed out/i.test(s)) return `your loop never stops — check that something inside the loop moves it towards the exit condition`;
  return s.replace(/\s*on line (\d+)/, ' (line $1)');
}

// ---- layer 3: tick the question's success criteria off against the code ----
// A step is { text, re } — re is a regex source string, tested case-insensitively
// against the whole program with whitespace collapsed. Steps without a re are
// shown as guidance only.
export function checkSteps(steps, code) {
  const flat = code.replace(/\s+/g, ' ');
  return (steps || []).map((s, i) => {
    if (!s.re) return { i, text: s.text || s, state: 'info' };
    let ok = false;
    try { ok = new RegExp(s.re, 'i').test(flat) || new RegExp(s.re, 'i').test(code); } catch (e) { ok = false; }
    return { i, text: s.text || s, state: ok ? 'ok' : 'todo' };
  });
}
