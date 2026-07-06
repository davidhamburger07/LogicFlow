// ============================================================
// questions/fde.js — Fetch–Decode–Execute cycle trace.
//
// Same contract as the other question types:
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// An animated von-Neumann CPU diagram. The student steps the cycle:
// at each micro-step the SOURCE register glows and they click the
// component the data moves to (PC→MAR, RAM→MDR, MDR→CIR, PC++,
// CU decodes, ALU executes). A pulse animates each transfer and a
// trace log builds up. First wrong click ends the trace.
//
// This module owns its own visual; the engine hides the read-only
// visual.js panel for FDE.
//
// Question schema (in content.js): just the ordered micro-steps —
// the standard CPU layout lives here.
//   { type:'FDE', steps:[{ stage:'FETCH'|'DECODE'|'EXECUTE',
//       from:'PC', answer:'MAR', prompt:'…', note?:'PC → MAR' }, …] }
// ============================================================

const STAGES = ['FETCH', 'DECODE', 'EXECUTE'];
const STAGE_H = 300;
// component layout: x as a fraction of the stage width, y in px
const LAYOUT = {
  RAM: { x: 0.10, y: 150, label: 'RAM', sub: 'MEMORY' },
  MAR: { x: 0.33, y: 84, label: 'MAR', sub: 'ADDRESS' },
  MDR: { x: 0.33, y: 216, label: 'MDR', sub: 'DATA' },
  PC:  { x: 0.56, y: 84, label: 'PC', sub: 'COUNTER' },
  CIR: { x: 0.56, y: 216, label: 'CIR', sub: 'INSTRUCTION' },
  CU:  { x: 0.81, y: 84, label: 'CU', sub: 'CONTROL' },
  ALU: { x: 0.81, y: 216, label: 'ALU', sub: 'ARITHMETIC' },
};
const SKELETON = [['RAM', 'MAR'], ['RAM', 'MDR'], ['PC', 'MAR'], ['MDR', 'CIR'], ['CIR', 'CU'], ['CU', 'ALU']];

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

let detach = null;

