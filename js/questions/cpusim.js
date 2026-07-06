// ============================================================
// questions/cpusim.js — CPUSIM: wire the buses, drive the CPU.
//
// A hands-on von Neumann datapath. Instead of clicking a destination, the
// student CONNECTS A BUS: drag (or tap-tap) from one component to another to
// move the value along the address / data / control bus, stepping a full
// fetch → decode → execute of a LOAD instruction until the value lands in the
// ACCUMULATOR. Each register shows its live value; the active RAM cell lights.
//
// Forgiving: a wrong connection flashes and explains, but you retry — the sim
// clears only when the whole cycle is wired correctly.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'CPUSIM',
//     ram:[ {addr:'0', val:'LOAD 3'}, {addr:'3', val:'42'} ],   // shown memory cells
//     regs:{ PC:'0' },                                          // initial register values
//     steps:[ { stage:'FETCH'|'DECODE'|'EXECUTE', from:'PC', to:'MAR',
//               prompt:'…', set?:{MAR:'0'}, note?:'PC + 1' }, … ],
//     done:'…completion line…', badge, board, title, desc, hints, explain }
// ============================================================

const STAGES = ['FETCH', 'DECODE', 'EXECUTE'];
const STAGE_H = 360;
// component layout — x as a fraction of the stage width, y in px (centre point)
const LAYOUT = {
  RAM: { x: 0.11, y: 180, label: 'RAM', sub: 'MEMORY', ram: true },
  MAR: { x: 0.38, y: 66, label: 'MAR', sub: 'ADDRESS' },
  MDR: { x: 0.38, y: 180, label: 'MDR', sub: 'DATA' },
  PC:  { x: 0.38, y: 294, label: 'PC', sub: 'COUNTER' },
  CIR: { x: 0.62, y: 180, label: 'CIR', sub: 'INSTRUCTION' },
  ACC: { x: 0.62, y: 294, label: 'ACC', sub: 'ACCUMULATOR' },
  CU:  { x: 0.86, y: 66, label: 'CU', sub: 'CONTROL' },
  ALU: { x: 0.86, y: 294, label: 'ALU', sub: 'ARITHMETIC' },
};
// the datapath buses (undirected), coloured by type: address / data / control
const BUSES = [
  { a: 'PC', b: 'MAR', t: 'addr' }, { a: 'MAR', b: 'RAM', t: 'addr' }, { a: 'CU', b: 'MAR', t: 'addr' },
  { a: 'RAM', b: 'MDR', t: 'data' }, { a: 'MDR', b: 'CIR', t: 'data' }, { a: 'MDR', b: 'ACC', t: 'data' }, { a: 'ALU', b: 'ACC', t: 'data' },
  { a: 'CIR', b: 'CU', t: 'ctrl' }, { a: 'CU', b: 'ALU', t: 'ctrl' },
];
const BUS_COLOR = { addr: '#2563eb', data: '#d97706', ctrl: '#7c3aed' };

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function busBetween(a, b) { return BUSES.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)); }

let detach = null;

