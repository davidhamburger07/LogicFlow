// ============================================================
// questions/gateout.js — GATEOUT: read a gate diagram, give the output.
//
// The stepping stone between learning the gate rules and completing a
// full truth table: a live logic-gate DIAGRAM is shown with concrete
// input values (A=1, B=0 …), and the student answers what Q outputs —
// one evaluation at a time, over a series of rounds. A wrong answer is
// marked (and the right one shown) before moving on; the question is
// correct only if every round was answered right, so guessing doesn't pay.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema (b is omitted for NOT):
//   { type:'GATEOUT', tests:[ { gate:'XOR', a:1, b:1 }, … ],
//     badge, board, title, desc, hints, explain }
// ============================================================

function mk(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

function evalGate(g, a, b) {
  if (g === 'AND') return (a && b) ? 1 : 0;
  if (g === 'OR') return (a || b) ? 1 : 0;
  if (g === 'XOR') return (a !== b) ? 1 : 0;
  return a ? 0 : 1;   // NOT
}

// the gate symbols, matching the learn-page diagram shapes
function gateSvg(g, a, b) {
  const on = 'var(--phase-color)', off = 'var(--border)', ink = 'var(--ink)', srf = 'var(--surface)';
  const wire = (x1, y, x2, v) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${v ? on : off}" stroke-width="2.5"/>`;
  const lab = (x, y, s, v) => `<text x="${x}" y="${y}" fill="${v == null ? ink : (v ? on : 'var(--ink-3)')}" font-family="var(--mono)" font-size="13" text-anchor="middle">${s}</text>`;
  let body = '';
  if (g === 'NOT') {
    body += lab(28, 45, `A=${a}`, a) + wire(46, 50, 90, a)
      + `<path d="M 90,30 l 30,20 l -30,20 z" fill="${srf}" stroke="${ink}" stroke-width="2"/>`
      + `<circle cx="125" cy="50" r="4.5" fill="${srf}" stroke="${ink}" stroke-width="2"/>`
      + wire(130, 50, 172, 0).replace(off, off) + lab(188, 55, 'Q=?', null);
  } else {
    body += lab(28, 35, `A=${a}`, a) + wire(46, 40, 92, a)
      + lab(28, 65, `B=${b}`, b) + wire(46, 60, 92, b);
    if (g === 'AND') body += `<path d="M 92,30 h 20 a 20,20 0 0 1 0,40 h -20 z" fill="${srf}" stroke="${ink}" stroke-width="2"/>`;
    if (g === 'OR') body += `<path d="M 92,30 q 12,20 0,40 q 24,0 40,-20 q -16,-20 -40,-20 z" fill="${srf}" stroke="${ink}" stroke-width="2"/>`;
    if (g === 'XOR') body += `<path d="M 99,30 q 12,20 0,40 q 24,0 40,-20 q -16,-20 -40,-20 z" fill="${srf}" stroke="${ink}" stroke-width="2"/>`
      + `<path d="M 92,30 q 12,20 0,40" fill="none" stroke="${ink}" stroke-width="2"/>`;
    body += wire(139, 50, 172, 0) + lab(188, 55, 'Q=?', null);
  }
  body += `<text x="110" y="92" fill="var(--ink-4)" font-family="var(--mono)" font-size="12" letter-spacing="2" text-anchor="middle">${g}</text>`;
  return `<svg viewBox="0 0 210 100" class="go-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${g} gate with A=${a}${b == null ? '' : ' and B=' + b}">${body}</svg>`;
}

export const gateout = {
  type: 'GATEOUT',

  render(host, question, ctx) {
    host.innerHTML = '';
    const tests = question.tests.slice();
    let idx = 0, mistakes = 0, busy = false;

    const wrap = mk('go');
    const dots = mk('go-dots');
    const dotEls = tests.map(() => { const d = mk('go-dot'); dots.appendChild(d); return d; });
    wrap.appendChild(dots);

    const stage = mk('go-stage');
    wrap.appendChild(stage);
    const prompt = mk('go-prompt');
    wrap.appendChild(prompt);

    const btns = mk('go-btns');
    const b0 = mk('go-btn', 'button'); b0.type = 'button'; b0.textContent = '0'; b0.dataset.v = '0';
    const b1 = mk('go-btn', 'button'); b1.type = 'button'; b1.textContent = '1'; b1.dataset.v = '1';
    btns.append(b0, b1);
    wrap.appendChild(btns);
    host.appendChild(wrap);

    function paint() {
      const t = tests[idx];
      stage.dataset.gate = t.gate; stage.dataset.a = String(t.a);
      if (t.b == null) delete stage.dataset.b; else stage.dataset.b = String(t.b);
      stage.innerHTML = gateSvg(t.gate, t.a, t.b);
      prompt.textContent = `Test ${idx + 1} of ${tests.length}: with these inputs, what does Q output?`;
      dotEls.forEach((d, i) => { d.className = 'go-dot' + (i < idx ? ' done' : i === idx ? ' now' : ''); });
      [b0, b1].forEach(b => { b.className = 'go-btn'; b.disabled = false; });
    }
    paint();

    function answer(v) {
      if (ctx.isAnswered() || busy) return;
      const t = tests[idx];
      const want = evalGate(t.gate, t.a, t.b);
      const pick = v === 1 ? b1 : b0, other = v === 1 ? b0 : b1;
      busy = true;
      [b0, b1].forEach(b => { b.disabled = true; });
      if (v === want) {
        pick.classList.add('good');
        (ctx.sfx.uiClick || ctx.sfx.bitClick)();
      } else {
        pick.classList.add('bad');
        other.classList.add('good');
        mistakes++;
        ctx.sfx.wrong();
      }
      setTimeout(() => {
        busy = false;
        idx++;
        if (idx < tests.length) { paint(); return; }
        dotEls.forEach(d => { d.className = 'go-dot done'; });
        [b0, b1].forEach(b => { b.disabled = true; });
        prompt.textContent = mistakes === 0 ? 'All outputs correct.' : `${mistakes} of ${tests.length} outputs were wrong.`;
        const correct = mistakes === 0;
        if (correct) ctx.sfx.zap();
        ctx.onSubmit(correct, correct ? {} : {
          feedbackOnWrong: `${mistakes} of the ${tests.length} outputs were wrong — AND needs both 1s, OR needs at least one, XOR needs them to DIFFER, NOT flips.`,
        });
      }, v === want ? 350 : 1100);
    }
    b0.addEventListener('click', () => answer(0));
    b1.addEventListener('click', () => answer(1));
  },
};
