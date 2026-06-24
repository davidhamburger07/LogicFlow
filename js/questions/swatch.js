// ============================================================
// questions/swatch.js — SWATCH: build a #RRGGBB hex, see the colour live.
//
// Six hex-digit steppers grouped as R / G / B; a live swatch renders the
// current colour as you change the digits. Used for the exam-style colour
// questions ("which hex code makes pure blue?", "build this colour").
// Optionally shows the target colour swatch to match (match-the-colour).
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'SWATCH', answer:'0000FF', targetName?:'pure blue',
//     showTarget?:bool, badge, board, title, desc, hints, explain }
// ============================================================

const HEX = '0123456789ABCDEF';
function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const swatch = {
  type: 'SWATCH',

  render(host, question, ctx) {
    host.innerHTML = '';
    const answer = String(question.answer).toUpperCase().padStart(6, '0');
    const ansArr = [...answer].map(c => HEX.indexOf(c));
    const vals = new Array(6).fill(0);

    const wrap = el('sw');

    if (question.targetName) {
      const tgt = el('sw-target');
      tgt.innerHTML = `make <b>${question.targetName.toUpperCase()}</b>`;
      if (question.showTarget) { const ts = el('sw-target-swatch'); ts.style.background = '#' + answer; tgt.appendChild(ts); }
      wrap.appendChild(tgt);
    }

    const live = el('sw-swatch');
    const liveHex = el('sw-hex');
    const updateSwatch = () => { const hex = vals.map(v => HEX[v]).join(''); live.style.background = '#' + hex; liveHex.textContent = '#' + hex; };

    const row = el('sw-row');
    [['R', 0], ['G', 2], ['B', 4]].forEach(([labelTxt, start]) => {
      const g = el('sw-group');
      g.appendChild(el('sw-group-label')).textContent = labelTxt;
      const pair = el('sw-pair');
      for (let d = 0; d < 2; d++) {
        const i = start + d;
        const col = el('sw-col');
        const up = el('sw-step sw-up', 'button'); up.type = 'button'; up.textContent = '▲';
        const disp = el('sw-digit'); disp.textContent = '0';
        const down = el('sw-step sw-down', 'button'); down.type = 'button'; down.textContent = '▼';
        const set = v => { vals[i] = (v + 16) % 16; disp.textContent = HEX[vals[i]]; updateSwatch(); };
        up.addEventListener('click', () => { if (ctx.isAnswered()) return; set(vals[i] + 1); ctx.sfx.uiClick(); });
        down.addEventListener('click', () => { if (ctx.isAnswered()) return; set(vals[i] - 1); ctx.sfx.uiClick(); });
        col.append(up, disp, down);
        pair.appendChild(col);
      }
      g.appendChild(pair);
      row.appendChild(g);
    });
    wrap.appendChild(row);

    const liveWrap = el('sw-live');
    liveWrap.appendChild(el('sw-live-label')).textContent = 'your colour';
    liveWrap.append(live, liveHex);
    wrap.appendChild(liveWrap);
    updateSwatch();

    const submit = el('sw-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK →';
    submit.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      const correct = vals.every((v, i) => v === ansArr[i]);
      row.querySelectorAll('button').forEach(b => { b.disabled = true; });
      submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `The answer is #${answer}.` });
    });
    wrap.appendChild(submit);
    host.appendChild(wrap);
  },
};
