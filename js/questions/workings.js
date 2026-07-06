// ============================================================
// questions/workings.js — WORKINGS: read binary by TYPING the working out.
//
// Like PLACEVALUE, but instead of tapping the lit bits the student types
// the working into boxes. Two stages:
//   STAGE 1 — fill the addends:  [ _ ] + [ _ ] + [ _ ]   (the lit place
//             values, left to right). They must be right to continue.
//   STAGE 2 — add them up. Two flavours:
//             • default   → one answer box "?" unlocks; type the total.
//             • longAdd   → a stacked COLUMN ("long") addition appears: the
//                           addends are stacked right-aligned and the student
//                           fills the carry boxes and each result digit,
//                           column by column. Forgiving — wrong cells are
//                           flagged and retried until the sum is right.
//
// Producing the working (not just recognising it) is stronger recall and
// makes the method explicit. Reuses PLACEVALUE's place-value display.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'WORKINGS', bits:[1,0,1,1], longAdd?:bool, signed?:bool,
//     hidePlaces?:bool, badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export const workings = {
  type: 'WORKINGS',

  render(host, question, ctx) {
    host.innerHTML = '';
    const bits = question.bits.slice();                 // MSB-first 0/1 array
    const n = bits.length;
    const placeOf = i => { const p = 1 << (n - 1 - i); return (question.signed && i === 0) ? -p : p; };
    const litIdx = bits.map((b, i) => (b ? i : -1)).filter(i => i >= 0);
    const addends = litIdx.map(placeOf);                // the working-out terms, left to right
    const answer = addends.reduce((s, v) => s + v, 0);
    // longAdd only makes sense for a positive sum of ≥2 addends
    const longAdd = !!question.longAdd && !question.signed && answer > 0 && addends.length >= 2;

    const wrap = el('wk');

    // ── place-value display (read-only) — reuse PLACEVALUE's look ──
    const grid = el('pv-grid');
    bits.forEach((b, i) => {
      const col = el('pv-col');
      const place = el('pv-place' + (placeOf(i) < 0 ? ' pv-neg' : ''));
      place.textContent = question.hidePlaces ? '' : placeOf(i);
      const chip = el('pv-bit ' + (b ? 'lit' : 'off') + (placeOf(i) < 0 ? ' neg' : ''));
      chip.textContent = String(b);
      col.append(place, chip);
      grid.appendChild(col);
    });
    wrap.appendChild(grid);

    // ── STAGE 1 — the working-out line:  [_] + [_] + [_] (= [?] unless longAdd) ──
    const line = el('wk-line');
    const boxes = addends.map((_, k) => {
      const box = el('wk-box', 'input');
      box.type = 'text'; box.inputMode = 'numeric'; box.autocomplete = 'off';
      box.placeholder = '_'; box.setAttribute('aria-label', `working out term ${k + 1}`);
      if (k > 0) line.appendChild(el('wk-op', 'span')).textContent = '+';
      line.appendChild(box);
      return box;
    });
    let ans = null;
    if (!longAdd) {
      line.appendChild(el('wk-op', 'span')).textContent = '=';
      ans = el('wk-ans', 'input');
      ans.type = 'text'; ans.inputMode = 'numeric'; ans.autocomplete = 'off';
      ans.placeholder = '?'; ans.disabled = true; ans.setAttribute('aria-label', 'denary total');
      line.appendChild(ans);
    }
    wrap.appendChild(line);

    // ── STAGE 2 (longAdd) — the stacked column-addition grid (built on demand) ──
    const laHost = el('wk-la-host');
    wrap.appendChild(laHost);

    const fb = el('wk-fb'); wrap.appendChild(fb);

    const submit = el('wk-submit', 'button');
    submit.type = 'button'; submit.textContent = 'CHECK WORKING →';
    wrap.appendChild(submit);
    host.appendChild(wrap);

    let stage = 1;

    // expected result digit / incoming carry per power (0 = units), for longAdd
    const nCols = String(answer).length;
    const colDigit = (v, c) => Math.floor(v / Math.pow(10, c)) % 10;
    const resultDigit = [];
    const carryInto = [0];
    for (let c = 0; c < nCols; c++) {
      const s = addends.reduce((a, v) => a + colDigit(v, c), 0) + carryInto[c];
      resultDigit[c] = s % 10;
      carryInto[c + 1] = Math.floor(s / 10);
    }
    let carBoxes = [], resBoxes = [];

    function buildLongAdd() {
      laHost.innerHTML = '';
      const la = el('wk-la');
      const cell = (cls, txt) => { const c = el('wk-la-cell' + (cls ? ' ' + cls : '')); if (txt != null) c.textContent = txt; return c; };
      const digitInput = (cls, power) => {
        const inp = el(cls, 'input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.autocomplete = 'off';
        inp.maxLength = 1; inp.dataset.power = String(power);
        return inp;
      };

      // carry row (built here, appended BELOW the sum — the UK "carry under the
      // line" convention): a small box under every column except the units.
      const carryRow = el('wk-la-row wk-la-carryrow');
      carryRow.appendChild(cell('wk-la-op'));
      for (let d = 0; d < nCols; d++) {
        const p = nCols - 1 - d;
        const c = el('wk-la-cell');
        if (p >= 1) { const inp = digitInput('wk-la-carry', p); c.appendChild(inp); carBoxes.push(inp); }
        carryRow.appendChild(c);
      }

      // addend rows: each place value, right-aligned, blank in leading columns
      addends.forEach((v, ai) => {
        const row = el('wk-la-row');
        row.appendChild(cell('wk-la-op', ai === addends.length - 1 ? '+' : ''));
        const len = String(v).length;
        for (let d = 0; d < nCols; d++) {
          const p = nCols - 1 - d;
          row.appendChild(cell('wk-la-add', p < len ? String(colDigit(v, p)) : ''));
        }
        la.appendChild(row);
      });

      // rule line (stretches to the stack width)
      la.appendChild(el('wk-la-rule'));

      // result row: one input per column
      const resRow = el('wk-la-row');
      resRow.appendChild(cell('wk-la-op'));
      for (let d = 0; d < nCols; d++) {
        const p = nCols - 1 - d;
        const c = el('wk-la-cell');
        const inp = digitInput('wk-la-res', p); c.appendChild(inp); resBoxes.push(inp);
        resRow.appendChild(c);
      }
      la.appendChild(resRow);
      la.appendChild(carryRow);          // carries sit under the answer line
      laHost.appendChild(la);

      [...carBoxes, ...resBoxes].forEach(inp => inp.addEventListener('keydown', onEnter));
      setTimeout(() => { try { resBoxes[resBoxes.length - 1].focus(); } catch (e) {} }, 30);   // units first
    }

    function checkWorking() {
      const okEach = boxes.map((b, k) => b.value.trim() !== '' && Number(b.value) === addends[k]);
      if (boxes.some(b => b.value.trim() === '')) { shake(line); return; }
      boxes.forEach((b, k) => { b.classList.toggle('ok', okEach[k]); b.classList.toggle('bad', !okEach[k]); });
      if (okEach.every(Boolean)) {
        boxes.forEach(b => { b.disabled = true; });
        stage = 2; ctx.sfx.uiClick && ctx.sfx.uiClick();
        if (longAdd) {
          buildLongAdd();
          submit.textContent = 'CHECK ADDITION →';
          fb.className = 'wk-fb wk-ok'; fb.textContent = '✓ Working correct — now add it up, column by column.';
        } else {
          ans.disabled = false;
          submit.textContent = 'CHECK ANSWER →';
          fb.className = 'wk-fb wk-ok'; fb.textContent = '✓ Working correct — now add it up.';
          setTimeout(() => { try { ans.focus(); } catch (e) {} }, 30);
        }
      } else {
        fb.className = 'wk-fb wk-no'; fb.textContent = 'Not quite — type the place value of each lit (1) bit, left to right.';
        ctx.sfx.wrong();
      }
    }

    function checkAnswer() {
      if (ctx.isAnswered()) return;
      if (ans.value.trim() === '' || ans.value.trim() === '-') { shake(ans); return; }
      const correct = Number(ans.value) === answer;
      boxes.forEach(b => { b.disabled = true; }); ans.disabled = true; submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `${addends.join(' + ').replace(/\+ -/g, '− ')} = ${answer}.` });
    }

    // longAdd stage 2: forgiving — flag wrong cells and retry until the whole sum is right
    function checkLongAdd() {
      if (ctx.isAnswered()) return;
      if (resBoxes.some(b => b.value.trim() === '')) { shake(laHost); fb.className = 'wk-fb wk-no'; fb.textContent = 'Fill in every column of the answer (right to left).'; return; }
      let allOk = true;
      resBoxes.forEach(b => {
        const p = Number(b.dataset.power);
        const ok = Number(b.value) === resultDigit[p];
        b.classList.toggle('ok', ok); b.classList.toggle('bad', !ok);
        if (!ok) allOk = false;
      });
      carBoxes.forEach(b => {
        const p = Number(b.dataset.power);
        const exp = carryInto[p];
        const v = b.value.trim();
        const ok = exp === 0 ? (v === '' || Number(v) === 0) : (v !== '' && Number(v) === exp);
        b.classList.toggle('ok', ok && exp > 0); b.classList.toggle('bad', !ok);
        if (!ok) allOk = false;
      });
      if (allOk) {
        [...resBoxes, ...carBoxes].forEach(b => { b.disabled = true; });
        submit.disabled = true;
        fb.className = 'wk-fb wk-ok'; fb.textContent = `✓ ${addends.join(' + ')} = ${answer}.`;
        ctx.sfx.zap();
        ctx.onSubmit(true, {});
      } else {
        fb.className = 'wk-fb wk-no'; fb.textContent = 'Not quite — add each column (right to left) and carry any tens into the next column.';
        ctx.sfx.wrong();
      }
    }

    function shake(node) { node.classList.remove('wk-shake'); void node.offsetWidth; node.classList.add('wk-shake'); }

    function run() {
      if (ctx.isAnswered()) return;
      if (stage === 1) checkWorking();
      else if (longAdd) checkLongAdd();
      else checkAnswer();
    }
    function onEnter(e) { if (e.key === 'Enter') { e.preventDefault(); run(); } }

    submit.addEventListener('click', run);
    boxes.forEach(b => b.addEventListener('keydown', onEnter));
    if (ans) ans.addEventListener('keydown', onEnter);
    setTimeout(() => { try { boxes[0].focus(); } catch (e) {} }, 50);
  },
};
