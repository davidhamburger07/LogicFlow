// ============================================================
// questions/binsub.js — BINSUB: binary subtraction via two's complement.
//
// The exam method, end to end, as two composed stages:
//   STEP 1 — find the two's complement of B (flip + 1)  -> reuses FLIPADD
//   STEP 2 — add A + (-B) on the carry-row canvas        -> reuses BINADD
//            (the carry out of the top bit is simply discarded — it's not
//             one of the 8 result cells, so the 8-bit result is A - B).
//
// Stage 1 runs FLIPADD with a PROXY ctx: completing B's negation reveals
// stage 2; stage 2's BINADD uses the real ctx, so its result is the answer.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema (A > B so the result is non-negative):
//   { type:'BINSUB', a:[..8 bits..], b:[..8 bits..],
//     badge, board, title, desc, hints, explain }
// ============================================================

import { flipadd } from './flipadd.js';
import { binadd } from './binadd.js';

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function toVal(bits) { return bits.reduce((v, b) => v * 2 + b, 0); }
function toBits(v, n) { const a = []; for (let i = n - 1; i >= 0; i--) a.push((v >> i) & 1); return a; }

export const binsub = {
  type: 'BINSUB',

  render(host, question, ctx) {
    host.innerHTML = '';
    const A = question.a.slice();
    const B = question.b.slice();
    const n = A.length;
    const negB = toBits((((1 << n) - toVal(B)) & ((1 << n) - 1)) >>> 0, n);   // -B pattern (n-bit)

    const wrap = el('su');
    const head = el('su-head');
    head.textContent = `${A.join('')} − ${B.join('')}`;
    wrap.appendChild(head);

    const s1 = el('su-stage');
    s1.appendChild(el('su-stage-label')).textContent = "STEP 1 — two's complement of B (flip + 1)";
    const s1host = el('su-host'); s1.appendChild(s1host); wrap.appendChild(s1);

    const s2 = el('su-stage'); s2.style.display = 'none';
    s2.appendChild(el('su-stage-label')).textContent = 'STEP 2 — add A + (−B), discard the carry out of bit ' + n;
    const s2host = el('su-host'); s2.appendChild(s2host); wrap.appendChild(s2);
    host.appendChild(wrap);

    let stage1done = false;
    const proxy1 = {
      sfx: ctx.sfx,
      isAnswered: () => ctx.isAnswered() || stage1done,
      onSubmit: (correct1) => {
        if (stage1done) return;
        stage1done = true;
        if (!correct1) {
          ctx.onSubmit(false, { feedbackOnWrong: `Start with the two's complement of B: ${negB.join('')}.` });
          return;
        }
        s2.style.display = 'flex';
        // enforce the carry row; hide overflow — the MSB carry is discarded in two's complement
        binadd.render(s2host, { type: 'BINADD', a: A.slice(), b: negB.slice(), enforceCarry: true, hideOverflow: true }, ctx);   // result = A - B
      },
    };

    flipadd.render(s1host, { type: 'FLIPADD', pos: B.slice(), embedded: true }, proxy1);
  },
};
