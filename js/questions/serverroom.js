// ============================================================
// questions/serverroom.js — SERVERROOM: a real-world skin over building a
// binary value (denary -> binary).
//
// The player boots a rack of servers by flipping 8 binary power switches
// (place values 128…1) so the total matches each server's gigabyte
// requirement, then pressing POWER. A correct match boots that server and
// advances to the next; the switches reset for a fresh build. Boot them all
// to win. Powering a server with the wrong total ends the run (first wrong =
// fail), like the other trace mini-games — so the binary build is practised
// in a concrete, motivating context.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'SERVERROOM', servers:[{ name:'WEB-01', target:12 }, …],
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
const PLACES = [128, 64, 32, 16, 8, 4, 2, 1];
function toBin(v) { return PLACES.map(pv => (v & pv) ? 1 : 0).join(''); }

export const serverroom = {
  type: 'SERVERROOM',

  render(host, question, ctx) {
    host.innerHTML = '';
    const servers = question.servers.map(s => ({ name: s.name, target: s.target, booted: false }));
    const bits = new Array(8).fill(0);
    let cur = 0, done = false;

    const wrap = el('sr');

    // the server rack
    const rack = el('sr-rack');
    const serverEls = servers.map(s => {
      const row = el('sr-server');
      row.innerHTML = `<span class="sr-name">${s.name}</span><span class="sr-need">${s.target} GB</span><span class="sr-status"></span>`;
      rack.appendChild(row);
      return row;
    });
    wrap.appendChild(rack);

    const totalLine = el('sr-total');
    wrap.appendChild(totalLine);

    // the 8 binary power switches
    const grid = el('sr-switches');
    const switchEls = PLACES.map((pv, i) => {
      const col = el('sr-switch');
      col.appendChild(el('sr-pv')).textContent = pv;
      const sw = el('sr-toggle', 'button');
      sw.type = 'button'; sw.textContent = '0'; sw.setAttribute('aria-label', `power line worth ${pv}`);
      sw.addEventListener('click', () => {
        if (done) return;
        bits[i] ^= 1;
        sw.textContent = String(bits[i]);
        sw.classList.toggle('on', !!bits[i]);
        (ctx.sfx.bitClick || ctx.sfx.uiClick)();
        paint();
      });
      col.appendChild(sw);
      grid.appendChild(col);
      return sw;
    });
    wrap.appendChild(grid);

    const powerBtn = el('sr-power', 'button');
    powerBtn.type = 'button';
    powerBtn.addEventListener('click', powerOn);
    wrap.appendChild(powerBtn);

    host.appendChild(wrap);

    const total = () => bits.reduce((s, b, i) => s + (b ? PLACES[i] : 0), 0);

    function paint() {
      const t = total();
      totalLine.innerHTML = `routing <b>${t}</b> GB`;
      serverEls.forEach((row, i) => {
        const active = i === cur && !servers[i].booted;
        row.classList.toggle('sr-current', active);
        row.classList.toggle('sr-booted', servers[i].booted);
        const matches = active && t === servers[i].target;
        row.querySelector('.sr-status').textContent = servers[i].booted ? '✓ ONLINE' : (active ? (matches ? '⚡ READY' : '◌ AWAITING') : '● OFFLINE');
      });
      powerBtn.disabled = done;
      powerBtn.textContent = cur < servers.length ? `⚡ POWER ON ${servers[cur].name}` : 'ALL SERVERS ONLINE';
    }
    paint();

    function lock() { done = true; switchEls.forEach(sw => { sw.disabled = true; }); powerBtn.disabled = true; }

    function powerOn() {
      if (done || cur >= servers.length) return;
      const want = servers[cur].target;
      if (total() === want) {
        servers[cur].booted = true;
        ctx.sfx.zap();
        cur++;
        bits.fill(0);
        switchEls.forEach(sw => { sw.textContent = '0'; sw.classList.remove('on'); });
        if (cur >= servers.length) { lock(); paint(); ctx.onSubmit(true); return; }
        paint();
      } else {
        lock(); paint();
        ctx.sfx.wrong();
        ctx.onSubmit(false, { feedbackOnWrong: `${servers[cur].name} needs ${want} GB but you routed ${total()}. ${want} = ${toBin(want)} in binary (${PLACES.filter(p => p & want).join(' + ')}).` });
      }
    }
  },
};
