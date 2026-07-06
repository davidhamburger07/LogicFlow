// ============================================================
// questions/signbuild.js — SIGNBUILD: build a signed (two's complement) byte
// by the PLACE-VALUE method — the second encoding method the spec teaches
// (the other being flip + add 1, handled by FLIPADD).
//
// The student toggles bits on a grid whose leftmost column is −128. A live
// signed running total (e.g. "−128 + 16 + 8 + 4 = −100") updates as they go,
// so they SEE the negative column being clawed back up to the target. Forgiving
// — CHECK only completes when the running total equals the target.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(true) when it matches
//
// Question schema:
//   { type:'SIGNBUILD', target:-100, bits?:8, badge, board, title, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const signbuild = {
  type: 'SIGNBUILD',

  render(host, question, ctx) {
    host.innerHTML = '';
    const n = question.bits || 8;
    const target = question.target;
    const placeOf = i => { const p = 1 << (n - 1 - i); return i === 0 ? -p : p; };   // signed: MSB is negative
    const user = new Array(n).fill(0);

    const wrap = el('sb'); wrap.dataset.target = String(target);
    const tgt = el('sb-target'); tgt.innerHTML = `TARGET&nbsp;&nbsp;<b>${target > 0 ? '+' : ''}${target}</b>`;
    wrap.appendChild(tgt);

    const grid = el('sb-grid');
    const cells = [];
    for (let i = 0; i < n; i++) {
      const col = el('sb-col');
      const place = el('sb-place' + (placeOf(i) < 0 ? ' sb-neg' : '')); place.textContent = placeOf(i);
      const bit = el('sb-bit' + (placeOf(i) < 0 ? ' sb-negbit' : ''), 'button'); bit.type = 'button'; bit.textContent = '0'; bit.dataset.col = String(i);
      bit.addEventListener('click', () => {
        if (ctx.isAnswered()) return;
        user[i] ^= 1; bit.textContent = String(user[i]); bit.classList.toggle('on', !!user[i]);
        (ctx.sfx.bitClick || ctx.sfx.uiClick)(); paint();
      });
      col.append(place, bit); grid.appendChild(col); cells.push(bit);
    }
    wrap.appendChild(grid);

    const totalLine = el('sb-total'); wrap.appendChild(totalLine);
    const fb = el('sb-fb'); wrap.appendChild(fb);
    const submit = el('sb-submit', 'button'); submit.type = 'button'; submit.textContent = 'CHECK →';
    wrap.appendChild(submit);
    host.appendChild(wrap);

    const value = () => user.reduce((s, b, i) => s + (b ? placeOf(i) : 0), 0);
    function paint() {
      const v = value();
      const lit = user.map((b, i) => (b ? placeOf(i) : null)).filter(x => x !== null);
      const expr = lit.length ? lit.join(' + ').replace(/\+ -/g, '− ') : '0';
      const match = v === target;
      totalLine.innerHTML = `<span class="sb-work">${expr} = <b>${v}</b></span>` + (match ? ' <span class="sb-match">✓ matches</span>' : '');
      submit.classList.toggle('sb-ready', match);
      if (match) { fb.className = 'sb-fb'; fb.textContent = ''; }
    }
    paint();

    submit.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      const v = value();
      if (v === target) {
        cells.forEach(c => { c.disabled = true; }); submit.disabled = true;
        ctx.sfx.zap(); ctx.onSubmit(true);
      } else {
        fb.className = 'sb-fb sb-no';
        fb.textContent = target < 0
          ? `Not yet — you're at ${v}, aim for ${target}. Switch on −128 first, then add positive columns to climb up to the target.`
          : `Not yet — you're at ${v}, aim for ${target}. Add positive columns until the total matches.`;
        wrap.classList.remove('sb-shake'); void wrap.offsetWidth; wrap.classList.add('sb-shake');
        ctx.sfx.wrong();
      }
    });
  },
};
