// ============================================================
// questions/sqledit.js — SQLEDIT: change the data (INSERT / UPDATE / DELETE).
//
// The write side of SQL (AQA / Eduqas): the player builds one data-modification
// statement from dropdowns, RUNs it against a real in-browser SQLite DB, and
// WATCHES the table change — a new row slides in (INSERT), a cell rewrites
// (UPDATE), or a row is struck out and removed (DELETE). CHECK re-runs both the
// player's statement and the model on a FRESH copy of the seed and passes when
// the resulting table matches (so any equivalent statement is accepted).
//
// Tag the content question `writeCommand: true` so the board slider marks it as
// optional extension work for the SELECT-only boards (see storage.boardRequiresSqlWrite).
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Schema:
//   { type:'SQLEDIT', command:'INSERT'|'UPDATE'|'DELETE', writeCommand:true,
//     setup:'CREATE TABLE …; INSERT …;', table:'Students', idField?:'Id',
//     insert?: { columns:['Id','Name','Year'], values:{ Id:[5,6], Name:['Sam','Zoe'], Year:[9,10,11] } },
//     update?: { setFields:['Year','Name'], setValues:[9,10,11,12], wheres:["Name = 'Ben'", 'Id = 2'] },
//     delete?: { wheres:["Name = 'Dan'", 'Id = 4'] },
//     answer:"INSERT INTO Students VALUES (5, 'Sam', 11)",   // the model statement
//     badge, board, title, desc, hints, explain }
// ============================================================

import { loadSql } from './sqlbuild.js';

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// quote a value: leave whole numbers bare, single-quote everything else
function q(v) { return /^-?\d+$/.test(String(v)) ? String(v) : `'${String(v).replace(/'/g, "''")}'`; }

