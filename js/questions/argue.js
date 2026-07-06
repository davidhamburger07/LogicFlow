// ============================================================
// questions/argue.js — ARGUE: build the 8-mark "discuss the impacts" answer.
//
// The extended-response exam skill, as a game. The player is given a real
// scenario and assembles a structured argument from modular BLOCKS: impact
// points (each tagged with its category + the stakeholder affected), a relevant
// LAW, and a JUDGEMENT. A live BAND METER shows the examiner's actual criteria
// filling up — range, balance, stakeholders, legislation, a reasoned judgement
// — so the student SEES what lifts a 3/8 to an 8/8. SUBMIT reveals a banded
// mark, examiner feedback, and a model answer that turns the blocks into prose.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(pass, { marks, maxMarks })
//
// Question schema:
//   { type:'ARGUE', marks:8, scenario:'…the dilemma…',
//     blocks:[
//       { id, kind:'point', side:'for'|'against', cat:'Ethical'|'Legal'|'Cultural'|'Environmental',
//         who:'Customers'|'Employees'|…, text:'…', weak?:true },   // weak = trivial, scores nothing
//       { id, kind:'law', text:'…', ok:true|false },                // ok:false = not the relevant law
//       { id, kind:'judgement', text:'…', balanced:true|false },    // balanced:false = one-sided
//     ],
//     model:'…full-mark prose…', badge, board, title, desc, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export const argue = {
  type: 'ARGUE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const marks = question.marks || 8;
    const blocks = question.blocks || [];
    let chosen = [];
    let submitted = false;

    const wrap = el('arg');
    const scen = el('arg-scenario');
    scen.innerHTML = `<div class="arg-scen-lbl">DISCUSS · ${marks} MARKS</div><div class="arg-scen-text">${esc(question.scenario)}</div>`;
    wrap.appendChild(scen);

    const band = el('arg-band'); wrap.appendChild(band);

    wrap.appendChild(el('arg-lbl')).textContent = 'YOUR ARGUMENT';
    const answer = el('arg-answer'); wrap.appendChild(answer);

    wrap.appendChild(el('arg-lbl')).textContent = 'BLOCK BANK — click a block to add it (click it again to remove)';
    const bank = el('arg-bank'); wrap.appendChild(bank);

    const submit = el('arg-submit', 'button'); submit.type = 'button'; submit.textContent = 'SUBMIT ANSWER →';
    wrap.appendChild(submit);
    const modelBox = el('arg-model'); modelBox.style.display = 'none'; wrap.appendChild(modelBox);
    host.appendChild(wrap);

    // ---- marking ----
    function evaluate() {
      const pts = chosen.filter(b => b.kind === 'point' && !b.weak);
      const weak = chosen.filter(b => b.kind === 'point' && b.weak);
      const cats = new Set(pts.map(p => p.cat));
      const whos = new Set(pts.map(p => p.who));
      const hasFor = pts.some(p => p.side === 'for');
      const hasAgainst = pts.some(p => p.side === 'against');
      const relLaw = chosen.some(b => b.kind === 'law' && b.ok);
      const irrLaw = chosen.some(b => b.kind === 'law' && !b.ok);
      const judg = chosen.find(b => b.kind === 'judgement');
      const balanced = !!(judg && judg.balanced);
      const n = Math.min(pts.length, 3);
      const crit = {
        points: { n }, balance: { got: hasFor && hasAgainst }, range: { got: cats.size >= 2 },
        stake: { got: whos.size >= 2 }, law: { got: relLaw }, judgement: { got: balanced },
      };
      let score = n + (crit.balance.got ? 1 : 0) + (crit.range.got ? 1 : 0) + (crit.stake.got ? 1 : 0) + (crit.law.got ? 1 : 0) + (crit.judgement.got ? 1 : 0);
      score = Math.min(score, marks);
      const notes = [];
      if (weak.length) notes.push('One block was too trivial to earn a mark.');
      if (irrLaw) notes.push("A law you cited isn't the most relevant one here.");
      if (judg && !balanced) notes.push('Your conclusion is one-sided — a top answer weighs both sides.');
      return { score, crit, notes };
    }

    // ---- chips ----
    function makeChip(b, inAnswer) {
      const kindCls = b.kind === 'point' ? 'arg-' + b.side : 'arg-' + b.kind;
      const c = el('arg-chip ' + kindCls + (inAnswer ? ' arg-in' : ''), 'button');
      c.type = 'button'; c.dataset.id = String(b.id);
      let tags = '';
      if (b.kind === 'point') tags = `<span class="arg-tag arg-cat">${esc(b.cat)}</span><span class="arg-tag arg-who">👤 ${esc(b.who)}</span>`;
      else if (b.kind === 'law') tags = '<span class="arg-tag arg-lawtag">LAW</span>';
      else if (b.kind === 'judgement') tags = '<span class="arg-tag arg-judgetag">CONCLUSION</span>';
      c.innerHTML = `<span class="arg-chip-text">${esc(b.text)}</span><span class="arg-chip-tags">${tags}</span>`;
      c.addEventListener('click', () => {
        if (submitted) return;
        if (inAnswer) chosen = chosen.filter(x => x !== b);
        else { if (b.kind === 'judgement') chosen = chosen.filter(x => x.kind !== 'judgement'); chosen.push(b); }
        (ctx.sfx.uiClick || ctx.sfx.bitClick)();
        rerender();
      });
      return c;
    }

    function group(host2, title, arr, inAnswer) {
      if (!arr.length) return;
      const g = el('arg-group');
      g.appendChild(el('arg-group-lbl')).textContent = title;
      const row = el('arg-chips');
      arr.forEach(b => row.appendChild(makeChip(b, inAnswer)));
      g.appendChild(row);
      host2.appendChild(g);
    }

    function pip(ok, label) { return `<span class="arg-pip ${ok ? 'on' : ''}">${ok ? '✓' : '○'} ${label}</span>`; }

    function rerender() {
      // BANK — unchosen blocks, grouped by kind
      bank.innerHTML = '';
      group(bank, 'IMPACT POINTS', blocks.filter(b => b.kind === 'point' && !chosen.includes(b)), false);
      group(bank, 'LAWS', blocks.filter(b => b.kind === 'law' && !chosen.includes(b)), false);
      group(bank, 'CONCLUSIONS', blocks.filter(b => b.kind === 'judgement' && !chosen.includes(b)), false);

      // ANSWER — chosen blocks, grouped into the argument frame
      answer.innerHTML = '';
      if (!chosen.length) { answer.appendChild(el('arg-empty')).textContent = 'Empty — add impact points (argue BOTH sides), name who is affected, cite a relevant law, and finish with a balanced conclusion.'; }
      else {
        group(answer, 'FOR — benefits', chosen.filter(b => b.kind === 'point' && b.side === 'for'), true);
        group(answer, 'AGAINST — drawbacks', chosen.filter(b => b.kind === 'point' && b.side === 'against'), true);
        group(answer, 'LAW / RESPONSIBILITY', chosen.filter(b => b.kind === 'law'), true);
        group(answer, 'JUDGEMENT', chosen.filter(b => b.kind === 'judgement'), true);
      }

      // BAND meter
      const ev = evaluate();
      const pct = Math.round(ev.score / marks * 100);
      band.innerHTML = `<div class="arg-band-top"><span class="arg-band-num">BAND ${ev.score} / ${marks}</span>`
        + `<div class="arg-band-bar"><div class="arg-band-fill" style="width:${pct}%"></div></div></div>`
        + `<div class="arg-pips">`
        + `<span class="arg-pip ${ev.crit.points.n >= 2 ? 'on' : ''}">${ev.crit.points.n >= 2 ? '✓' : '○'} POINTS ${ev.crit.points.n}/3</span>`
        + pip(ev.crit.balance.got, 'BOTH SIDES') + pip(ev.crit.range.got, 'RANGE')
        + pip(ev.crit.stake.got, 'STAKEHOLDERS') + pip(ev.crit.law.got, 'A LAW')
        + pip(ev.crit.judgement.got, 'JUDGEMENT') + `</div>`;
    }

    submit.addEventListener('click', () => {
      if (submitted) return;
      submitted = true;
      const ev = evaluate();
      wrap.classList.add('arg-done');
      wrap.querySelectorAll('.arg-chip').forEach(b => { b.disabled = true; });
      submit.disabled = true;
      const missed = [];
      if (ev.crit.points.n < 2) missed.push('make at least two developed points');
      if (!ev.crit.balance.got) missed.push('argue both sides (a benefit AND a drawback)');
      if (!ev.crit.range.got) missed.push('cover more than one type of impact');
      if (!ev.crit.stake.got) missed.push('name who is affected (stakeholders)');
      if (!ev.crit.law.got) missed.push('cite a relevant law');
      if (!ev.crit.judgement.got) missed.push('end with a balanced judgement');
      let html = `<div class="arg-model-head">EXAMINER · ${ev.score} / ${marks} MARKS</div>`;
      html += `<div class="arg-exam-comment">${missed.length ? 'To reach full marks you still need to: ' + missed.join('; ') + '.' : 'Full marks — a balanced, well-structured answer that covers range, stakeholders, the law and a reasoned judgement.'}</div>`;
      if (ev.notes.length) html += `<div class="arg-exam-notes">${ev.notes.map(n => '⚠ ' + esc(n)).join('<br>')}</div>`;
      if (question.model) html += `<div class="arg-model-head">★ MODEL ANSWER</div><div class="arg-model-text">${question.model}</div>`;
      modelBox.innerHTML = html; modelBox.style.display = 'block';
      const passed = ev.score >= Math.ceil(marks * 0.6);
      ctx.sfx[passed ? 'zap' : 'wrong']();
      ctx.onSubmit(passed, { marks: ev.score, maxMarks: marks });
    });

    rerender();
  },
};
