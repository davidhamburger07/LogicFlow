// ============================================================
// questions/codebuild.js — CODE_BUILD question type (Parsons problem).
//
// The student is given the lines of a program in a JUMBLED order and
// arranges them into the correct order — by dragging the handle, or with
// the ▲ / ▼ buttons. Indentation is shown but fixed; only the ORDER is
// judged. The first wrong-free arrangement marks correct.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Schema (lines may be a plain array or a { AQA, OCR, Eduqas } map):
//   { type: 'CODE_BUILD', lines: ['line0', '  line1', …], title, … }
// `lines` is given in the CORRECT order; the module shuffles for display.
// ============================================================

import { highlight, forBoard, notationCaption, missionStrip } from './codeview.js';

function el(cls) { const e = document.createElement('div'); if (cls) e.className = cls; return e; }
function shuffledOrder(n) {
  const o = [...Array(n).keys()];
  if (n < 2) return o;
  for (let tries = 0; tries < 12; tries++) {
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    if (o.some((id, i) => id !== i)) break;        // avoid showing it already solved
  }
  return o;
}

export const codebuild = {
  type: 'CODE_BUILD',

  render(answerHost, question, ctx) {
    answerHost.innerHTML = '';
    const _mission = missionStrip(question); if (_mission) answerHost.appendChild(_mission);
    const correct = forBoard(question.lines).map(s => String(s));
    const n = correct.length;
    let locked = false, dragRow = null;

    const wrap = el('codebuild');
    const cap = notationCaption(question); if (cap) wrap.appendChild(cap);
    const hint = el('cb-hint'); hint.textContent = '▶ Drag the lines (or use ▲▼) into the correct order:'; wrap.appendChild(hint);
    const list = el('cb-lines'); wrap.appendChild(list);

    shuffledOrder(n).forEach(id => {
      const row = el('cb-line'); row.dataset.id = String(id);
      row.innerHTML = `<span class="cb-handle" title="Drag">⠿</span><span class="cb-src">${highlight(correct[id]) || ' '}</span>`
        + `<span class="cb-moves"><button type="button" class="cb-up" aria-label="Move up">▲</button><button type="button" class="cb-down" aria-label="Move down">▼</button></span>`;
      list.appendChild(row);
    });

    // ▲ / ▼ reorder (accessible + touch-safe)
    list.addEventListener('click', e => {
      if (locked) return;
      const row = e.target.closest('.cb-line'); if (!row) return;
      if (e.target.closest('.cb-up') && row.previousElementSibling) { list.insertBefore(row, row.previousElementSibling); ctx.sfx.uiClick(); }
      else if (e.target.closest('.cb-down') && row.nextElementSibling) { list.insertBefore(row.nextElementSibling, row); ctx.sfx.uiClick(); }
    });

    // pointer-drag reorder (insert at the hovered position)
    list.addEventListener('pointerdown', e => {
      if (locked || !e.target.closest('.cb-handle')) return;
      dragRow = e.target.closest('.cb-line'); if (!dragRow) return;
      dragRow.classList.add('dragging');
      try { e.target.setPointerCapture(e.pointerId); } catch (x) {}
      e.preventDefault();
    });
    list.addEventListener('pointermove', e => {
      if (!dragRow) return;
      for (const r of list.querySelectorAll('.cb-line')) {
        if (r === dragRow) continue;
        const rect = r.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) { list.insertBefore(dragRow, r); return; }
      }
      list.appendChild(dragRow);
    });
    const end = () => { if (dragRow) { dragRow.classList.remove('dragging'); dragRow = null; } };
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);

    const actions = el('cb-actions');
    const check = document.createElement('button');
    check.type = 'button'; check.className = 'cb-check'; check.textContent = 'CHECK →';
    check.addEventListener('click', () => {
      if (ctx.isAnswered()) return;
      const rows = [...list.querySelectorAll('.cb-line')];
      const ok = rows.every((r, i) => Number(r.dataset.id) === i);
      rows.forEach((r, i) => r.classList.add(Number(r.dataset.id) === i ? 'pos-ok' : 'pos-bad'));
      locked = true; list.classList.add('locked'); check.disabled = true;
      if (ok) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(ok, ok ? {} : { feedbackOnWrong: 'Not in order yet — the lines marked in red are out of place.' });
    });
    actions.appendChild(check); wrap.appendChild(actions);
    answerHost.appendChild(wrap);
  },
};
