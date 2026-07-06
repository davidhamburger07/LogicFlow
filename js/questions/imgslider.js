// ============================================================
// questions/imgslider.js — IMGSLIDER: the Image Compression Slider.
//
// A photo-export panel that makes lossy compression tangible: a real sample
// image is drawn on a canvas, and dragging the COLOUR-DEPTH slider from 8-bit
// down to 1-bit quantises it live — smooth gradients posterise into harsh
// bands, the palette collapses, and at 1-bit it drops to black & white — while
// the FILE-SIZE counter (width × height × depth) plummets. The task: compress
// under a target size while keeping the picture recognisable.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'IMGSLIDER', width:160, height:120, maxDepth:8, minDepth:2, targetKB:8,
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

// draw a simple landscape — smooth gradients so colour-depth reduction shows
// obvious banding, a sun for a bright highlight, hills for flat colour areas.
function drawScene(cx, W, H) {
  const g = cx.createLinearGradient(0, 0, 0, H * 0.85);
  g.addColorStop(0, '#2f6fed'); g.addColorStop(0.55, '#8fb9f2'); g.addColorStop(1, '#ffd98a');
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  const sx = W * 0.72, sy = H * 0.34, sr = H * 0.15;
  const gg = cx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.6);
  gg.addColorStop(0, 'rgba(255,247,205,0.95)'); gg.addColorStop(1, 'rgba(255,220,120,0)');
  cx.fillStyle = gg; cx.beginPath(); cx.arc(sx, sy, sr * 2.6, 0, 7); cx.fill();
  cx.fillStyle = '#fff6c8'; cx.beginPath(); cx.arc(sx, sy, sr, 0, 7); cx.fill();
  cx.fillStyle = '#6cbf5a'; cx.beginPath(); cx.ellipse(W * 0.26, H * 1.02, W * 0.55, H * 0.4, 0, 0, 7); cx.fill();
  cx.fillStyle = '#3f8f4a'; cx.beginPath(); cx.ellipse(W * 0.82, H * 1.08, W * 0.62, H * 0.44, 0, 0, 7); cx.fill();
}

// quantise the base image to the given colour depth and paint it.
function quantise(cx, base, depth, W, H) {
  const src = base.data;
  const out = cx.createImageData(W, H);
  const d = out.data;
  if (depth <= 1) {                                  // 1 bit → black & white
    for (let i = 0; i < src.length; i += 4) {
      const lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
      const v = lum >= 128 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
  } else {                                           // reduce levels per channel
    const L = Math.max(2, Math.round(Math.cbrt(Math.pow(2, depth))));
    const step = 255 / (L - 1);
    for (let i = 0; i < src.length; i += 4) {
      for (let c = 0; c < 3; c++) d[i + c] = Math.round(Math.round(src[i + c] / step) * step);
      d[i + 3] = 255;
    }
  }
  cx.putImageData(out, 0, 0);
}

export const imgslider = {
  type: 'IMGSLIDER',

  render(host, question, ctx) {
    host.innerHTML = '';
    const W = question.width || 160, H = question.height || 120;
    const maxDepth = question.maxDepth || 8, minDepth = question.minDepth || 2;
    const targetKB = question.targetKB || 8;
    const budgetBits = Math.round(targetKB * 1000 * 8);
    const px = W * H;
    let depth = maxDepth, done = false;

    const wrap = el('is');
    const cv = document.createElement('canvas'); cv.className = 'is-canvas'; cv.width = W; cv.height = H;
    const cx = cv.getContext('2d');
    wrap.appendChild(cv);
    const base = document.createElement('canvas'); base.width = W; base.height = H;
    const bcx = base.getContext('2d'); drawScene(bcx, W, H);
    const baseData = bcx.getImageData(0, 0, W, H);

    const row = el('is-row');
    row.appendChild(el('is-lbl')).textContent = 'COLOUR DEPTH';
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '1'; slider.max = String(maxDepth); slider.step = '1'; slider.value = String(depth); slider.className = 'is-slider';
    slider.setAttribute('aria-label', 'colour depth in bits');
    const depthVal = el('is-depthval');
    row.append(slider, depthVal);
    wrap.appendChild(row);

    const size = el('is-size'); wrap.appendChild(size);
    const bar = el('is-bar'); const fill = el('is-bar-fill'); bar.appendChild(fill); wrap.appendChild(bar);
    const target = el('is-target'); wrap.appendChild(target);
    target.innerHTML = `TARGET: shrink it under <b>${targetKB} KB</b> — but keep enough colour that the picture still reads.`;
    const status = el('is-status'); wrap.appendChild(status);
    const lock = el('is-lock', 'button'); lock.type = 'button'; lock.textContent = '🔒 LOCK IN THIS SETTING'; wrap.appendChild(lock);
    const fb = el('is-fb'); wrap.appendChild(fb);
    host.appendChild(wrap);

    function paint() {
      quantise(cx, baseData, depth, W, H);
      const colours = Math.pow(2, depth);
      const bits = px * depth, kb = bits / 8 / 1000;
      depthVal.innerHTML = `<b>${depth}</b>-bit · ${colours.toLocaleString()} colour${colours === 1 ? '' : 's'}`;
      size.innerHTML = `FILE SIZE&nbsp; ${W} × ${H} × ${depth} = <b>${bits.toLocaleString()}</b> bits = <span class="is-kb">${kb.toFixed(1)} KB</span>`;
      fill.style.width = Math.min(100, bits / budgetBits * 100) + '%';
      const over = bits > budgetBits, tooLow = depth < minDepth;
      fill.classList.toggle('is-over', over);
      wrap.dataset.depth = String(depth);
      // a definitely-valid depth (for the harness / a11y): highest that fits, but ≥ minDepth
      wrap.dataset.answer = String(Math.max(minDepth, Math.min(maxDepth, Math.floor(budgetBits / px))));
      if (over) { status.textContent = '⚠ TOO BIG — still over the target'; status.className = 'is-status is-bad'; }
      else if (tooLow) { status.textContent = '▒ TOO FEW COLOURS — the picture is wrecked'; status.className = 'is-status is-garbled'; }
      else { status.textContent = '✓ under the target, and still readable'; status.className = 'is-status is-ready'; }
    }
    slider.addEventListener('input', () => { if (done) return; depth = Number(slider.value); (ctx.sfx.uiClick || ctx.sfx.bitClick)(); paint(); });
    paint();

    lock.addEventListener('click', () => {
      if (done) return;
      const bits = px * depth;
      const ok = depth >= minDepth && bits <= budgetBits;
      if (!ok) {
        ctx.sfx.wrong();
        fb.className = 'is-fb is-fb-no';
        fb.textContent = bits > budgetBits
          ? `Still too big — ${(bits / 8 / 1000).toFixed(1)} KB is over the ${targetKB} KB target. Drag the depth lower.`
          : `You've crushed it below ${minDepth}-bit — the picture is unrecognisable. Nudge it back up.`;
        return;
      }
      done = true; slider.disabled = true; lock.disabled = true;
      status.textContent = '✓ COMPRESSED & LOCKED'; status.className = 'is-status is-ok';
      fb.className = 'is-fb is-fb-ok';
      fb.innerHTML = `✓ <b>DONE</b> — compressed to ${(px * depth / 8 / 1000).toFixed(1)} KB at ${depth}-bit colour. Fewer bits per pixel = fewer colours = a smaller file (lossy — the lost colours don't come back).`;
      ctx.sfx.zap();
      ctx.onSubmit(true);
    });
  },
};
