// ============================================================
// questions/signalrestore.js — SIGNAL: restore a corrupted image.
//
// The player raises the COLOUR DEPTH to make a garbled image legible, but
// each extra bit multiplies the FILE SIZE — and there is a bandwidth budget.
// They must pick the highest depth that is BOTH legible (>= minDepth) AND
// within budget (pixels x depth <= budget), then RESTORE. It makes the
// file-size formula and the quality-vs-size trade-off tangible.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'SIGNAL', pixels:4800, budget:24000, depths:[1,2,4,8], minDepth:4,
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const signalrestore = {
  type: 'SIGNAL',

  render(host, question, ctx) {
    host.innerHTML = '';
    const pixels = question.pixels;
    const budget = question.budget;
    const depths = question.depths || [1, 2, 4, 8];
    const minDepth = question.minDepth || 4;
    let di = 0, done = false;

    const wrap = el('sg');
    const preview = el('sg-preview'); wrap.appendChild(preview);
    const status = el('sg-status'); wrap.appendChild(status);

    const ctrl = el('sg-ctrl');
    const minus = el('sg-step', 'button'); minus.type = 'button'; minus.textContent = '◀';
    const depthLbl = el('sg-depth');
    const plus = el('sg-step', 'button'); plus.type = 'button'; plus.textContent = '▶';
    ctrl.append(minus, depthLbl, plus);
    wrap.appendChild(ctrl);

    const sizeLine = el('sg-size'); wrap.appendChild(sizeLine);
    const bar = el('sg-bar'); const barFill = el('sg-bar-fill'); bar.appendChild(barFill); wrap.appendChild(bar);

    const btn = el('sg-restore', 'button'); btn.type = 'button'; btn.textContent = '📡 RESTORE SIGNAL';
    btn.addEventListener('click', fire);
    wrap.appendChild(btn);
    host.appendChild(wrap);

    minus.addEventListener('click', () => { if (done) return; di = Math.max(0, di - 1); ctx.sfx.uiClick(); paint(); });
    plus.addEventListener('click', () => { if (done) return; di = Math.min(depths.length - 1, di + 1); ctx.sfx.uiClick(); paint(); });

    function paint() {
      const depth = depths[di], colours = 1 << depth, size = pixels * depth;
      depthLbl.innerHTML = `<b>${depth}</b>-bit colour <span class="sg-colours">${colours.toLocaleString()} shades</span>`;
      const n = Math.min(colours, 32);
      preview.innerHTML = Array.from({ length: n }, (_, i) => { const g = Math.round(i / (n - 1 || 1) * 255); return `<span class="sg-sw" style="background:rgb(${g},${g},${g})"></span>`; }).join('');
      sizeLine.innerHTML = `file size = ${pixels.toLocaleString()} px × ${depth} bits = <b>${size.toLocaleString()}</b> bits · budget ${budget.toLocaleString()}`;
      barFill.style.width = Math.min(100, size / budget * 100) + '%';
      barFill.classList.toggle('sg-over', size > budget);
      const fits = size <= budget, legible = depth >= minDepth;
      if (!fits) { status.textContent = '⚠ BANDWIDTH EXCEEDED'; status.className = 'sg-status sg-bad'; }
      else if (!legible) { status.textContent = '▒ SIGNAL GARBLED — too few shades'; status.className = 'sg-status sg-garbled'; }
      else { status.textContent = '◷ ready to restore'; status.className = 'sg-status sg-ready'; }
    }
    paint();

    function fire() {
      if (done) return;
      const depth = depths[di], size = pixels * depth;
      const ok = depth >= minDepth && size <= budget;
      done = true; minus.disabled = true; plus.disabled = true; btn.disabled = true;
      if (ok) { status.textContent = '✓ SIGNAL RESTORED'; status.className = 'sg-status sg-ok'; ctx.sfx.zap(); ctx.onSubmit(true); return; }
      ctx.sfx.wrong();
      const best = depths.filter(d => d >= minDepth && pixels * d <= budget).sort((a, b) => b - a)[0];
      const fb = size > budget
        ? `Over budget — ${pixels.toLocaleString()} × ${depth} = ${size.toLocaleString()} bits exceeds ${budget.toLocaleString()}. Use the highest depth that still fits${best ? ' (' + best + '-bit)' : ''}.`
        : `Still garbled — you need at least ${minDepth}-bit colour to make it legible${best ? ', and ' + best + '-bit fits the budget' : ''}.`;
      ctx.onSubmit(false, { feedbackOnWrong: fb });
    }
  },
};
