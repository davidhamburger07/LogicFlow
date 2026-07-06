// ============================================================
// questions/iproute.js — IPROUTE: the Packet Router.
//
// The player IS a router. Each packet arrives with a destination IP address;
// they read it, look it up in the ROUTING TABLE, and forward it out the right
// port — external addresses take the DEFAULT ROUTE (the internet gateway), and
// a packet bound for a network that is DOWN can't be delivered, so it must be
// DROPPED. This drills the router's real job — forwarding by IP address —
// which is different from a switch forwarding by MAC within a LAN.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'IPROUTE',
//     ports:[ { id:'sales', label:'SALES LAN', net:'192.168.1', up:true },
//             { id:'gw', label:'INTERNET', net:'default', up:true, gateway:true } ],
//     packets:[ { ip:'192.168.1.45' }, … ],
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export const iproute = {
  type: 'IPROUTE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const ports = question.ports || [];
    const packets = question.packets || [];
    const gw = ports.find(p => p.gateway);
    let idx = 0, done = false, busy = false, delivered = 0, dropped = 0;

    // where should a given destination IP go?
    function correctFor(ip) {
      const local = ports.find(p => !p.gateway && ip.startsWith(p.net + '.'));
      if (local) return local.up ? local.id : 'DROP';
      return gw ? gw.id : 'DROP';
    }
    const localOf = ip => ports.find(p => !p.gateway && ip.startsWith(p.net + '.'));

    const wrap = el('ipr');
    const prog = el('ipr-prog');
    const pkt = el('ipr-packet');
    wrap.append(prog, pkt);
    wrap.appendChild(el('ipr-lbl')).textContent = 'ROUTING TABLE — send the packet where its IP belongs';
    const table = el('ipr-table');
    const rows = {};
    ports.forEach(p => {
      const r = el('ipr-port' + (p.up ? '' : ' ipr-down')); r.dataset.port = p.id; r.setAttribute('role', 'button'); r.tabIndex = 0;
      r.innerHTML = `<span class="ipr-name">${esc(p.label)}</span><span class="ipr-net">${p.gateway ? 'default route · anything else' : esc(p.net) + '.x'}</span><span class="ipr-stat">${p.up ? '● up' : '✕ DOWN'}</span>`;
      r.addEventListener('click', () => choose(p.id));
      r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(p.id); } });
      table.appendChild(r); rows[p.id] = r;
    });
    const drop = el('ipr-port ipr-dropbin'); drop.dataset.port = 'DROP'; drop.setAttribute('role', 'button'); drop.tabIndex = 0;
    drop.innerHTML = `<span class="ipr-name">✕ DROP</span><span class="ipr-net">network unreachable</span><span class="ipr-stat"></span>`;
    drop.addEventListener('click', () => choose('DROP'));
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose('DROP'); } });
    table.appendChild(drop); rows.DROP = drop;
    wrap.appendChild(table);
    const stats = el('ipr-stats'); const fb = el('ipr-fb');
    wrap.append(stats, fb);
    host.appendChild(wrap);

    function renderPacket() {
      busy = false;
      const ip = packets[idx].ip;
      wrap.dataset.answer = correctFor(ip);   // harness / a11y hook
      prog.textContent = `PACKET ${idx + 1} OF ${packets.length}`;
      pkt.innerHTML = `<span class="ipr-pkt-lbl">📦 INCOMING PACKET · DESTINATION IP</span><span class="ipr-ip">${esc(ip)}</span>`;
      stats.textContent = `Delivered ${delivered} · Dropped ${dropped}`;
      Object.values(rows).forEach(r => r.classList.remove('ipr-ok', 'ipr-bad'));
      fb.className = 'ipr-fb'; fb.textContent = '';
    }

    function choose(pid) {
      if (done || busy) return;
      const ip = packets[idx].ip, want = correctFor(ip);
      if (pid !== want) {
        const r = rows[pid]; r.classList.remove('ipr-bad'); void r.offsetWidth; r.classList.add('ipr-bad');
        fb.className = 'ipr-fb ipr-fb-no';
        fb.textContent = `✗ ${ip} doesn't go there. Match the IP to a network's range — and a DOWN network can't be reached.`;
        ctx.sfx.wrong();
        return;
      }
      rows[pid].classList.add('ipr-ok');
      if (pid === 'DROP') { dropped++; const dn = localOf(ip); fb.innerHTML = `✓ ${ip} is on the <b>${esc(dn.label)}</b> network (${dn.net}.x), which is <b>DOWN</b> — a router drops packets it can't deliver.`; }
      else if (gw && pid === gw.id) { delivered++; fb.innerHTML = `✓ ${ip} isn't on any local network — sent out the <b>default route</b> to the internet.`; }
      else { delivered++; const p = ports.find(x => x.id === pid); fb.innerHTML = `✓ ${ip} is on the <b>${esc(p.label)}</b> network (${p.net}.x) — forwarded out that port.`; }
      ctx.sfx.zap();
      stats.textContent = `Delivered ${delivered} · Dropped ${dropped}`;
      idx++;
      if (idx >= packets.length) {
        done = true; wrap.classList.add('ipr-done');
        prog.textContent = `✓ ALL ${packets.length} PACKETS ROUTED`;
        ctx.onSubmit(true);
      } else { busy = true; setTimeout(renderPacket, 700); }
    }

    renderPacket();
  },
};
