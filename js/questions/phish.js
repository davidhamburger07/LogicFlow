// ============================================================
// questions/phish.js — PHISH: the Phishing Inspector.
//
// A mock email is shown; the player must find every phishing RED FLAG by
// clicking it — a spoofed sender domain, a generic greeting, urgency/threats,
// a request for a password, bad grammar, and a link whose visible text hides a
// fake destination (HOVER the link to reveal where it really goes). Clicking a
// legitimate part just confirms it's fine (no penalty); finding all the flags
// clears the case. Teaches social-engineering awareness by doing, not reading.
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'PHISH', email:{
//       from:{ name, addr, flag, reason },
//       subject:{ text, flag, reason },
//       greeting:{ text, flag, reason },
//       lines:[ { text, flag, reason, safe? }, … ],
//       link:{ text, real, flag, reason },        // `real` = the true URL (hover reveals)
//       signoff:{ text, flag, reason },
//       verdict:'…summary…' },
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export const phish = {
  type: 'PHISH',

  render(host, question, ctx) {
    host.innerHTML = '';
    const email = question.email || {};
    // flatten the authored email into an ordered list of inspectable parts
    const parts = [];
    if (email.from) parts.push({ kind: 'from', ...email.from });
    if (email.subject) parts.push({ kind: 'subject', ...email.subject });
    if (email.greeting) parts.push({ kind: 'greeting', ...email.greeting });
    (email.lines || []).forEach(l => parts.push({ kind: 'line', ...l }));
    if (email.link) parts.push({ kind: 'link', ...email.link });
    if (email.signoff) parts.push({ kind: 'signoff', ...email.signoff });
    const flagsTotal = parts.filter(p => p.flag).length;
    let found = 0, done = false;
    const caught = new Set();

    const wrap = el('ph');
    const prompt = el('ph-prompt'); prompt.innerHTML = '📧 <b>Inspect this email.</b> Click every part that looks suspicious — and <b>hover a link</b> to see where it really goes.';
    wrap.appendChild(prompt);

    const mail = el('ph-email');
    const hdr = el('ph-hdr');
    parts.forEach((p, i) => {
      const node = el('ph-part ph-' + p.kind);
      node.dataset.i = String(i);
      if (p.flag) node.dataset.flag = '1';
      if (p.kind === 'from') node.innerHTML = `<span class="ph-k">FROM</span> <span class="ph-from-name">${esc(p.name)}</span> <span class="ph-from-addr">&lt;${esc(p.addr)}&gt;</span>`;
      else if (p.kind === 'subject') node.innerHTML = `<span class="ph-k">SUBJECT</span> <span class="ph-subj">${esc(p.text)}</span>`;
      else if (p.kind === 'link') { node.classList.add('ph-linkline'); node.innerHTML = `<a class="ph-a" href="#" onclick="return false">${esc(p.text)}</a>`; }
      else node.innerHTML = esc(p.text);
      node.addEventListener('click', e => { e.preventDefault(); inspect(i, node, p); });
      if (p.kind === 'link') {
        const a = node.querySelector('.ph-a');
        a.addEventListener('mouseenter', () => showUrl(p.real));
        a.addEventListener('mouseleave', () => showUrl(''));
      }
      (p.kind === 'from' || p.kind === 'subject') ? hdr.appendChild(node) : null;
      p._node = node;
    });
    mail.appendChild(hdr);
    const body = el('ph-body');
    parts.filter(p => p.kind !== 'from' && p.kind !== 'subject').forEach(p => body.appendChild(p._node));
    mail.appendChild(body);
    wrap.appendChild(mail);

    const urlbar = el('ph-urlbar'); urlbar.innerHTML = '<span class="ph-urlbar-hint">hover a link to preview its real address</span>';
    wrap.appendChild(urlbar);
    const count = el('ph-count'); count.textContent = `RED FLAGS FOUND: 0 / ${flagsTotal}`;
    const reason = el('ph-reason');
    wrap.append(count, reason);
    host.appendChild(wrap);

    function showUrl(real) {
      if (done) return;
      urlbar.innerHTML = real
        ? `🔗 this link really goes to → <span class="ph-realurl">${esc(real)}</span>`
        : '<span class="ph-urlbar-hint">hover a link to preview its real address</span>';
    }

    function inspect(i, node, p) {
      if (done) return;
      if (p.flag) {
        if (caught.has(i)) return;
        caught.add(i); found++;
        node.classList.add('ph-caught');
        count.textContent = `RED FLAGS FOUND: ${found} / ${flagsTotal}`;
        reason.className = 'ph-reason ph-reason-flag';
        reason.innerHTML = `⚠ <b>Red flag:</b> ${p.reason}`;
        (ctx.sfx.bitClick || ctx.sfx.uiClick)(true);
        if (found >= flagsTotal) verdict();
      } else {
        node.classList.add('ph-ok');
        reason.className = 'ph-reason ph-reason-ok';
        reason.innerHTML = `✓ <b>That part is fine:</b> ${p.safe || 'nothing suspicious about it — but keep checking the rest.'}`;
        (ctx.sfx.uiClick || ctx.sfx.bitClick)();
      }
    }

    function verdict() {
      done = true; wrap.classList.add('ph-done');
      reason.className = 'ph-reason ph-reason-win';
      reason.innerHTML = `⚠ <b>PHISHING — you found all ${flagsTotal} warning signs.</b> ${esc(email.verdict || '')}`;
      count.textContent = `✓ ALL ${flagsTotal} RED FLAGS SPOTTED`;
      ctx.sfx.zap();
      ctx.onSubmit(true);
    }
  },
};
