// ============================================================
// questions/hwstore.js — HWSTORE: the Hardware Store.
//
// The AQA "recommend a storage type AND justify it with characteristics" skill
// as a game. Customers arrive with a real need ("cheap way to back up 5 TB to
// a vault"); the player SERVES the right device from the shelf (drag it onto
// the customer, or tap it), then JUSTIFIES the sale by picking the
// characteristics that made it the best choice (capacity / cost / speed /
// durability / portability / reliability). Serve every customer to clear.
//
// Forgiving: a wrong device or wrong justification explains and lets you retry.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'HWSTORE',
//     shelf:['ssd','hdd','tape','dvd','usb'],                 // product ids on the shelf
//     customers:[ { need:'…', answer:'tape', because:['capacity','cost'],
//                   wrongFb?:{ ssd:'…too expensive…' }, sold?:'…one-line reason…' }, … ],
//     badge, board, title, desc, hints, explain }
// ============================================================

const PRODUCTS = {
  ssd:  { name: 'Solid-State Drive', icon: '⚡', note: 'fast · durable · pricey per GB' },
  hdd:  { name: 'Hard Disk Drive', icon: '💽', note: 'big · cheap · moving parts' },
  tape: { name: 'Magnetic Tape', icon: '📼', note: 'huge · cheapest per TB · very slow' },
  dvd:  { name: 'Optical Disc', icon: '💿', note: 'cheap to mass-produce · low capacity' },
  usb:  { name: 'USB Flash Drive', icon: '🔌', note: 'tiny · portable · durable' },
  sd:   { name: 'SD Card', icon: '🗂️', note: 'tiny · portable' },
};
const CHARS = [['capacity', 'Capacity'], ['speed', 'Speed'], ['portability', 'Portability'], ['durability', 'Durability'], ['reliability', 'Reliability'], ['cost', 'Low cost']];

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

let detach = null;

