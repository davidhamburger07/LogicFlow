// ============================================================
// questions/typein.js — TYPEIN: type a short term or value (generative
// recall). One of the rotating recall formats — producing the answer is
// stronger than recognising it from options.
//
// Matching is lenient: case-insensitive, trimmed, whitespace-collapsed,
// surrounding quotes/period stripped. `accept` lists extra valid variants
// (synonyms, abbreviations, with/without an article).
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'TYPEIN', answer:'router', accept?:['a router'],
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function norm(s) { return String(s).toLowerCase().trim().replace(/\s+/g, ' ').replace(/^["']+|["'.]+$/g, '').trim(); }

export const typein = {
  type: 'TYPEIN',

  render(host, question, ctx) {
    host.innerHTML = '';
    const accepted = [question.answer, ...(question.accept || [])].map(norm);

    const wrap = el('ti');
    wrap.appendChild(el('ti-label')).textContent = '▶ Type your answer:';
    const row = el('ti-row');
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'ti-input'; input.autocomplete = 'off'; input.spellcheck = false; input.placeholder = 'your answer…';
    const submit = el('ti-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK →';
    row.append(input, submit);
    wrap.appendChild(row);
    host.appendChild(wrap);

    const go = () => {
      if (ctx.isAnswered()) return;
      if (!input.value.trim()) { input.classList.remove('ti-shake'); void input.offsetWidth; input.classList.add('ti-shake'); return; }
      const correct = accepted.includes(norm(input.value));
      input.disabled = true; submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `The answer is “${question.answer}”.` });
    };
    submit.addEventListener('click', go);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 50);
  },
};
