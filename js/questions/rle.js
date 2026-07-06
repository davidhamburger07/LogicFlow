// ============================================================
// questions/rle.js — RLE: the Run-Length Encoding puzzle.
//
// The lossless-compression algorithm Edexcel/OCR test directly. The player is
// shown a scanline of coloured pixels and must ENCODE it as Run-Length
// Encoding — count + value pairs (e.g. RRRRGG → 4R2G). A live "DECODES TO"
// row reconstructs their encoding so they can see it rebuild (or fail to
// rebuild) the original, and a stat shows the compression. CHECK passes only
// when it decodes to the exact original AND uses one pair per run (minimal).
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'RLE', pixels:'RRRRGGGGGGRRBBB',
//     palette:{ R:'#ef4444', G:'#22c55e', B:'#3b82f6' },
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

function canonical(px) {
  let out = '', i = 0;
  while (i < px.length) { let j = i; while (j < px.length && px[j] === px[i]) j++; out += (j - i) + px[i]; i = j; }
  return out;
}
function parseRLE(str) {
  const pairs = []; const re = /(\d+)\s*([A-Za-z])/g; let m;
  while ((m = re.exec(str)) !== null) pairs.push([Number(m[1]), m[2].toUpperCase()]);
  return pairs;
}
function decode(pairs) { return pairs.map(([n, v]) => v.repeat(Math.max(0, Math.min(n, 200)))).join('').slice(0, 400); }

export const rle = {
  type: 'RLE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const pixels = String(question.pixels || '').toUpperCase();
    const palette = question.palette || {};
    const answer = canonical(pixels);
    let done = false;

    const wrap = el('rle');
    wrap.dataset.answer = answer;   // harness / a11y hook: the canonical RLE

    // ORIGINAL scanline
    wrap.appendChild(el('rle-lbl')).textContent = 'ORIGINAL — ' + pixels.length + ' pixels';
    const orig = el('rle-row');
    [...pixels].forEach(ch => { const c = el('rle-cell'); c.style.background = palette[ch] || '#cbd5e1'; c.textContent = ch; orig.appendChild(c); });
    wrap.appendChild(orig);

    // input
    const inRow = el('rle-inrow');
    inRow.appendChild(el('rle-lbl')).textContent = 'YOUR RLE — type count + colour pairs (e.g. 4R6G…)';
    const input = el('rle-input', 'input');
    input.type = 'text'; input.autocomplete = 'off'; input.spellcheck = false; input.placeholder = 'e.g. 4R6G2R3B';
    inRow.appendChild(input);
    wrap.appendChild(inRow);

    // live decode preview
    wrap.appendChild(el('rle-lbl')).textContent = 'DECODES TO';
    const preview = el('rle-row rle-preview'); wrap.appendChild(preview);
    const stats = el('rle-stats'); wrap.appendChild(stats);

    const check = el('rle-check', 'button'); check.type = 'button'; check.textContent = 'CHECK →'; wrap.appendChild(check);
    const fb = el('rle-fb'); wrap.appendChild(fb);
    host.appendChild(wrap);

    function renderPreview() {
      const pairs = parseRLE(input.value);
      const decoded = decode(pairs);
      preview.innerHTML = '';
      const n = Math.max(decoded.length, pixels.length);
      if (!decoded.length) { preview.appendChild(el('rle-empty')).textContent = '(nothing yet)'; }
      else {
        for (let i = 0; i < n; i++) {
          const v = decoded[i];
          const c = el('rle-cell');
          if (v == null) { c.classList.add('rle-gap'); }
          else { c.style.background = palette[v] || '#cbd5e1'; c.textContent = v; if (i >= pixels.length || v !== pixels[i]) c.classList.add('rle-wrong'); }
          preview.appendChild(c);
        }
      }
      const runs = pairs.length, units = runs * 2;
      stats.innerHTML = `Original: <b>${pixels.length}</b> units&nbsp; ·&nbsp; Your RLE: <b>${runs}</b> run${runs === 1 ? '' : 's'} = <b>${units}</b> units` + (runs && units < pixels.length ? ` <span class="rle-save">(saves ${pixels.length - units})</span>` : '');
    }
    input.addEventListener('input', () => { if (done) return; renderPreview(); });
    renderPreview();

    check.addEventListener('click', () => {
      if (done) return;
      const pairs = parseRLE(input.value);
      const decoded = decode(pairs);
      const matches = decoded === pixels;
      const minimal = pairs.length > 0 && pairs.every(([n]) => n >= 1) && pairs.every(([, v], i) => i === 0 || v !== pairs[i - 1][1]);
      if (matches && minimal) {
        done = true; input.disabled = true; check.disabled = true;
        fb.className = 'rle-fb rle-fb-ok';
        fb.innerHTML = `✓ <b>COMPRESSED</b> — ${pixels.length} pixels → ${pairs.length * 2} units (${pairs.length} count+value pairs). It decodes back <b>perfectly</b>, so RLE is <b>lossless</b>.`;
        ctx.sfx.zap(); ctx.onSubmit(true);
        return;
      }
      ctx.sfx.wrong();
      fb.className = 'rle-fb rle-fb-no';
      if (!pairs.length) fb.textContent = 'Type the runs as count+colour pairs, e.g. 4R for four reds.';
      else if (decoded.length !== pixels.length) fb.textContent = `Your RLE decodes to ${decoded.length} pixels, but the original has ${pixels.length}. Re-count the runs.`;
      else if (!matches) fb.textContent = 'It decodes to the wrong pattern — check each run\'s colour and count against the original.';
      else fb.textContent = 'You\'ve split a run — RLE uses ONE count+value pair per run of identical pixels. Merge the adjacent same-colour pairs.';
    });
  },
};