export const sqledit = {
  type: 'SQLEDIT',

  render(host, question, ctx) {
    host.innerHTML = '';
    const table = question.table;
    const idField = question.idField || 'Id';
    const cmd = question.command;
    let SQLm = null, done = false, preState = null;

    const wrap = el('sqe');
    const tag = el('sqe-cmd'); tag.textContent = cmd + ' — change the data';
    wrap.appendChild(tag);
    wrap.appendChild(el('sqe-label')).textContent = 'TABLE: ' + table;
    const tableBox = el('sqe-table-box');
    tableBox.innerHTML = '<div class="sqe-loading">loading database…</div>';
    wrap.appendChild(tableBox);

    const builder = el('sqe-builder');
    wrap.appendChild(builder);
    const preview = el('sqe-preview');
    wrap.appendChild(preview);

    const actions = el('sqe-actions');
    const runBtn = el('sqe-run', 'button'); runBtn.type = 'button'; runBtn.textContent = '▶ RUN'; runBtn.disabled = true;
    const checkBtn = el('sqe-check', 'button'); checkBtn.type = 'button'; checkBtn.textContent = 'CHECK →'; checkBtn.disabled = true;
    actions.append(runBtn, checkBtn);
    wrap.appendChild(actions);
    const fb = el('sqe-fb');
    wrap.appendChild(fb);
    host.appendChild(wrap);

    // ---- statement builder (command-specific) ----
    const kw = t => { const s = el('sqe-kw', 'span'); s.textContent = t; return s; };
    const punct = t => { const s = el('sqe-punct', 'span'); s.textContent = t; return s; };
    const tbl = () => { const s = el('sqe-tbl', 'span'); s.textContent = table; return s; };
    function mkSel(opts) { const s = document.createElement('select'); s.className = 'sqe-sel'; (opts || []).forEach(o => { const op = document.createElement('option'); op.value = String(o); op.textContent = String(o); s.appendChild(op); }); return s; }

    let buildStmt = () => '';
    const line = el('sqe-stmt');
    if (cmd === 'INSERT') {
      const cfg = question.insert || {};
      const cols = cfg.columns || [];
      const ctrls = cols.map(c => mkSel((cfg.values && cfg.values[c]) || []));
      line.append(kw('INSERT INTO'), tbl(), kw('VALUES'), punct('('));
      ctrls.forEach((s, i) => { if (i) line.appendChild(punct(',')); line.appendChild(s); });
      line.appendChild(punct(')'));
      ctrls.forEach(s => s.addEventListener('change', paint));
      buildStmt = () => `INSERT INTO ${table} VALUES (${ctrls.map(s => q(s.value)).join(', ')})`;
    } else if (cmd === 'UPDATE') {
      const cfg = question.update || {};
      const fieldSel = mkSel(cfg.setFields || []);
      const valSel = mkSel(cfg.setValues || []);
      const whereSel = mkSel(cfg.wheres || []);
      line.append(kw('UPDATE'), tbl(), kw('SET'), fieldSel, punct('='), valSel, kw('WHERE'), whereSel);
      [fieldSel, valSel, whereSel].forEach(s => s.addEventListener('change', paint));
      buildStmt = () => `UPDATE ${table} SET ${fieldSel.value} = ${q(valSel.value)} WHERE ${whereSel.value}`;
    } else { // DELETE
      const cfg = question.delete || {};
      const whereSel = mkSel(cfg.wheres || []);
      line.append(kw('DELETE FROM'), tbl(), kw('WHERE'), whereSel);
      whereSel.addEventListener('change', paint);
      buildStmt = () => `DELETE FROM ${table} WHERE ${whereSel.value}`;
    }
    builder.appendChild(line);
    function paint() { preview.textContent = buildStmt() + ';'; if (preState) renderResult(preState, null); }

    // ---- DB helpers ----
    function freshDb() { const db = new SQLm.Database(); db.run(question.setup); return db; }
    function stateOf(db) { const r = db.exec(`SELECT * FROM ${table} ORDER BY ${idField}`); return r && r.length ? { columns: r[0].columns, values: r[0].values } : { columns: preState ? preState.columns : [], values: [] }; }
    function runStmt(stmt) { const db = freshDb(); let err = null; try { db.run(stmt); } catch (e) { err = e.message || String(e); } const st = stateOf(db); try { db.close(); } catch (e) { /* noop */ } return { st, err }; }
    function eqState(a, b) { const n = s => JSON.stringify([s.columns, s.values.map(r => r.map(String))]); return n(a) === n(b); }

    // ---- table render (with change animation) ----
    // post === null → just show the seed table (no diff), used before a RUN.
    function renderResult(pre, post) {
      const cols = pre.columns;
      const idIdx = cols.indexOf(idField);
      const th = cols.map(c => `<th>${esc(c)}</th>`).join('');
      let body;
      if (post && cmd === 'DELETE') {
        const postIds = new Set(post.values.map(r => r[idIdx]));
        body = pre.values.map(r => {
          const removed = !postIds.has(r[idIdx]);
          return `<tr class="${removed ? 'sqe-removed' : ''}">${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`;
        }).join('');
      } else if (post) {   // INSERT / UPDATE — show the resulting table
        const preById = new Map(pre.values.map(r => [r[idIdx], r]));
        body = post.values.map(r => {
          const preR = preById.get(r[idIdx]);
          const added = !preR;
          const cells = r.map((v, i) => `<td class="${!added && preR && String(v) !== String(preR[i]) ? 'sqe-changed' : ''}">${esc(v)}</td>`).join('');
          return `<tr class="${added ? 'sqe-added' : ''}">${cells}</tr>`;
        }).join('');
      } else {             // seed only
        body = pre.values.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
      }
      tableBox.innerHTML = `<table class="sqe-table"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
    }

    runBtn.addEventListener('click', () => {
      if (done || !SQLm) return;
      const res = runStmt(buildStmt());
      if (res.err) { fb.className = 'sqe-fb sqe-fb-no'; fb.textContent = 'That statement has an error — check the parts.'; ctx.sfx.wrong(); return; }
      renderResult(preState, res.st);
      const n = res.st.values.length, was = preState.values.length;
      const msg = cmd === 'INSERT' ? `Row added — ${was} → ${n} records.` : cmd === 'DELETE' ? `${was - n} record(s) removed — ${was} → ${n}.` : 'Record(s) updated — see the highlighted cell(s).';
      fb.className = 'sqe-fb'; fb.textContent = msg + ' CHECK when it matches the goal.';
      (ctx.sfx.uiClick || ctx.sfx.bitClick)();
    });

    checkBtn.addEventListener('click', () => {
      if (done || !SQLm) return;
      const player = runStmt(buildStmt());
      if (player.err) { fb.className = 'sqe-fb sqe-fb-no'; fb.textContent = 'That statement has an error — check the parts.'; ctx.sfx.wrong(); return; }
      const model = runStmt(question.answer);
      const correct = eqState(player.st, model.st);
      done = true;
      renderResult(preState, player.st);
      builder.querySelectorAll('select').forEach(s => { s.disabled = true; });
      runBtn.disabled = true; checkBtn.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `One correct statement is: ${question.answer}` });
    });

    loadSql().then(SQL => {
      SQLm = SQL;
      preState = stateOf(freshDb());
      renderResult(preState, null);
      paint();
      runBtn.disabled = false; checkBtn.disabled = false;
    }).catch(() => { tableBox.innerHTML = '<div class="sqe-err">Could not load the database engine.</div>'; });
  },
};
