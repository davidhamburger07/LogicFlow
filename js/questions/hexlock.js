// ============================================================
// questions/hexlock.js — HEXLOCK: a "data decryption" lock.
//
// A locked terminal shows a long binary key; the player decrypts it to
// hexadecimal to unlock it — splitting the binary into 4-bit nibbles and
// choosing the hex digit for each. (This is binary -> hex via the nibble
// method, in a hacking/decryption skin.) DECRYPT with the right hex unlocks;
// a wrong guess fails (first wrong) with the correct code revealed.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema (bits length must be a multiple of 4):
//   { type:'HEXLOCK', bits:[1,1,0,0, 0,0,1,1, ...],
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
const HEX = '0123456789ABCDEF';

export const hexlock = {
  type: 'HEXLOCK',

  render(host, question, ctx) {
    host.innerHTML = '';
    const bits = question.bits.slice();
    const nibbles = [];
    for (let i = 0; i < bits.length; i += 4) nibbles.push(bits.slice(i, i + 4));
    const correct = nibbles.map(nb => nb.reduce((v, b) => v * 2 + b, 0));   // 0–15 per nibble
    let done = false;

    const wrap = el('hl');

    const term = el('hl-term');
    term.innerHTML = '<span class="hl-lock">🔒</span><span class="hl-title">LOCKED TERMINAL</span><span class="hl-sub">decrypt the binary key to hex to unlock</span>';
    wrap.appendChild(term);

    const row = el('hl-nibbles');
    const selects = nibbles.map(nb => {
      const col = el('hl-nibble');
      col.appendChild(el('hl-bits')).textContent = nb.join('');
      const sel = document.createElement('select'); sel.className = 'hl-sel';
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = '?'; sel.appendChild(blank);
      for (let h = 0; h < 16; h++) { const o = document.createElement('option'); o.value = String(h); o.textContent = HEX[h]; sel.appendChild(o); }
      sel.addEventListener('change', () => { if (done) return; (ctx.sfx.uiClick || ctx.sfx.bitClick)(); paint(); });
      col.appendChild(sel);
      row.appendChild(col);
      return sel;
    });
    wrap.appendChild(row);

    const readout = el('hl-readout');
    wrap.appendChild(readout);

    const btn = el('hl-decrypt', 'button');
    btn.type = 'button'; btn.textContent = '⚡ DECRYPT';
    btn.addEventListener('click', fire);
    wrap.appendChild(btn);
    host.appendChild(wrap);

    function paint() {
      const hex = selects.map(s => s.value === '' ? '·' : HEX[Number(s.value)]).join('');
      readout.innerHTML = `DECRYPTED → <b>${hex}</b>`;
    }
    paint();

    function fire() {
      if (done) return;
      const picked = selects.map(s => s.value === '' ? -1 : Number(s.value));
      if (picked.some(p => p < 0)) { readout.classList.remove('hl-shake'); void readout.offsetWidth; readout.classList.add('hl-shake'); return; }
      done = true;
      const ok = picked.every((p, i) => p === correct[i]);
      selects.forEach(s => { s.disabled = true; }); btn.disabled = true;
      if (ok) {
        term.querySelector('.hl-lock').textContent = '🔓';
        term.querySelector('.hl-title').textContent = 'UNLOCKED';
        term.classList.add('hl-open');
        ctx.sfx.zap(); ctx.onSubmit(true);
      } else {
        const want = correct.map(c => HEX[c]).join('');
        ctx.sfx.wrong();
        ctx.onSubmit(false, { feedbackOnWrong: `Access denied — the key decrypts to ${want}. Each 4-bit nibble is one hex digit (1100 = C, 0011 = 3 …).` });
      }
    }
  },
};
