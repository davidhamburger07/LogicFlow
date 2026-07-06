// ============================================================
// questions/osmem.js — OSMEM: Be the OS · Memory Manager.
//
// The player does the operating system's memory-management job by hand. Apps
// ask to open (each needing some RAM) or close; the player ALLOCATEs RAM to a
// launching app, FREEs it when an app closes, and — when RAM is full — pages
// older data out to VIRTUAL MEMORY (disk, much slower) to make room. A live
// RAM bar shows the allocation. Makes memory management + virtual memory
// tangible instead of just defined.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'OSMEM', ram:8,
//     events:[ { kind:'launch', app:'Browser', size:2 }, { kind:'close', app:'Game' }, … ],
//     badge, board, title, desc, hints, explain }
// ============================================================

const PALETTE = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2'];

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export const osmem = {
  type: 'OSMEM',

  render(host, question, ctx) {
    host.innerHTML = '';
    const ram = question.ram || 8;
    const events = question.events || [];
    let pos = 0, done = false, busy = false, colr = 0;
    const used = [], paged = [];
    const freeRam = () => ram - used.reduce((s, u) => s + u.size, 0);

    const wrap = el('osm');
    wrap.appendChild(el('osm-lbl')).textContent = `RAM · ${ram} GB`;
    const bar = el('osm-ram'); wrap.appendChild(bar);
    const freeL = el('osm-free'); wrap.appendChild(freeL);
    wrap.appendChild(el('osm-lbl')).textContent = 'VIRTUAL MEMORY (disk — much slower)';
    const disk = el('osm-disk'); wrap.appendChild(disk);
    const event = el('osm-event'); wrap.appendChild(event);
    const actions = el('osm-actions'); wrap.appendChild(actions);
    const fb = el('osm-fb'); const prog = el('osm-prog');
    wrap.append(fb, prog);
    host.appendChild(wrap);

    function paint() {
      bar.innerHTML = '';
      used.forEach(u => {
        const seg = el('osm-seg'); seg.style.width = (u.size / ram * 100) + '%'; seg.style.background = u.colour;
        seg.innerHTML = `<span class="osm-seg-app">${esc(u.app)}</span><span class="osm-seg-sz">${u.size}GB</span>`;
        bar.appendChild(seg);
      });
      const f = freeRam();
      if (f > 0) { const fs = el('osm-seg osm-seg-free'); fs.style.width = (f / ram * 100) + '%'; fs.textContent = `${f} GB free`; bar.appendChild(fs); }
      freeL.innerHTML = `FREE: <b>${f} GB</b> of ${ram} GB`;
      disk.innerHTML = '';
      if (!paged.length) disk.appendChild(el('osm-disk-empty')).textContent = '(empty)';
      else paged.forEach(p => { const c = el('osm-chip'); c.style.borderColor = p.colour; c.textContent = `${p.app} · ${p.size}GB`; disk.appendChild(c); });
    }

    function correctAction() {
      const e = events[pos];
      if (e.kind === 'close') return 'free';
      return freeRam() >= e.size ? 'allocate' : 'vm';
    }

    function addBtn(action, label) {
      const b = el('osm-btn', 'button'); b.type = 'button'; b.dataset.act = action; b.textContent = label;
      b.addEventListener('click', () => resolve(action));
      actions.appendChild(b);
    }

    function renderEvent() {
      busy = false;
      const e = events[pos];
      wrap.dataset.answer = correctAction();   // harness / a11y hook
      prog.textContent = `EVENT ${pos + 1} OF ${events.length}`;
      actions.innerHTML = ''; fb.className = 'osm-fb'; fb.textContent = '';
      if (e.kind === 'launch') {
        event.innerHTML = `▸ <b>${esc(e.app)}</b> wants to open — it needs <b>${e.size} GB</b> of RAM.`;
        addBtn('allocate', `ALLOCATE ${e.size} GB`);
        addBtn('vm', 'USE VIRTUAL MEMORY');
      } else {
        event.innerHTML = `▸ You <b>close ${esc(e.app)}</b>. What does the OS do with its memory?`;
        addBtn('free', `FREE ${esc(e.app).toUpperCase()}'S MEMORY`);
      }
      paint();
    }

    function resolve(action) {
      if (done || busy) return;
      const e = events[pos], want = correctAction();
      if (action !== want) {
        ctx.sfx.wrong(); fb.className = 'osm-fb osm-fb-no';
        if (e.kind === 'launch' && action === 'allocate') fb.textContent = `Not enough free RAM — only ${freeRam()} GB is free but ${e.app} needs ${e.size}. Use virtual memory to make room.`;
        else if (e.kind === 'launch' && action === 'vm') fb.textContent = `There's still ${freeRam()} GB free — just allocate it. Don't page to disk unless RAM is full (it's much slower).`;
        else fb.textContent = 'That isn\'t the right action here.';
        return;
      }
      if (action === 'allocate') { used.push({ app: e.app, size: e.size, colour: PALETTE[colr++ % PALETTE.length] }); ok(`✓ ${e.app} allocated ${e.size} GB of RAM.`); }
      else if (action === 'vm') {
        while (freeRam() < e.size && used.length) paged.push(used.shift());   // page oldest out to disk
        used.push({ app: e.app, size: e.size, colour: PALETTE[colr++ % PALETTE.length] });
        ok(`✓ RAM was full, so the OS paged older data to virtual memory (disk) to fit ${e.app} — it runs, but slower.`);
      } else {
        const i = used.findIndex(u => u.app === e.app); if (i >= 0) used.splice(i, 1);
        else { const j = paged.findIndex(u => u.app === e.app); if (j >= 0) paged.splice(j, 1); }
        ok(`✓ ${e.app} closed — its memory is freed and returned to the pool.`);
      }
      ctx.sfx.zap();
      pos++;
      paint();
      if (pos >= events.length) {
        done = true; wrap.classList.add('osm-done');
        prog.textContent = '✓ ALL EVENTS HANDLED';
        event.innerHTML = '✓ You kept every program in memory and freed RAM as apps closed — that\'s <b>memory management</b>.';
        actions.innerHTML = '';
        ctx.onSubmit(true);
      } else { busy = true; setTimeout(renderEvent, 600); }
    }
    function ok(msg) { fb.className = 'osm-fb osm-fb-ok'; fb.innerHTML = msg; }

    renderEvent();
  },
};