export const fde = {
  type: 'FDE',

  render(host, question, ctx) {
    if (detach) { detach(); detach = null; }
    host.innerHTML = '';
    const steps = question.steps;
    const walk = !!question.walk;   // WATCH mode: a NEXT button auto-plays each move (non-graded)
    let pos = 0, locked = false;

    const wrap = el('fde' + (walk ? ' fde-walk' : ''));
    const stageBar = el('fde-stages');
    STAGES.forEach(s => { const c = el('fde-stage-chip'); c.dataset.stage = s; c.textContent = s; stageBar.appendChild(c); });
    const prompt = el('fde-prompt');
    const stage = el('fde-stage');
    const canvas = document.createElement('canvas'); canvas.className = 'fde-wires'; stage.appendChild(canvas);
    const comps = {};
    Object.entries(LAYOUT).forEach(([id, c]) => {
      const b = el('fde-comp', 'button'); b.type = 'button'; b.dataset.id = id;
      b.style.left = (c.x * 100) + '%'; b.style.top = c.y + 'px';
      b.innerHTML = `<span class="fde-comp-label">${c.label}</span><span class="fde-comp-sub">${c.sub}</span>`;
      if (!walk) b.addEventListener('click', () => choose(id));
      stage.appendChild(b); comps[id] = b;
    });
    const log = el('fde-log');
    const prog = el('fde-prog');
    wrap.append(stageBar, prompt, stage, log, prog);
    host.appendChild(wrap);

    function drawSkeleton() {
      const w = stage.clientWidth || 560;
      canvas.width = w; canvas.height = STAGE_H;
      const c = canvas.getContext('2d');
      c.clearRect(0, 0, w, STAGE_H);
      c.strokeStyle = '#e5e7eb'; c.lineWidth = 2;
      SKELETON.forEach(([a, b]) => { const pa = LAYOUT[a], pb = LAYOUT[b]; c.beginPath(); c.moveTo(pa.x * w, pa.y); c.lineTo(pb.x * w, pb.y); c.stroke(); });
    }
    function pulse(from, to) {
      const a = LAYOUT[from], b = LAYOUT[to];
      const dot = el('fde-pulse');
      dot.style.left = (a.x * 100) + '%'; dot.style.top = a.y + 'px';
      stage.appendChild(dot);
      requestAnimationFrame(() => { dot.style.left = (b.x * 100) + '%'; dot.style.top = b.y + 'px'; });
      setTimeout(() => dot.remove(), 520);
    }
    const narrate = s => s.say || (s.from === s.answer
      ? `${LAYOUT[s.from].label} is incremented (${s.note || '+1'}).`
      : `${LAYOUT[s.from].label} → ${LAYOUT[s.answer].label}.`);
    function setStep() {
      const s = steps[pos];
      stageBar.querySelectorAll('.fde-stage-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.stage === s.stage));
      prompt.innerHTML = `<span class="fde-stage-tag">${s.stage}</span>${walk ? narrate(s) : s.prompt}`;
      prog.textContent = walk ? `STEP ${pos + 1} OF ${steps.length} — press NEXT` : `STEP ${pos + 1} OF ${steps.length}`;
      Object.values(comps).forEach(b => b.classList.remove('source'));
      if (comps[s.from]) comps[s.from].classList.add('source');   // the source register glows
    }
    function choose(id) {
      if (locked) return;
      const s = steps[pos];
      if (id !== s.answer) {
        locked = true; wrap.classList.add('locked');
        comps[id].classList.add('wrong');
        ctx.sfx.wrong();
        ctx.onSubmit(false, { feedbackOnWrong: `${s.stage}: the data moves to ${s.answer}, not ${id}.` });
        return;
      }
      comps[id].classList.add('done');
      comps[id].classList.remove('source');
      pulse(s.from, s.answer);
      ctx.sfx.bitClick(true);
      const li = el('fde-log-item');
      li.textContent = s.note || (s.from === s.answer ? `${s.answer} + 1` : `${s.from} → ${s.answer}`);
      log.appendChild(li);
      pos++;
      if (pos >= steps.length) {
        locked = true; wrap.classList.add('locked');
        ctx.sfx.zap();
        ctx.onSubmit(true, {});
      } else {
        setStep();
      }
    }

    // WATCH mode: a NEXT STEP button plays each move for the student, no grading.
    let nextBtn = null;
    function playStep() {
      if (locked) return;
      const s = steps[pos];
      comps[s.answer].classList.add('done');
      if (comps[s.from]) comps[s.from].classList.remove('source');
      pulse(s.from, s.answer);
      ctx.sfx.bitClick(true);
      const li = el('fde-log-item');
      li.textContent = s.note || (s.from === s.answer ? `${s.answer} + 1` : `${s.from} → ${s.answer}`);
      log.appendChild(li);
      pos++;
      if (pos >= steps.length) {
        locked = true; wrap.classList.add('locked');
        prompt.innerHTML = `<span class="fde-stage-tag">DONE</span>That is one full pass — now it is your turn to drive it.`;
        prog.textContent = '✓ COMPLETE';
        nextBtn.textContent = '✓ DONE'; nextBtn.disabled = true;
        ctx.sfx.zap();
        ctx.onSubmit(true, {});
      } else {
        setStep();
      }
    }
    if (walk) {
      nextBtn = el('fde-next', 'button'); nextBtn.type = 'button'; nextBtn.textContent = '▶ NEXT STEP';
      nextBtn.addEventListener('click', playStep);
      wrap.appendChild(nextBtn);
    }

    drawSkeleton();
    setStep();
    const onResize = () => drawSkeleton();
    window.addEventListener('resize', onResize);
    detach = () => window.removeEventListener('resize', onResize);
  },
};