export const hwstore = {
  type: 'HWSTORE',

  render(host, question, ctx) {
    if (detach) { detach(); detach = null; }
    host.innerHTML = '';
    const shelf = (question.shelf || Object.keys(PRODUCTS)).filter(id => PRODUCTS[id]);
    const customers = question.customers || [];
    let idx = 0, phase = 'serve', served = null, done = false;
    const justSel = new Set();

    const wrap = el('hw');
    const prog = el('hw-prog');
    const customer = el('hw-customer');
    const need = el('hw-need');
    const slot = el('hw-slot');
    customer.append(el('hw-avatar'), need, slot);
    customer.querySelector('.hw-avatar').textContent = '🧑';
    const justify = el('hw-justify');
    const fb = el('hw-fb');
    const shelfLbl = el('hw-lbl'); shelfLbl.textContent = 'SHELF — drag a product to the customer (or tap it)';
    const shelfEl = el('hw-shelf');
    shelf.forEach(id => {
      const p = PRODUCTS[id];
      const card = el('hw-prod'); card.dataset.pid = id; card.setAttribute('role', 'button'); card.tabIndex = 0;
      card.innerHTML = `<span class="hw-prod-icon">${p.icon}</span><span class="hw-prod-name">${esc(p.name)}</span><span class="hw-prod-note">${esc(p.note)}</span>`;
      card.addEventListener('pointerdown', e => onProdDown(id, e));
      card.addEventListener('click', () => { if (suppressClick) { suppressClick = false; return; } serve(id); });
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); serve(id); } });
      shelfEl.appendChild(card);
    });
    wrap.append(prog, customer, justify, fb, shelfLbl, shelfEl);
    host.appendChild(wrap);

    // ---------- drag (drop a product onto the customer) ----------
    let dragPid = null, dragging = false, moved = false, ghost = null, startXY = null, suppressClick = false;
    function makeGhost(id) { const g = el('hw-ghost'); g.textContent = PRODUCTS[id].icon + ' ' + PRODUCTS[id].name; document.body.appendChild(g); return g; }
    function onProdDown(id, e) { if (done || phase !== 'serve' || (e.button != null && e.button !== 0)) return; dragPid = id; dragging = true; moved = false; startXY = { x: e.clientX, y: e.clientY }; }
    function onMove(e) {
      if (!dragging) return;
      if (!moved && Math.hypot(e.clientX - startXY.x, e.clientY - startXY.y) > 6) { moved = true; ghost = makeGhost(dragPid); }
      if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
    }
    function onUp(e) {
      if (!dragging) return; dragging = false;
      if (ghost) { ghost.remove(); ghost = null; }
      if (moved) {
        const t = document.elementFromPoint(e.clientX, e.clientY);
        if (t && t.closest && t.closest('.hw-customer')) serve(dragPid);
        suppressClick = true; setTimeout(() => { suppressClick = false; }, 60);
      }
      dragPid = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    detach = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };

    // ---------- serve ----------
    function serve(pid) {
      if (done || phase !== 'serve') return;
      const cu = customers[idx];
      if (pid !== cu.answer) {
        fb.className = 'hw-fb hw-fb-no';
        fb.textContent = '✗ ' + ((cu.wrongFb && cu.wrongFb[pid]) || `A ${PRODUCTS[pid].name} isn't the best fit here — think about which characteristics this customer cares about.`);
        const card = shelfEl.querySelector(`.hw-prod[data-pid="${pid}"]`);
        if (card) { card.classList.remove('hw-bad'); void card.offsetWidth; card.classList.add('hw-bad'); }
        ctx.sfx.wrong();
        return;
      }
      served = pid; phase = 'justify';
      const p = PRODUCTS[pid];
      slot.innerHTML = `<span class="hw-served"><span class="hw-prod-icon">${p.icon}</span>${esc(p.name)}</span>`;
      shelfEl.querySelectorAll('.hw-prod').forEach(c => c.classList.toggle('hw-picked', c.dataset.pid === pid));
      fb.className = 'hw-fb'; fb.textContent = 'Good choice — now justify it.';
      (ctx.sfx.bitClick || ctx.sfx.uiClick)(true);
      renderJustify();
    }

    // ---------- justify ----------
    function renderJustify() {
      justSel.clear();
      justify.innerHTML = '';
      justify.style.display = 'flex';
      const lbl = el('hw-lbl'); lbl.textContent = 'WHY? — pick the characteristic(s) that make it the best choice';
      const chipRow = el('hw-chars');
      CHARS.forEach(([key, label]) => {
        const chip = el('hw-char'); chip.dataset.char = key; chip.type = 'button'; chip.textContent = label;
        chip.addEventListener('click', () => {
          if (justSel.has(key)) { justSel.delete(key); chip.classList.remove('on'); }
          else { justSel.add(key); chip.classList.add('on'); }
          (ctx.sfx.uiClick || ctx.sfx.bitClick)();
        });
        chipRow.appendChild(chip);
      });
      const confirm = el('hw-confirm', 'button'); confirm.type = 'button'; confirm.textContent = 'SELL IT →';
      confirm.addEventListener('click', confirmJustify);
      justify.append(lbl, chipRow, confirm);
    }
    function confirmJustify() {
      if (done || phase !== 'justify') return;
      const cu = customers[idx];
      const want = new Set(cu.because || []);
      const ok = justSel.size === want.size && [...justSel].every(x => want.has(x));
      if (!ok) {
        fb.className = 'hw-fb hw-fb-no';
        fb.textContent = '✗ Not the reason this customer cares about — which characteristic(s) actually matter to them?';
        ctx.sfx.wrong();
        return;
      }
      customer.classList.add('hw-sold');
      const names = (cu.because || []).map(k => (CHARS.find(c => c[0] === k) || [k, k])[1].toLowerCase()).join(' + ');
      fb.className = 'hw-fb hw-fb-ok';
      fb.innerHTML = `✓ <b>SOLD</b> — ${esc(cu.sold || `the ${PRODUCTS[served].name} wins on ${names}.`)}`;
      justify.querySelectorAll('button').forEach(b => { b.disabled = true; });
      ctx.sfx.zap();
      idx++;
      if (idx >= customers.length) { finish(); }
      else { phase = 'done-step'; setTimeout(renderCustomer, 850); }
    }

    function renderCustomer() {
      const cu = customers[idx];
      phase = 'serve'; served = null;
      wrap.dataset.answer = cu.answer; wrap.dataset.because = (cu.because || []).join(',');   // harness / a11y hook
      prog.textContent = `CUSTOMER ${idx + 1} OF ${customers.length}`;
      customer.classList.remove('hw-sold');
      need.innerHTML = `<span class="hw-quote">“${esc(cu.need)}”</span>`;
      slot.innerHTML = '<span class="hw-slot-hint">drop a product here</span>';
      justify.style.display = 'none'; justify.innerHTML = '';
      fb.className = 'hw-fb'; fb.textContent = '';
      shelfEl.querySelectorAll('.hw-prod').forEach(c => { c.classList.remove('hw-picked', 'hw-bad'); });
    }
    function finish() {
      done = true; wrap.classList.add('hw-done');
      prog.textContent = '✓ ALL CUSTOMERS SERVED';
      ctx.sfx.zap();
      ctx.onSubmit(true, {});
    }

    renderCustomer();
  },
};
