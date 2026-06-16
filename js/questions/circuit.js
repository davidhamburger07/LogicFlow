// ============================================================
// questions/circuit.js — slot-based logic-circuit mini-game.
//
// The first bespoke question type. Same contract as mc.js/binary.js:
//   render(answerHost, question, ctx)  -> calls ctx.onSubmit(correct, details)
//
// The wiring of the circuit is FIXED. The player only chooses which
// gate type (AND / OR / XOR / NOT) goes in each slot, then runs it.
// A small simulator evaluates the filled circuit and accepts ANY
// arrangement that produces the target output (multiple solutions
// are allowed where they exist).
//
// Unlike MC/BINARY this module owns its own interactive visual
// (a canvas wire layer + HTML node overlay) instead of using the
// read-only visual.js panel — which the engine hides for CIRCUIT.
//
// Question schema (in content.js):
//   {
//     type: 'CIRCUIT',
//     inputs:  [{ id:'A', value:1 }, { id:'B', value:0 }],
//     gates:   [{ id:'G1', in:['A','B'] }, { id:'G2', in:['G1','C'] }],
//     output:  'G2',          // node id whose value feeds the output
//     target:  1,             // desired output value
//     palette: ['AND','OR','XOR'],
//     hints, explain, badge, board, title, desc ...
//   }
// ============================================================

const H = 240;           // builder height (px)
const PAD_X = 56;        // horizontal padding for input/output nodes

// pure gate logic — also supports NOT for future 1-input slots
function apply(gate, vals) {
  switch (gate) {
    case 'AND': return vals.every(v => v === 1) ? 1 : 0;
    case 'OR':  return vals.some(v => v === 1) ? 1 : 0;
    case 'XOR': return (vals.reduce((a, b) => a ^ b, 0) & 1) ? 1 : 0;
    case 'NOT': return vals[0] === 1 ? 0 : 1;
    default:    return null;
  }
}

let detach = null;   // teardown for the previous render's window listeners

