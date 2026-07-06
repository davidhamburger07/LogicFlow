// ============================================================
// questions/inserttrace.js — INSERTTRACE: trace an INSERTION sort by hand.
//
// Like the bubble TRACE, the student physically executes the algorithm — it
// never sorts for them. A "current card" is taken from the unsorted part and
// worked left into the growing SORTED region: at each comparison the student
// chooses SHIFT (the card on the left is bigger, so slide the current card
// past it) or DROP (it's in place — move on to the next card). First wrong
// decision ends the trace. Runs a whole (small) sort, one comparison a mark.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:  { type:'INSERTTRACE', array:[5,3,8,1], badge, title, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const inserttrace = {
  type: 'INSERTTRACE',

  render(answerHost, question, ctx) {
    answerHost.innerHTML = '';
    const arr = [...question.array];
    const n = arr.length;
    const maxVal = Math.max(...arr, 1);
    let sorted = 1;        // arr[0..sorted-1] is the sorted region
    let cur = 1;           // index of the card being inserted
    let locked = false;

    const wrap = el('ins');
    const tilesEl = el('trace-tiles');
    const status = el('trace-status');
    const controls = el('trace-controls');
    const shiftBtn = el('trace-btn trace-swap', 'button'); shiftBtn.type = 'button'; shiftBtn.dataset.act = 'shift'; shiftBtn.textContent = '◀ SHIFT';
    const dropBtn = el('trace-btn trace-keep', 'button'); dropBtn.type = 'button'; dropBtn.dataset.act = 'drop'; dropBtn.textContent = 'DROP ✓';
    controls.append(shiftBtn, dropBtn);
    const hint = el('trace-hintline');
    hint.textContent = 'Insertion sort: SHIFT the current card left while the card to its left is bigger; DROP it once it sits in the right place.';
    wrap.append(tilesEl, status, controls, hint);
    answerHost.appendChild(wrap);

    function renderTiles(swapped) {
      tilesEl.innerHTML = '';
      arr.forEach((v, idx) => {
        const t = el('trace-tile' + (idx < sorted ? ' ins-sorted' : ''));
        if (idx === cur) t.classList.add('ins-cur');
        if (idx === cur - 1) t.classList.add('compare');
        if (swapped && (idx === swapped[0] || idx === swapped[1])) t.classList.add('swapped');
        t.dataset.idx = idx;
        const bar = el('trace-bar'); bar.style.height = (18 + (v / maxVal) * 70) + 'px';
        const num = el('trace-num'); num.textContent = v;
        t.append(bar, num);
        tilesEl.appendChild(t);
      });
    }
    function updateStatus() {
      if (cur > 0 && cur < n) status.innerHTML = `Inserting <strong>${arr[cur]}</strong> — is the card on its left (<strong>${arr[cur - 1]}</strong>) bigger?`;
    }

    function decide(action) {
      if (locked || cur >= n) return;
      const canShift = cur > 0 && arr[cur - 1] > arr[cur];
      const correct = canShift ? 'shift' : 'drop';
      if (action !== correct) {
        locked = true; wrap.classList.add('locked');
        const why = canShift ? `${arr[cur - 1]} > ${arr[cur]}, so shift the card left` : (cur === 0 ? 'the card is at the front, so drop it here' : `${arr[cur - 1]} ≤ ${arr[cur]}, so it is already in place — drop it`);
        ctx.onSubmit(false, { feedbackOnWrong: `Inserting ${arr[cur]}: ${why}.` });
        return;
      }
      if (action === 'shift') {
        [arr[cur - 1], arr[cur]] = [arr[cur], arr[cur - 1]];
        cur--;
        ctx.sfx.bitClick(true);
        renderTiles([cur, cur + 1]);
        updateStatus();
      } else {
        ctx.sfx.tick();
        sorted++; cur = sorted;
        if (cur >= n) {
          renderTiles();
          status.textContent = 'Sorted!';
          locked = true; wrap.classList.add('locked');
          ctx.sfx.zap();
          ctx.onSubmit(true, {});
        } else {
          renderTiles();
          updateStatus();
        }
      }
    }

    shiftBtn.addEventListener('click', () => decide('shift'));
    dropBtn.addEventListener('click', () => decide('drop'));

    renderTiles();
    updateStatus();
  },
};
