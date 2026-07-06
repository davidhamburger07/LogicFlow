// ============================================================
// questions/packet.js — packet-routing mini-game.
//
// Same contract as the other question types:
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// A small network of routers. The packet starts at the source; the
// student clicks connected routers to hop it to the destination,
// ROUTING AROUND down links (dashed/red), within a TTL hop budget.
//   - reach the destination            -> correct
//   - hop budget (TTL) hits 0 first    -> "packet dropped" (fail)
//
// This module owns its own visual; the engine hides the read-only
// visual.js panel for PACKET.
//
// Question schema (in content.js):
//   { type:'PACKET',
//     nodes:[{ id, x(0..1), y(px), label }],
//     links:[[a,b], …], down:[[a,b], …],
//     source, dest, ttl }
// ============================================================

const STAGE_H = 320;

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function key(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

let detach = null;

export const packet = {
  type: 'PACKET',

  render(host, question, ctx) {
    if (detach) { detach(); detach = null; }
    host.innerHTML = '';
    const nodes = question.nodes;
    const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
    const down = new Set((question.down || []).map(([a, b]) => key(a, b)));
    const adj = {};
    nodes.forEach(n => { adj[n.id] = new Set(); });
    question.links.forEach(([a, b]) => { if (!down.has(key(a, b))) { adj[a].add(b); adj[b].add(a); } });

    let current = question.source;
    let hopsLeft = question.ttl;
    let path = [question.source];
    let locked = false;
    const walk = !!question.walk;   // WATCH mode: a NEXT button auto-routes the packet (non-graded)

    const wrap = el('packet');
    const status = el('packet-status');
    const stage = el('packet-net');
    const canvas = document.createElement('canvas'); canvas.className = 'packet-wires'; stage.appendChild(canvas);
    const nodeEls = {};
    nodes.forEach(n => {
      const b = el('packet-node', 'button'); b.type = 'button'; b.dataset.id = n.id;
      b.style.left = (n.x * 100) + '%'; b.style.top = n.y + 'px';
      b.innerHTML = `<span class="packet-node-label">${n.label || n.id}</span>`;
      if (n.id === question.source) b.classList.add('is-source');
      if (n.id === question.dest) b.classList.add('is-dest');
      if (!walk) b.addEventListener('click', () => hop(n.id));
      stage.appendChild(b); nodeEls[n.id] = b;
    });
    const hint = el('packet-hintline');
    hint.textContent = 'Click a connected router to send the packet one hop. Dashed red links are down — route around them before the hop budget runs out.';
    wrap.append(status, stage, hint);
    host.appendChild(wrap);

    function draw() {
      const w = stage.clientWidth || 560;
      canvas.width = w; canvas.height = STAGE_H;
      const c = canvas.getContext('2d');
      c.clearRect(0, 0, w, STAGE_H);
      // all links (down = dashed red, working = grey)
      question.links.forEach(([a, b]) => {
        const pa = nodeById[a], pb = nodeById[b], isDown = down.has(key(a, b));
        c.beginPath(); c.moveTo(pa.x * w, pa.y); c.lineTo(pb.x * w, pb.y);
        c.setLineDash(isDown ? [6, 5] : []);
        c.strokeStyle = isDown ? '#ef4444' : '#cbd5e1';
        c.lineWidth = isDown ? 1.5 : 2;
        c.stroke();
      });
      c.setLineDash([]);
      // traveled path (phase accent)
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--phase-color').trim() || '#2563EB';
      for (let i = 0; i < path.length - 1; i++) {
        const pa = nodeById[path[i]], pb = nodeById[path[i + 1]];
        c.beginPath(); c.moveTo(pa.x * w, pa.y); c.lineTo(pb.x * w, pb.y);
        c.strokeStyle = accent; c.lineWidth = 4; c.stroke();
      }
    }
    function refresh() {
      Object.values(nodeEls).forEach(b => b.classList.remove('reachable', 'current'));
      nodeEls[current].classList.add('current');
      if (!locked && !walk) adj[current].forEach(id => nodeEls[id].classList.add('reachable'));
      status.innerHTML = `<span class="packet-stat">DEST: <strong>${question.dest}</strong></span>`
        + `<span class="packet-stat packet-hops${hopsLeft <= 1 ? ' low' : ''}">HOPS LEFT: <strong>${hopsLeft}</strong></span>`;
      draw();
    }
    function hop(id) {
      if (locked) return;
      if (!adj[current].has(id)) return;        // not a working neighbour — ignore the click
      current = id; path.push(id); hopsLeft--;
      ctx.sfx.bitClick(true);
      if (id === question.dest) {
        locked = true; wrap.classList.add('locked');
        nodeEls[id].classList.add('arrived');
        refresh();
        ctx.sfx.zap();
        ctx.onSubmit(true, {});
        return;
      }
      if (hopsLeft <= 0) {
        locked = true; wrap.classList.add('locked');
        refresh();
        ctx.sfx.wrong();
        ctx.onSubmit(false, { feedbackOnWrong: `Packet dropped — the hop budget (TTL) ran out before reaching ${question.dest}. Find a shorter route.` });
        return;
      }
      refresh();
    }

    // WATCH mode: auto-route the packet along the shortest working path, one
    // hop per NEXT press, narrating how it dodges the down link.
    function shortestPath(src, dst) {
      const prev = {}, seen = new Set([src]), queue = [src];
      while (queue.length) { const u = queue.shift(); if (u === dst) break; adj[u].forEach(v => { if (!seen.has(v)) { seen.add(v); prev[v] = u; queue.push(v); } }); }
      if (src !== dst && !(dst in prev)) return [src];
      const p = [dst]; let c = dst; while (c !== src) { c = prev[c]; p.unshift(c); } return p;
    }
    if (walk) {
      hint.style.display = 'none';
      const route = shortestPath(question.source, question.dest);
      let pos = 0, wdone = false;
      const note = el('packet-note');
      note.innerHTML = `The packet must reach <b>${question.dest}</b>, but a link is <b>down</b> (dashed red). Watch it <b>route around</b> the failure — press <b>NEXT STEP</b>.`;
      const btn = el('packet-next', 'button'); btn.type = 'button'; btn.textContent = '▶ NEXT STEP';
      btn.addEventListener('click', () => {
        if (wdone || pos >= route.length - 1) return;
        const to = route[pos + 1];
        current = to; path.push(to); hopsLeft--; pos++;
        ctx.sfx.bitClick(true); refresh();
        if (to === question.dest) {
          wdone = true; locked = true; wrap.classList.add('locked');
          nodeEls[to].classList.add('arrived'); refresh();
          note.innerHTML = `Arrived at <b>${question.dest}</b> — the packet <b>routed around</b> the dead link and got through. That resilience is the whole point of packet switching.`;
          btn.textContent = '✓ DONE'; btn.disabled = true;
          ctx.sfx.zap(); ctx.onSubmit(true, {});
        } else {
          const left = route.length - 1 - pos;
          note.innerHTML = `Hop to <b>${to}</b> — skipping the down link. <b>${left}</b> hop${left === 1 ? '' : 's'} to go.`;
        }
      });
      wrap.append(note, btn);
    }

    refresh();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    detach = () => window.removeEventListener('resize', onResize);
  },
};
