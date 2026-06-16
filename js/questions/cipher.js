// ============================================================
// questions/cipher.js — Caesar cipher decoder wheel.
//
// Same contract as the other question types:
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// The player rotates a two-ring cipher wheel (drag it, use the
// ◂ ▸ step buttons, or arrow keys) to set a Caesar SHIFT. A live
// "decoded" strip updates as they turn — so a "find the shift"
// question is genuine cryptanalysis: try shifts until the plaintext
// reads as a word (a Caesar cipher has only 25 keys to test).
//
// Like the circuit builder, this module owns its own visual and the
// engine hides the read-only visual.js panel for CIPHER questions.
//
// Question schema (in content.js):
//   {
//     type: 'CIPHER',
//     mode: 'decode',      // 'decode' (given ciphertext) | 'encode'
//     text: 'FDW',         // the message shown to the player
//     shift: 3,            // the key (used for hints/explanation only)
//     answer: 'CAT',       // the text the wheel must produce
//     hints, explain, badge, board, title, desc ...
//   }
// ============================================================

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const STEP = 360 / 26;
const SZ = 220, CX = 110, CY = 110, R_OUT = 95, R_IN = 64;

function shiftChar(ch, d) {
  const c = ch.charCodeAt(0);
  if (c >= 65 && c <= 90)  return String.fromCharCode((c - 65 + (d % 26) + 26) % 26 + 65);
  if (c >= 97 && c <= 122) return String.fromCharCode((c - 97 + (d % 26) + 26) % 26 + 97);
  return ch;
}
function transform(text, mode, shift) {
  const d = mode === 'encode' ? shift : -shift;
  return [...text].map(ch => shiftChar(ch, d)).join('');
}
function polar(r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

export const cipher = {
  type: 'CIPHER',

  render(answerHost, question, ctx) {
    answerHost.innerHTML = '';
    const mode = question.mode || 'decode';
    let shift = 0;          // start unturned so the player must rotate
    let locked = false;

    const wrap = document.createElement('div');
    wrap.className = 'cipher';

    // ---- message + live decoded strip ----------------------
    const strip = document.createElement('div');
    strip.className = 'cipher-strip';
    const cipherRow = document.createElement('div');
    cipherRow.className = 'cipher-row cipher-given';
    const arrow = document.createElement('div');
    arrow.className = 'cipher-arrow';
    arrow.textContent = mode === 'encode' ? 'ENCODES TO ↓' : 'DECODES TO ↓';
    const plainRow = document.createElement('div');
    plainRow.className = 'cipher-row cipher-result';
    [...question.text].forEach(ch => {
      const a = document.createElement('span'); a.className = 'cipher-cell'; a.textContent = ch; cipherRow.appendChild(a);
      const b = document.createElement('span'); b.className = 'cipher-cell'; b.textContent = ch; plainRow.appendChild(b);
    });
    strip.appendChild(cipherRow);
    strip.appendChild(arrow);
    strip.appendChild(plainRow);

    // ---- the wheel -----------------------------------------
    const wheel = document.createElement('div');
    wheel.className = 'cipher-wheel';
    wheel.tabIndex = 0;
    wheel.style.width = SZ + 'px';
    wheel.style.height = SZ + 'px';

    const marker = document.createElement('div');
    marker.className = 'cipher-marker';
    wheel.appendChild(marker);

    const outer = document.createElement('div'); outer.className = 'cipher-ring cipher-outer';
    const inner = document.createElement('div'); inner.className = 'cipher-ring cipher-inner';
    const outerCells = [], innerCells = [];
    for (let i = 0; i < 26; i++) {
      const o = document.createElement('span'); o.className = 'cipher-letter'; o.textContent = ALPHA[i];
      const p = polar(R_OUT, i * STEP); o.style.left = p.x + 'px'; o.style.top = p.y + 'px';
      outer.appendChild(o); outerCells.push(o);
      const n = document.createElement('span'); n.className = 'cipher-letter'; n.textContent = ALPHA[i];
      inner.appendChild(n); innerCells.push(n);
    }
    wheel.appendChild(outer);
    wheel.appendChild(inner);

    const hub = document.createElement('div');
    hub.className = 'cipher-hub';
    hub.innerHTML = `<span class="cipher-hub-label">SHIFT</span><span class="cipher-shift-val">0</span>`;
    wheel.appendChild(hub);

    // ---- controls ------------------------------------------
    const controls = document.createElement('div');
    controls.className = 'cipher-controls';
    const minus = document.createElement('button'); minus.type = 'button'; minus.className = 'cipher-step'; minus.dataset.dir = '-1'; minus.textContent = '◂ SHIFT';
    const plus = document.createElement('button'); plus.type = 'button'; plus.className = 'cipher-step'; plus.dataset.dir = '1'; plus.textContent = 'SHIFT ▸';
    controls.appendChild(minus); controls.appendChild(plus);

    const hintLine = document.createElement('div');
    hintLine.className = 'cipher-hintline';
    hintLine.textContent = 'Drag the wheel, use ◂ ▸, or the arrow keys. Watch the decoded row change.';

    const actions = document.createElement('div');
    actions.className = 'cipher-actions';
    const submit = document.createElement('button'); submit.type = 'button'; submit.className = 'cipher-submit'; submit.textContent = (mode === 'encode' ? 'ENCODE →' : 'DECODE →');
    actions.appendChild(submit);

    wrap.appendChild(strip);
    wrap.appendChild(wheel);
    wrap.appendChild(controls);
    wrap.appendChild(hintLine);
    wrap.appendChild(actions);
    answerHost.appendChild(wrap);

    // ---- rendering -----------------------------------------
    function update() {
      const offset = -shift * STEP;       // rotate cipher ring so key letter sits at top
      innerCells.forEach((el, i) => {
        const p = polar(R_IN, i * STEP + offset);
        el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
      });
      // highlight the aligned pair at the top marker
      outerCells.forEach((el, i) => el.classList.toggle('key', i === 0));
      innerCells.forEach((el, i) => el.classList.toggle('key', i === ((shift % 26) + 26) % 26));

      hub.querySelector('.cipher-shift-val').textContent = shift;

      const result = transform(question.text, mode, shift);
      const cells = plainRow.querySelectorAll('.cipher-cell');
      const hit = result === question.answer;
      [...result].forEach((ch, i) => { if (cells[i]) cells[i].textContent = ch; });
      plainRow.classList.toggle('hit', hit);
    }

    function setShift(s) {
      if (locked) return;
      shift = ((s % 26) + 26) % 26;
      ctx.sfx.tick();
      update();
    }

    // ---- interactions --------------------------------------
    minus.addEventListener('click', () => setShift(shift - 1));
    plus.addEventListener('click', () => setShift(shift + 1));

    wheel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setShift(shift - 1); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setShift(shift + 1); }
    });

    // drag to rotate
    wheel.addEventListener('pointerdown', (e) => {
      if (locked) return;
      const rect = wheel.getBoundingClientRect();
      const ccx = rect.left + rect.width / 2, ccy = rect.top + rect.height / 2;
      const angleOf = (ev) => Math.atan2(ev.clientY - ccy, ev.clientX - ccx) * 180 / Math.PI;
      const startAng = angleOf(e), startShift = shift;
      const move = (ev) => {
        const delta = Math.round((angleOf(ev) - startAng) / STEP);
        setShift(startShift - delta);
      };
      const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });

    submit.addEventListener('click', () => {
      if (locked) return;
      const result = transform(question.text, mode, shift);
      const correct = result === question.answer;
      locked = true;
      wrap.classList.add('locked');
      update();
      if (correct) ctx.sfx.zap();
      ctx.onSubmit(correct, correct ? {} : {
        feedbackOnWrong: `At shift ${shift} the message reads "${result}". Keep turning the wheel.`,
      });
    });

    update();
  },
};