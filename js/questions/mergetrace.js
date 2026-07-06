// ============================================================
// questions/mergetrace.js — MERGETRACE: trace a MERGE sort by hand.
//
// Divide-and-conquer, executed by the player (never auto-sorted):
//   DIVIDE — press SPLIT to halve every group, level by level, until every
//            group is a single item.
//   MERGE  — the front two sorted groups are merged: the player repeatedly
//            clicks the SMALLER of the two current head elements to build the
//            merged list. A completed pair is enqueued at the back; when one
//            group remains, the list is sorted. First wrong click ends it.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:  { type:'MERGETRACE', array:[8,3,5,1], badge, title, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const mergetrace = {
  type: 'MERGETRACE',

  render(answerHost, question, ctx) {
    answerHost.innerHTML = '';
    let groups = [question.array.slice()];   // current partition (each group is sorted once merged)
    let phase = 'divide';                     // 'divide' | 'merge' | 'done'
    let A = null, B = null, ai = 0, bi = 0, out = [];
    let locked = false;

    const wrap = el('mg');
    const status = el('mg-status');
    const groupsRow = el('mg-groups');
    const outRow = el('mg-out');
    const controls = el('mg-controls');
    const splitBtn = el('mg-split', 'button'); splitBtn.type = 'button'; splitBtn.textContent = '✂ SPLIT IN HALF';
    controls.appendChild(splitBtn);
    wrap.append(status, groupsRow, outRow, controls);
    answerHost.appendChild(wrap);

    function box(vals, cls) {
      const b = el('mg-group' + (cls ? ' ' + cls : ''));
      vals.forEach((v, i) => { const e = el('mg-el', 'button'); e.type = 'button'; e.textContent = v; e.dataset.pos = String(i); b.appendChild(e); });
      return b;
    }

    function render() {
      groupsRow.innerHTML = ''; outRow.innerHTML = '';
      if (phase === 'divide') {
        groups.forEach(g => groupsRow.appendChild(box(g, g.length > 1 ? 'mg-splittable' : 'mg-single')));
        const allSingle = groups.every(g => g.length === 1);
        status.innerHTML = allSingle ? 'All split into single items — now <b>merge</b> them back.' : `Press <b>SPLIT</b> to halve every group. Groups: <b>${groups.length}</b>.`;
        splitBtn.style.display = allSingle ? 'none' : '';
        outRow.style.display = 'none';
        if (allSingle) { phase = 'merge'; startMerge(); }
        return;
      }
      // merge phase
      splitBtn.style.display = 'none';
      outRow.style.display = '';
      groups.forEach((g, gi) => {
        const merging = gi < 2;
        const b = box(g, merging ? 'mg-merging' : 'mg-waiting');
        if (merging) {
          const headPos = gi === 0 ? ai : bi;
          [...b.querySelectorAll('.mg-el')].forEach((e, i) => {
            e.classList.toggle('mg-head', i === headPos);
            e.classList.toggle('mg-used', i < headPos);
            if (i === headPos) e.addEventListener('click', () => pick(gi === 0 ? 'A' : 'B'));
          });
        }
        groupsRow.appendChild(b);
      });
      // the output being built
      const lbl = el('mg-out-lbl'); lbl.textContent = 'MERGED →'; outRow.appendChild(lbl);
      out.forEach(v => { const e = el('mg-el mg-out-el'); e.textContent = v; outRow.appendChild(e); });
      const ah = ai < A.length ? A[ai] : '–', bh = bi < B.length ? B[bi] : '–';
      status.innerHTML = `Merging two sorted groups — click the <b>smaller head</b> (<b>${ah}</b> vs <b>${bh}</b>).`;
    }

    function startMerge() {
      if (groups.length <= 1) { phase = 'done'; locked = true; status.textContent = 'Sorted!'; render(); ctx.sfx.zap(); ctx.onSubmit(true, {}); return; }
      A = groups[0]; B = groups[1]; ai = 0; bi = 0; out = [];
      render();
    }

    function pick(which) {
      if (locked || phase !== 'merge') return;
      const aAvail = ai < A.length, bAvail = bi < B.length;
      const correct = !aAvail ? 'B' : !bAvail ? 'A' : (A[ai] <= B[bi] ? 'A' : 'B');
      if (which !== correct) {
        locked = true; wrap.classList.add('locked');
        ctx.sfx.wrong();
        ctx.onSubmit(false, { feedbackOnWrong: `Merge takes the SMALLER head first: ${A[ai] <= B[bi] ? A[ai] : B[bi]} before ${A[ai] <= B[bi] ? B[bi] : A[ai]}.` });
        return;
      }
      if (which === 'A') out.push(A[ai++]); else out.push(B[bi++]);
      ctx.sfx.bitClick(true);
      if (ai >= A.length && bi >= B.length) {
        groups.shift(); groups.shift(); groups.push(out);   // enqueue merged group at the back
        startMerge();
      } else render();
    }

    splitBtn.addEventListener('click', () => {
      if (locked || phase !== 'divide') return;
      groups = groups.flatMap(g => g.length > 1 ? [g.slice(0, Math.floor(g.length / 2)), g.slice(Math.floor(g.length / 2))] : [g]);
      ctx.sfx.bitClick(true);
      render();
    });

    render();
  },
};
