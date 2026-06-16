// ============================================================
// questions/trace.js — algorithm TRACE (Bubble Sort, one pass).
//
// Same contract as the other question types:
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// This is NOT free-form sorting. The student reproduces the
// algorithm's actual steps: a compare-window moves left→right over
// each adjacent pair and the student applies Bubble Sort's rule —
// SWAP if the left value is larger, otherwise KEEP. (They can also
// drag the highlighted tile onto its neighbour to swap.)
//
// A correct trace requires every decision to be right; the first
// wrong decision ends the question (a mis-trace is a mis-trace).
//
// Like the other bespoke types this module owns its own visual and
// the engine hides the read-only visual.js panel for TRACE.
//
// Question schema (in content.js):
//   {
//     type: 'TRACE',
//     algo: 'bubble',
//     array: [5, 3, 8, 1],
//     sortedTail: 0,    // optional: end elements already settled (shortens the sweep)
//     hints, explain, badge, board, title, desc ...
//   }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const trace = {
  type: 'TRACE',

  render(answerHost, question, ctx) {
    answerHost.innerHTML = '';
    const arr = [...question.array];
    const sortedTail = question.sortedTail || 0;
    const total = arr.length - 1 - sortedTail;   // comparisons in this pass
    const maxVal = Math.max(...arr, 1);
    let i = 0, locked = false;

    const wrap = el('trace');
    const tilesEl = el('trace-tiles');
    const status = el('trace-status');
    const controls = el('trace-controls');
    const swapBtn = el('trace-btn trace-swap', 'button'); swapBtn.type = 'button'; swapBtn.dataset.act = 'swap'; swapBtn.textContent = '⇄ SWAP';
    const keepBtn = el('trace-btn trace-keep', 'button'); keepBtn.type = 'button'; keepBtn.dataset.act = 'keep'; keepBtn.textContent = 'KEEP →';
    controls.append(swapBtn, keepBtn);
    const hint = el('trace-hintline');
    hint.textContent = 'Bubble Sort: SWAP only when the left value is larger; otherwise KEEP. You can also drag the highlighted tile onto its neighbour.';

    wrap.append(tilesEl, status, controls, hint);
    answerHost.appendChild(wrap);

    function renderTiles(swapped) {
      tilesEl.innerHTML = '';
      arr.forEach((v, idx) => {
        const t = el('trace-tile');
        if (idx === i || idx === i + 1) t.classList.add('compare');
        if (swapped && (idx === swapped[0] || idx === swapped[1])) t.classList.add('swapped');
        t.dataset.idx = idx;
        const bar = el('trace-bar'); bar.style.height = (18 + (v / maxVal) * 70) + 'px';
        const num = el('trace-num'); num.textContent = v;
        t.append(bar, num);
        tilesEl.appendChild(t);
      });
    }
    function updateStatus() {
      if (i < total) status.innerHTML = `Comparison <strong>${i + 1}</strong> of ${total} — positions ${i + 1} &amp; ${i + 2}: is <strong>${arr[i]}</strong> &gt; <strong>${arr[i + 1]}</strong>?`;
    }

    function decide(action) {
      if (locked || i >= total) return;
      const correctAction = arr[i] > arr[i + 1] ? 'swap' : 'keep';
      if (action !== correctAction) {
        locked = true; wrap.classList.add('locked');
        const why = correctAction === 'swap'
          ? `${arr[i]} > ${arr[i + 1]}, so Bubble Sort swaps them`
          : `${arr[i]} ≤ ${arr[i + 1]}, so they stay (no swap)`;
        ctx.onSubmit(false, { feedbackOnWrong: `At positions ${i + 1} & ${i + 2}: ${why}.` });
        return;
      }
      if (action === 'swap') {
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        ctx.sfx.bitClick(true);
        renderTiles([i, i + 1]);
      } else {
        ctx.sfx.tick();
      }
      i++;
      if (i >= total) {
        renderTiles();
        status.textContent = 'Pass complete.';
        locked = true; wrap.classList.add('locked');
        ctx.sfx.zap();
        ctx.onSubmit(true, {});
      } else {
        renderTiles();
        updateStatus();
      }
    }

    swapBtn.addEventListener('click', () => decide('swap'));
    keepBtn.addEventListener('click', () => decide('keep'));

    // drag the highlighted tile onto its neighbour to swap
    tilesEl.addEventListener('pointerdown', (e) => {
      if (locked) return;
      const tile = e.target.closest('.trace-tile');
      if (!tile) return;
      const idx = Number(tile.dataset.idx);
      if (idx !== i && idx !== i + 1) return;
      let moved = false; const sx = e.clientX, sy = e.clientY;
      const ghost = el('trace-ghost'); ghost.textContent = arr[idx];
      const move = (ev) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4) { moved = true; document.body.appendChild(ghost); }
        if (moved) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
      };
      const up = (ev) => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        ghost.remove();
        if (moved) {
          const t = document.elementFromPoint(ev.clientX, ev.clientY);
          const onTile = t && t.closest('.trace-tile');
          if (onTile) {
            const j = Number(onTile.dataset.idx);
            if ((idx === i && j === i + 1) || (idx === i + 1 && j === i)) decide('swap');
          }
        }
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });

    renderTiles();
    updateStatus();
  },
};