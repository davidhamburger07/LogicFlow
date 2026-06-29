// ============================================================
// questions/binbuild.js — BINBUILD: denary -> binary, taught step by step.
//
// A guided walkthrough (like the two's-complement one): work left to right
// through the place values, deciding at each whether it FITS into what's
// left, watching the remainder count down to 0. Wrong choices are corrected
// in place (it teaches, it doesn't punish); finishing builds the binary.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'BINBUILD', value:221, bits:8,
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const binbuild = {
  type: 'BINBUILD',

  render(host, question, ctx) {
    host.innerHTML = '';
    const value = question.value;
    const bits = question.bits || 8;
    const places = Array.from({ length: bits }, (_, i) => 1 << (bits - 1 - i));   // 128,64,…,1
    // the correct bit pattern (greedy subtraction)
    let r = value; const correct = places.map(p => { if (p <= r) { r -= p; return 1; } return 0; });

    let remaining = value, col = 0, done = false;

    const wrap = el('bb');
    const grid = el('bb-grid');
    const cells = places.map(p => {
      const c = el('bb-col');
      c.appendChild(el('bb-pv')).textContent = p;
      const cell = el('bb-cell'); cell.textContent = '?'; c.appendChild(cell);
      grid.appendChild(c);
      return cell;
    });
    wrap.appendChild(grid);

    const rem = el('bb-rem'); wrap.appendChild(rem);
    const prompt = el('bb-prompt'); wrap.appendChild(prompt);

    const btns = el('bb-btns');
    const yes = el('bb-yes', 'button'); yes.type = 'button'; yes.textContent = '✓ FITS → 1';
    const no = el('bb-no', 'button'); no.type = 'button'; no.textContent = '✗ TOO BIG → 0';
    btns.append(yes, no);
    wrap.appendChild(btns);
    const fb = el('bb-fb'); wrap.appendChild(fb);
    host.appendChild(wrap);

    function paint() {
      cells.forEach((c, i) => c.parentElement.classList.toggle('bb-current', i === col && !done));
      rem.innerHTML = `Converting <b>${value}</b> &nbsp;·&nbsp; remaining: <b>${remaining}</b>`;
      prompt.textContent = (!done && col < places.length) ? `Does ${places[col]} fit into ${remaining}?` : '';
    }
    paint();

    function decide(saidFits) {
      if (done) return;
      const p = places[col];
      const shouldFit = p <= remaining;
      if (saidFits !== shouldFit) {
        fb.textContent = shouldFit
          ? `${p} does fit — it's ≤ ${remaining}. Take it (subtract it).`
          : `${p} is bigger than ${remaining}, so it can't fit. Skip it.`;
        fb.className = 'bb-fb bb-wrong'; ctx.sfx.wrong();
        return;
      }
      fb.textContent = ''; fb.className = 'bb-fb';
      cells[col].textContent = shouldFit ? '1' : '0';
      cells[col].classList.toggle('bb-on', shouldFit);
      if (shouldFit) remaining -= p;
      (ctx.sfx.bitClick || ctx.sfx.uiClick)();
      col++;
      if (col >= places.length) {
        done = true; yes.disabled = true; no.disabled = true;
        cells.forEach(c => c.parentElement.classList.remove('bb-current'));
        prompt.innerHTML = `✓ <b>${value} = ${correct.join('')}</b>`;
        ctx.sfx.zap(); ctx.onSubmit(true);
      } else paint();
    }
    yes.addEventListener('click', () => decide(true));
    no.addEventListener('click', () => decide(false));
  },
};