// ============================================================
// questions/flipadd.js — FLIPADD: two's-complement negation, guided.
//
// The method as two clear, understandable moves:
//   STEP 1 — FLIP every bit (one's complement / NOT). The player can toggle
//            FLIP ↔ UNFLIP freely to SEE exactly what changed (each 0↔1),
//            with a before→after compare line, before committing.
//   STEP 2 — ADD 1 to the flipped value on the carry-row canvas (BINADD,
//            reused), which yields the two's-complement representation.
//
// Composes the BINADD canvas: when the +1 addition is completed correctly,
// BINADD's onSubmit is the FLIPADD answer.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'FLIPADD', pos:[0,0,0,1,0,1,0,0],   // +v in MSB-first bits
//     badge, board, title, desc, hints, explain }
// ============================================================

import { binadd } from './binadd.js';

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const flipadd = {
  type: 'FLIPADD',

  render(host, question, ctx) {
    host.innerHTML = '';
    const pos = question.pos.slice();          // the original (positive) bits
    const n = pos.length;
    const flippedBits = pos.map(b => 1 - b);   // one's complement
    let isFlipped = false, committed = false;

    const wrap = el('fa');

    const step1 = el('fa-step');
    if (!question.embedded) step1.appendChild(el('fa-step-label')).textContent = 'STEP 1 — flip every bit';
    step1.appendChild(el('fa-explain')).innerHTML = 'Flipping inverts <b>every</b> bit — each <b>0 → 1</b> and each <b>1 → 0</b>. That is the <b>NOT</b> operation (the "one’s complement"). Adding 1 to it next gives the two’s complement. Use UNFLIP to compare.';

    const bitRow = el('fa-bits');
    const cells = pos.map(b => { const c = el('fa-bit' + (b ? ' on' : '')); c.textContent = String(b); bitRow.appendChild(c); return c; });
    step1.appendChild(bitRow);

    const compare = el('fa-compare');
    compare.style.visibility = 'hidden';
    compare.innerHTML = `<span class="fa-cmp-lbl">original</span><span class="fa-cmp-bin">${pos.join('')}</span>`
      + `<span class="fa-cmp-arrow">→ flipped</span><span class="fa-cmp-bin fa-cmp-flip">${flippedBits.join('')}</span>`;
    step1.appendChild(compare);

    const btnRow = el('fa-btnrow');
    const flipBtn = el('fa-flip', 'button'); flipBtn.type = 'button'; flipBtn.textContent = '⇄ FLIP ALL BITS';
    const addBtn = el('fa-add1', 'button'); addBtn.type = 'button'; addBtn.textContent = 'NEXT: ADD 1 →'; addBtn.disabled = true;
    btnRow.append(flipBtn, addBtn);
    step1.appendChild(btnRow);
    wrap.appendChild(step1);

    const step2 = el('fa-step');
    step2.style.display = 'none';
    if (!question.embedded) step2.appendChild(el('fa-step-label')).textContent = 'STEP 2 — add 1';
    const addHost = el('fa-addhost');
    step2.appendChild(addHost);
    wrap.appendChild(step2);
    host.appendChild(wrap);

    function setBits(arr, animate) {
      cells.forEach((c, i) => {
        if (animate) { c.classList.add('flipping'); setTimeout(() => { c.textContent = String(arr[i]); c.classList.toggle('on', !!arr[i]); c.classList.remove('flipping'); }, 110); }
        else { c.textContent = String(arr[i]); c.classList.toggle('on', !!arr[i]); }
      });
    }

    // FLIP <-> UNFLIP: free to toggle so the player can SEE what changed
    flipBtn.addEventListener('click', () => {
      if (committed) return;
      isFlipped = !isFlipped;
      setBits(isFlipped ? flippedBits : pos, true);
      (ctx.sfx.bitClick || ctx.sfx.uiClick)();
      flipBtn.textContent = isFlipped ? '↩ UNFLIP (compare)' : '⇄ FLIP ALL BITS';
      compare.style.visibility = isFlipped ? 'visible' : 'hidden';
      addBtn.disabled = !isFlipped;            // can only proceed once flipped
    });

    // commit to the flipped value and reveal the +1 step
    addBtn.addEventListener('click', () => {
      if (committed || !isFlipped) return;
      committed = true;
      flipBtn.disabled = true; addBtn.disabled = true;
      step2.style.display = 'flex';
      const one = new Array(n).fill(0); one[n - 1] = 1;
      binadd.render(addHost, { type: 'BINADD', a: flippedBits.slice(), b: one }, ctx);   // result = two's complement
    });
  },
};
