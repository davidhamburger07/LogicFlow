// ============================================================
// questions/aitrain.js — AITRAIN: the AI Bias Lab.
//
// Machine learning only learns the patterns in its TRAINING DATA. The player
// trains an AI on a skewed dataset, tests it, and sees it perform badly for the
// under-represented group — that's BIAS. They fix it by adding more of that
// group's data (balanced, representative data) and retraining until the AI is
// fair for everyone. Turns "bias comes from the training data" from a fact into
// something you cause and cure.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'AITRAIN', scenario:'…',
//     groups:[ { id:'london', label:'London accent', start:6 }, … ],
//     pool:[ 'scottish','scottish','london', … ],   // labelled samples you can add
//     threshold:80, badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export const aitrain = {
  type: 'AITRAIN',

  render(host, question, ctx) {
    host.innerHTML = '';
    const groups = question.groups || [];
    const threshold = question.threshold || 80;
    const counts = {}; groups.forEach(g => counts[g.id] = g.start || 0);
    let pool = (question.pool || []).slice();
    let tested = false, done = false;
    const acc = c => Math.min(96, 24 + c * 12);   // more representative data → higher accuracy

    const wrap = el('ai');
    if (question.scenario) { const sc = el('ai-scenario'); sc.innerHTML = `<span class="ai-sc-lbl">SCENARIO</span>${esc(question.scenario)}`; wrap.appendChild(sc); }
    wrap.appendChild(el('ai-lbl')).textContent = 'TRAINING DATA';
    const train = el('ai-train'); wrap.appendChild(train);
    wrap.appendChild(el('ai-lbl')).textContent = 'SAMPLE POOL — click to add a labelled example to the training set';
    const poolEl = el('ai-pool'); wrap.appendChild(poolEl);
    const runBtn = el('ai-run', 'button'); runBtn.type = 'button'; runBtn.textContent = '▶ TRAIN & TEST THE AI'; wrap.appendChild(runBtn);
    const fb = el('ai-fb'); wrap.appendChild(fb);
    host.appendChild(wrap);

    function paintTrain() {
      train.innerHTML = '';
      groups.forEach(g => {
        const c = counts[g.id], a = acc(c), fair = a >= threshold;
        const row = el('ai-grow');
        let html = `<div class="ai-gtop"><span class="ai-gname">${esc(g.label)}</span><span class="ai-gcount">${c} sample${c === 1 ? '' : 's'}</span></div>`;
        if (tested) html += `<div class="ai-bar"><div class="ai-bar-fill ${fair ? 'ai-fair' : 'ai-biased'}" style="width:${a}%"></div></div><div class="ai-gacc ${fair ? 'ai-fair' : 'ai-biased'}">accuracy ${a}%${fair ? ' · fair ✓' : ' · BIASED'}</div>`;
        row.innerHTML = html;
        train.appendChild(row);
      });
    }
    function paintPool() {
      poolEl.innerHTML = '';
      if (!pool.length) { poolEl.appendChild(el('ai-pool-empty')).textContent = '(pool empty)'; return; }
      pool.forEach((gid, idx) => {
        const g = groups.find(x => x.id === gid);
        const chip = el('ai-chip', 'button'); chip.type = 'button'; chip.dataset.gid = gid; chip.textContent = `+ ${g ? g.label : gid}`;
        chip.addEventListener('click', () => {
          if (done) return;
          counts[gid]++; pool.splice(idx, 1); tested = false;
          fb.className = 'ai-fb'; fb.textContent = 'Added a sample to the training data — train the AI again to test it.';
          paintTrain(); paintPool(); (ctx.sfx.uiClick || ctx.sfx.bitClick)();
        });
        poolEl.appendChild(chip);
      });
    }

    runBtn.addEventListener('click', () => {
      if (done) return;
      tested = true; paintTrain();
      const biased = groups.filter(g => acc(counts[g.id]) < threshold);
      if (!biased.length) {
        done = true; wrap.classList.add('ai-done');
        poolEl.querySelectorAll('button').forEach(b => { b.disabled = true; }); runBtn.disabled = true;
        fb.className = 'ai-fb ai-fb-ok';
        fb.innerHTML = '✓ <b>FAIR AI</b> — every group is now well represented in the training data, so the AI works reliably for all of them. That is how you avoid <b>bias</b>: train on <b>balanced, representative data</b>.';
        ctx.sfx.zap(); ctx.onSubmit(true);
        return;
      }
      ctx.sfx.wrong(); fb.className = 'ai-fb ai-fb-no';
      const names = biased.map(b => esc(b.label));
      fb.innerHTML = `✗ <b>BIASED</b> — the AI barely handles ${names.join(' and ')}, because there's too little of that data. Add more <b>${names.join(' / ')}</b> samples and train again.`;
    });

    paintTrain(); paintPool();
  },
};