export const circuit = {
  type: 'CIRCUIT',

  render(answerHost, question, ctx) {
    if (detach) { detach(); detach = null; }
    answerHost.innerHTML = '';

    const inputById = Object.fromEntries(question.inputs.map(i => [i.id, i]));
    const gateById = Object.fromEntries(question.gates.map(g => [g.id, g]));
    const placed = {};        // slotId -> gate type
    let armed = null;         // palette gate currently selected
    let locked = false;

    // ---- simulator ----------------------------------------
    function valueOf(id) {
      if (inputById[id]) return inputById[id].value;
      const g = gateById[id];
      const gate = placed[id];
      if (!gate) return null;
      const vals = g.in.map(valueOf);
      if (vals.some(v => v === null)) return null;
      return apply(gate, vals);
    }

    // ---- layout (depth-based) -----------------------------
    const depthCache = {};
    function depthOf(id) {
      if (id in depthCache) return depthCache[id];
      if (inputById[id]) return depthCache[id] = 0;
      return depthCache[id] = 1 + Math.max(...gateById[id].in.map(depthOf));
    }
    const maxGateDepth = Math.max(...question.gates.map(g => depthOf(g.id)));
    const stages = maxGateDepth + 1;   // +1 for the output column

    const byDepth = {};
    question.inputs.forEach(i => (byDepth[0] ||= []).push(i.id));
    question.gates.forEach(g => (byDepth[depthOf(g.id)] ||= []).push(g.id));

    const pos = {};            // id -> {x,y}, filled by relayout()
    function computePositions(width) {
      const leftX = PAD_X, rightX = width - PAD_X;
      const dx = (rightX - leftX) / stages;
      Object.entries(byDepth).forEach(([d, ids]) => {
        const x = leftX + dx * Number(d);
        ids.forEach((id, i) => { pos[id] = { x, y: H * (i + 1) / (ids.length + 1) }; });
      });
      pos['__OUT__'] = { x: rightX, y: H / 2 };
    }

    // wire list: every gate input + the final output wire
    const wires = [];
    question.gates.forEach(g => g.in.forEach(src => wires.push({ src, dst: g.id })));
    wires.push({ src: question.output, dst: '__OUT__' });

    // ---- DOM ----------------------------------------------
    const wrap = document.createElement('div');
    wrap.className = 'circuit';

    const builder = document.createElement('div');
    builder.className = 'circuit-builder';
    const canvas = document.createElement('canvas');
    canvas.className = 'circuit-wires';
    builder.appendChild(canvas);

    // input pills
    question.inputs.forEach(inp => {
      const el = document.createElement('div');
      el.className = 'circuit-node circuit-input' + (inp.value === 0 ? ' off' : '');
      el.textContent = `${inp.id}=${inp.value}`;
      el.dataset.node = inp.id;
      builder.appendChild(el);
    });

    // slot boxes
    question.gates.forEach(g => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'circuit-slot';
      el.dataset.slot = g.id;
      el.innerHTML = '<span class="slot-label">—</span>';
      builder.appendChild(el);
    });

    // output pill
    const outEl = document.createElement('div');
    outEl.className = 'circuit-node circuit-output';
    outEl.innerHTML = `<span class="out-val">?</span><span class="out-target">TARGET ${question.target}</span>`;
    builder.appendChild(outEl);

    // palette
    const palette = document.createElement('div');
    palette.className = 'circuit-palette';
    question.palette.forEach(gate => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'circuit-chip';
      chip.textContent = gate;
      chip.dataset.gate = gate;
      palette.appendChild(chip);
    });

    const hintLine = document.createElement('div');
    hintLine.className = 'circuit-hintline';
    hintLine.textContent = 'Tap a gate, then tap a slot — or drag it in. Clear a slot by tapping it.';

    const actions = document.createElement('div');
    actions.className = 'circuit-actions';
    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'circuit-run';
    runBtn.textContent = 'RUN CIRCUIT →';
    const msg = document.createElement('div');
    msg.className = 'circuit-msg';
    actions.appendChild(runBtn);
    actions.appendChild(msg);

    wrap.appendChild(builder);
    wrap.appendChild(palette);
    wrap.appendChild(hintLine);
    wrap.appendChild(actions);
    answerHost.appendChild(wrap);

    // ---- rendering ----------------------------------------
    function accent() {
      return getComputedStyle(document.documentElement).getPropertyValue('--phase-color').trim() || '#2563EB';
    }
    function colourFor(v) {
      if (v === 1) return accent();
      if (v === 0) return '#cbd5e1';
      return '#e5e7eb';
    }

    function place(slotId, gate) {
      if (locked) return;
      placed[slotId] = gate;
      ctx.sfx.bitClick(true);
      refresh();
    }
    function clearSlot(slotId) {
      if (locked) return;
      delete placed[slotId];
      ctx.sfx.bitClick(false);
      refresh();
    }

    function positionNodes() {
      builder.querySelectorAll('[data-node], [data-slot]').forEach(el => {
        const id = el.dataset.node || el.dataset.slot;
        const p = id === undefined ? null : pos[id];
        if (p) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; }
      });
      const op = pos['__OUT__'];
      outEl.style.left = op.x + 'px'; outEl.style.top = op.y + 'px';
    }

    function drawWires() {
      const c = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      c.clearRect(0, 0, w, h);
      wires.forEach(({ src, dst }) => {
        const a = pos[src], b = pos[dst];
        if (!a || !b) return;
        const v = valueOf(src);
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.strokeStyle = colourFor(v);
        c.lineWidth = v === 1 ? 3 : 1.5;
        c.setLineDash(v === null ? [4, 4] : []);
        c.stroke();
      });
      c.setLineDash([]);
      // node dots at inputs + gate outputs
      Object.keys(inputById).forEach(id => dot(c, pos[id], valueOf(id)));
      question.gates.forEach(g => dot(c, pos[g.id], valueOf(g.id)));
    }
    function dot(c, p, v) {
      if (!p) return;
      c.beginPath();
      c.arc(p.x, p.y, 4, 0, Math.PI * 2);
      c.fillStyle = v === 1 ? accent() : '#fff';
      c.strokeStyle = colourFor(v);
      c.lineWidth = 1.5;
      c.fill(); c.stroke();
    }

    function refresh() {
      // slot visuals
      builder.querySelectorAll('.circuit-slot').forEach(el => {
        const gate = placed[el.dataset.slot];
        el.classList.toggle('filled', !!gate);
        el.querySelector('.slot-label').textContent = gate || '—';
      });
      // output pill
      const out = valueOf(question.output);
      outEl.querySelector('.out-val').textContent = out === null ? '?' : out;
      outEl.classList.toggle('hit', out !== null && out === question.target);
      msg.textContent = '';
      drawWires();
    }

    function relayout() {
      const width = builder.clientWidth || 600;
      canvas.width = width;
      canvas.height = H;
      computePositions(width);
      positionNodes();
      drawWires();
    }

    // ---- interactions -------------------------------------
    function setArmed(gate) {
      armed = (armed === gate) ? null : gate;
      palette.querySelectorAll('.circuit-chip').forEach(ch => {
        ch.classList.toggle('armed', ch.dataset.gate === armed);
      });
    }

    palette.querySelectorAll('.circuit-chip').forEach(chip => {
      const gate = chip.dataset.gate;
      chip.addEventListener('click', () => {
        if (locked) return;
        if (chip._suppressClick) { chip._suppressClick = false; return; }
        setArmed(gate);
      });
      // pointer-drag (works for mouse + touch)
      chip.addEventListener('pointerdown', (e) => {
        if (locked) return;
        let moved = false;
        const sx = e.clientX, sy = e.clientY;
        const ghost = document.createElement('div');
        ghost.className = 'circuit-chip-ghost';
        ghost.textContent = gate;
        const hover = (slot) => builder.querySelectorAll('.circuit-slot').forEach(s => s.classList.toggle('drop-hover', s === slot));
        const move = (ev) => {
          if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4) {
            moved = true;
            document.body.appendChild(ghost);
          }
          if (moved) {
            ghost.style.left = ev.clientX + 'px';
            ghost.style.top = ev.clientY + 'px';
            const t = document.elementFromPoint(ev.clientX, ev.clientY);
            hover(t && t.closest('.circuit-slot'));
          }
        };
        const up = (ev) => {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
          ghost.remove();
          hover(null);
          if (moved) {
            chip._suppressClick = true;
            const t = document.elementFromPoint(ev.clientX, ev.clientY);
            const slot = t && t.closest('.circuit-slot');
            if (slot) place(slot.dataset.slot, gate);
          }
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });
    });

    builder.querySelectorAll('.circuit-slot').forEach(slot => {
      slot.addEventListener('click', () => {
        if (locked) return;
        const id = slot.dataset.slot;
        if (armed) place(id, armed);
        else if (placed[id]) clearSlot(id);
        else msg.textContent = 'Pick a gate below first, then tap this slot.';
      });
    });

    runBtn.addEventListener('click', () => {
      if (locked) return;
      const allFilled = question.gates.every(g => placed[g.id]);
      if (!allFilled) {
        msg.textContent = 'Place a gate in every slot first.';
        ctx.sfx.wrong();
        return;
      }
      const out = valueOf(question.output);
      const correct = out === question.target;
      locked = true;
      wrap.classList.add('locked');
      refresh();
      if (correct) ctx.sfx.zap();
      ctx.onSubmit(correct, correct ? {} : {
        feedbackOnWrong: `Your circuit output ${out}, but the target is ${question.target}.`,
      });
    });

    // ---- boot + responsive --------------------------------
    relayout();
    refresh();
    const onResize = () => relayout();
    window.addEventListener('resize', onResize);
    detach = () => window.removeEventListener('resize', onResize);
  },
};