export const cpusim = {
  type: 'CPUSIM',

  render(host, question, ctx) {
    if (detach) { detach(); detach = null; }
    host.innerHTML = '';
    const steps = question.steps || [];
    const regs = Object.assign({}, question.regs);
    const ram = question.ram || [];
    let pos = 0, armed = null, dragFrom = null, dragging = false, moved = false, startXY = null, done = false;
    const completed = [];

    const wrap = el('cpu');
    const stageBar = el('cpu-stages');
    STAGES.forEach(s => { const c = el('cpu-stage-chip'); c.dataset.stage = s; c.textContent = s; stageBar.appendChild(c); });
    const legend = el('cpu-legend');
    legend.innerHTML = `<span class="cpu-leg cpu-leg-addr">▬ address bus</span><span class="cpu-leg cpu-leg-data">▬ data bus</span><span class="cpu-leg cpu-leg-ctrl">▬ control bus</span>`;
    const prompt = el('cpu-prompt');
    const stage = el('cpu-stage');
    const canvas = document.createElement('canvas'); canvas.className = 'cpu-wires'; stage.appendChild(canvas);

    const comps = {};
    Object.entries(LAYOUT).forEach(([id, c]) => {
      const b = el('cpu-comp' + (c.ram ? ' cpu-rambox' : ''));
      b.dataset.id = id; b.setAttribute('role', 'button'); b.tabIndex = 0;
      b.style.left = (c.x * 100) + '%'; b.style.top = c.y + 'px';
      if (c.ram) {
        b.innerHTML = `<span class="cpu-comp-label">${c.label}</span><span class="cpu-comp-sub">${c.sub}</span>`;
        const cells = el('cpu-cells');
        ram.forEach(r => { const cell = el('cpu-cell'); cell.dataset.addr = String(r.addr); cell.innerHTML = `<span class="cpu-cell-addr">${esc(r.addr)}</span><span class="cpu-cell-val">${esc(r.val)}</span>`; cells.appendChild(cell); });
        b.appendChild(cells);
      } else {
        b.innerHTML = `<span class="cpu-comp-label">${c.label}</span><span class="cpu-comp-sub">${c.sub}</span><span class="cpu-val">—</span>`;
      }
      b.addEventListener('pointerdown', e => onDown(id, e));
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(id); } });
      stage.appendChild(b); comps[id] = b;
    });

    const log = el('cpu-log');
    const prog = el('cpu-prog');
    const fb = el('cpu-fb');
    wrap.append(stageBar, legend, prompt, stage, fb, log, prog);
    host.appendChild(wrap);

    // ---------- drawing ----------
    function centre(id, w) { const c = LAYOUT[id]; return { x: c.x * w, y: c.y }; }
    function redraw(live) {
      const w = stage.clientWidth || 620;
      canvas.width = w; canvas.height = STAGE_H;
      const cx = canvas.getContext('2d');
      cx.clearRect(0, 0, w, STAGE_H);
      cx.lineCap = 'round';
      // faint skeleton, tinted by bus type
      BUSES.forEach(bus => {
        const pa = centre(bus.a, w), pb = centre(bus.b, w);
        cx.strokeStyle = BUS_COLOR[bus.t]; cx.globalAlpha = 0.16; cx.lineWidth = 3;
        cx.beginPath(); cx.moveTo(pa.x, pa.y); cx.lineTo(pb.x, pb.y); cx.stroke();
      });
      // completed buses, solid
      cx.globalAlpha = 1;
      completed.forEach(bus => {
        const pa = centre(bus.a, w), pb = centre(bus.b, w);
        cx.strokeStyle = BUS_COLOR[bus.t]; cx.lineWidth = 3.5;
        cx.beginPath(); cx.moveTo(pa.x, pa.y); cx.lineTo(pb.x, pb.y); cx.stroke();
      });
      // live drag wire
      if (live && dragFrom) {
        const pa = centre(dragFrom, w);
        cx.strokeStyle = '#64748b'; cx.globalAlpha = 0.9; cx.lineWidth = 2.5; cx.setLineDash([5, 5]);
        cx.beginPath(); cx.moveTo(pa.x, pa.y); cx.lineTo(live.x, live.y); cx.stroke();
        cx.setLineDash([]); cx.globalAlpha = 1;
      }
    }
    function packet(from, to, label) {
      const w = stage.clientWidth || 620; const a = centre(from, w), b = centre(to, w);
      const dot = el('cpu-packet'); dot.textContent = label || '';
      dot.style.left = a.x + 'px'; dot.style.top = a.y + 'px';
      stage.appendChild(dot);
      requestAnimationFrame(() => { dot.style.left = b.x + 'px'; dot.style.top = b.y + 'px'; });
      setTimeout(() => dot.remove(), 460);
    }

    function renderRegs() {
      Object.keys(LAYOUT).forEach(id => { if (LAYOUT[id].ram) return; const v = comps[id].querySelector('.cpu-val'); if (v) v.textContent = regs[id] == null || regs[id] === '' ? '—' : regs[id]; });
      // active RAM cell = the address currently in the MAR
      comps.RAM.querySelectorAll('.cpu-cell').forEach(c => c.classList.toggle('cpu-cell-active', c.dataset.addr === String(regs.MAR)));
    }

    function setStep() {
      const s = steps[pos];
      wrap.dataset.from = s.from; wrap.dataset.to = s.to;   // harness / a11y hook: current required connection
      stageBar.querySelectorAll('.cpu-stage-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.stage === s.stage));
      prompt.innerHTML = `<span class="cpu-stage-tag">${s.stage} · ${pos + 1}/${steps.length}</span>${s.prompt}`;
      prog.textContent = `STEP ${pos + 1} OF ${steps.length}`;
      Object.values(comps).forEach(b => b.classList.remove('cpu-src'));
      if (comps[s.from]) comps[s.from].classList.add('cpu-src');   // source glows
      renderRegs();
    }

    // ---------- interaction ----------
    function clearArmed() { armed = null; Object.values(comps).forEach(b => b.classList.remove('cpu-armed')); }
    function arm(id) {
      const s = steps[pos];
      if (s.from === s.to && id === s.from) { attempt(id, id); return; }   // self-op (e.g. PC increment) = one tap
      clearArmed(); armed = id; comps[id].classList.add('cpu-armed');
      (ctx.sfx.uiClick || ctx.sfx.bitClick)();
    }
    function tap(id) {                     // keyboard / click-click
      if (done) return;
      if (armed && armed !== id) { attempt(armed, id); clearArmed(); }
      else arm(id);
    }
    function onDown(id, e) {
      if (done || (e.button != null && e.button !== 0)) return;
      e.preventDefault();
      dragFrom = id; dragging = true; moved = false; startXY = { x: e.clientX, y: e.clientY };
      redraw({ x: LAYOUT[id].x * (stage.clientWidth || 620), y: LAYOUT[id].y });
    }
    function onMove(e) {
      if (!dragging) return;
      if (Math.hypot(e.clientX - startXY.x, e.clientY - startXY.y) > 6) moved = true;
      const r = stage.getBoundingClientRect();
      redraw({ x: e.clientX - r.left, y: e.clientY - r.top });
    }
    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      const upEl = document.elementFromPoint(e.clientX, e.clientY);
      const upComp = upEl && upEl.closest && upEl.closest('.cpu-comp');
      const upId = upComp && upComp.dataset.id;
      if (moved && upId && upId !== dragFrom) { attempt(dragFrom, upId); clearArmed(); }
      else if (!moved) { if (armed && armed !== dragFrom) { attempt(armed, dragFrom); clearArmed(); } else arm(dragFrom); }
      dragFrom = null; redraw();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    detach = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };

    function reject(from, to, s) {
      fb.className = 'cpu-fb cpu-fb-no';
      fb.textContent = `✗ That bus isn't right for this step. ${s.prompt}`;
      [from, to].forEach(id => { if (comps[id]) { comps[id].classList.remove('cpu-bad'); void comps[id].offsetWidth; comps[id].classList.add('cpu-bad'); } });
      ctx.sfx.wrong();
    }
    function attempt(from, to) {
      if (done) return;
      const s = steps[pos];
      const ok = s.from === s.to ? (from === s.from && to === s.from) : (from === s.from && to === s.to);
      if (!ok) { reject(from, to, s); return; }
      fb.className = 'cpu-fb'; fb.textContent = '';
      const bus = busBetween(from, to); if (bus && !completed.includes(bus)) completed.push(bus);
      const label = s.set ? Object.values(s.set)[0] : (s.note || '');
      comps[from].classList.remove('cpu-src');
      packet(from, to, label);
      (ctx.sfx.bitClick || ctx.sfx.uiClick)(true);
      setTimeout(() => {
        if (s.set) Object.assign(regs, s.set);
        comps[to].classList.add('cpu-lit'); setTimeout(() => comps[to].classList.remove('cpu-lit'), 500);
        const li = el('cpu-log-item'); li.textContent = s.note || `${s.from} → ${s.to}`; log.appendChild(li);
        pos++;
        renderRegs(); redraw();
        if (pos >= steps.length) finish(); else setStep();
      }, 300);
    }
    function finish() {
      done = true; wrap.classList.add('cpu-done');
      Object.values(comps).forEach(b => b.classList.remove('cpu-src', 'cpu-armed'));
      stageBar.querySelectorAll('.cpu-stage-chip').forEach(ch => ch.classList.add('active'));
      prompt.innerHTML = `<span class="cpu-stage-tag cpu-tag-done">DONE</span>${question.done || 'Cycle complete.'}`;
      prog.textContent = '✓ CYCLE COMPLETE';
      ctx.sfx.zap();
      ctx.onSubmit(true, {});
    }

    renderRegs();
    redraw();
    setStep();
    const onResize = () => redraw();
    window.addEventListener('resize', onResize);
    const prevDetach = detach;
    detach = () => { prevDetach(); window.removeEventListener('resize', onResize); };
  },
};
