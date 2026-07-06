// ============================================================
// questions/dbdetective.js — DBDETECTIVE: write SQL to catch the culprit.
//
// A forensic "case file": witnesses give clues, a line-up of suspects sits in
// a real table, and the player writes a WHERE clause — one condition per clue,
// joined with AND / OR — to CLEAR the suspects who don't match until only the
// culprit is left. It's SELECT + WHERE + Boolean operators as a mystery, and
// generative (the player translates plain-English evidence into conditions).
//
// Runs against a real in-browser SQLite DB (sql.js, shared with SQLBUILD).
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'DBDETECTIVE',
//     setup:'CREATE TABLE Suspects(...); INSERT ...;',   // seeds the line-up
//     table:'Suspects',
//     target: 4,                 // the culprit's Id — exactly this one must remain
//     clues:['The suspect was TALL.', 'They wore GLASSES.', 'They fled in a VAN.'],
//     fields?:['Height','Hair','Glasses','Vehicle'],     // filterable cols (default: all but Id/Name)
//     ops?:['=','!='], idField?:'Id', nameField?:'Name',
//     badge, board, title, desc, hints, explain }
// ============================================================

import { loadSql } from './sqlbuild.js';

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function sqlText(v) { return `'${String(v).replace(/'/g, "''")}'`; }

export const dbdetective = {
  type: 'DBDETECTIVE',

  render(host, question, ctx) {
    host.innerHTML = '';
    const table = question.table;
    const idField = question.idField || 'Id';
    const nameField = question.nameField || 'Name';
    const ops = question.ops || ['=', '!='];
    let db = null, master = null, done = false;
    let fields = question.fields || null;
    const fieldValues = {};
    const conds = [];

    const wrap = el('dbd');

    // ── EVIDENCE (the clues) ──
    const evid = el('dbd-evidence');
    evid.appendChild(el('dbd-lbl')).textContent = 'EVIDENCE — witness statements';
    const clues = el('dbd-clues');
    (question.clues || []).forEach(c => { const chip = el('dbd-clue'); chip.textContent = c; clues.appendChild(chip); });
    evid.appendChild(clues);
    wrap.appendChild(evid);

    // ── THE LINE-UP ──
    const head = el('dbd-lineup-head');
    head.appendChild(el('dbd-lbl')).textContent = 'THE LINE-UP';
    const remaining = el('dbd-remaining');
    head.appendChild(remaining);
    wrap.appendChild(head);
    const lineup = el('dbd-lineup');
    lineup.innerHTML = '<div class="dbd-loading">assembling the line-up…</div>';
    wrap.appendChild(lineup);

    // ── QUERY BUILDER ──
    const builder = el('dbd-builder');
    const bl = el('dbd-lbl'); bl.innerHTML = `YOUR QUERY  <span class="dbd-fixed">SELECT * FROM ${esc(table)} WHERE</span>`;
    builder.appendChild(bl);
    const condHost = el('dbd-conds');
    builder.appendChild(condHost);
    const addBtn = el('dbd-add', 'button'); addBtn.type = 'button'; addBtn.textContent = '+ ADD CONDITION';
    builder.appendChild(addBtn);
    const preview = el('dbd-preview');
    builder.appendChild(preview);
    wrap.appendChild(builder);

    // ── ACTIONS ──
    const actions = el('dbd-actions');
    const runBtn = el('dbd-run', 'button'); runBtn.type = 'button'; runBtn.textContent = '▶ RUN FILTER'; runBtn.disabled = true;
    const solveBtn = el('dbd-solve', 'button'); solveBtn.type = 'button'; solveBtn.textContent = '🔎 SOLVE CASE →'; solveBtn.disabled = true;
    actions.append(runBtn, solveBtn);
    wrap.appendChild(actions);
    const fb = el('dbd-fb');
    wrap.appendChild(fb);
    host.appendChild(wrap);

    // ---- condition rows ----
    function mkSel(opts, cls) { const s = document.createElement('select'); s.className = 'dbd-sel' + (cls ? ' ' + cls : ''); (opts || []).forEach(o => { const op = document.createElement('option'); op.value = o; op.textContent = o; s.appendChild(op); }); return s; }
    function setValOpts(sel, field) { sel.innerHTML = ''; (fieldValues[field] || []).forEach(v => { const op = document.createElement('option'); op.value = v; op.textContent = v; sel.appendChild(op); }); }

    function makeCond() {
      const fieldSel = mkSel(fields);
      const opSel = mkSel(ops, 'dbd-op');
      const valSel = mkSel(fieldValues[fields[0]]);
      const joinSel = mkSel(['AND', 'OR'], 'dbd-join');
      const rm = el('dbd-rm', 'button'); rm.type = 'button'; rm.textContent = '✕'; rm.title = 'remove condition';
      const entry = { fieldSel, opSel, valSel, joinSel, rm };
      fieldSel.addEventListener('change', () => { setValOpts(valSel, fieldSel.value); paintPreview(); });
      [opSel, valSel, joinSel].forEach(s => s.addEventListener('change', paintPreview));
      rm.addEventListener('click', () => { const i = conds.indexOf(entry); if (i >= 0) { conds.splice(i, 1); renderConds(); paintPreview(); (ctx.sfx.uiClick || ctx.sfx.bitClick)(); } });
      return entry;
    }
    function renderConds() {
      condHost.innerHTML = '';
      conds.forEach((c, i) => {
        const row = el('dbd-cond');
        if (i > 0) row.appendChild(c.joinSel);
        row.append(c.fieldSel, c.opSel, c.valSel, c.rm);
        condHost.appendChild(row);
      });
      addBtn.disabled = conds.length >= Math.min(4, fields.length);
    }
    addBtn.addEventListener('click', () => { if (conds.length >= Math.min(4, fields.length)) return; conds.push(makeCond()); renderConds(); paintPreview(); (ctx.sfx.uiClick || ctx.sfx.bitClick)(); });

    function buildWhere() {
      if (!conds.length) return '';
      return conds.map((c, i) => (i > 0 ? ` ${c.joinSel.value} ` : '') + `${c.fieldSel.value} ${c.opSel.value} ${sqlText(c.valSel.value)}`).join('');
    }
    function buildQuery() { const w = buildWhere(); return `SELECT * FROM ${table}` + (w ? ` WHERE ${w}` : ''); }
    function paintPreview() { preview.textContent = buildQuery() + ';'; resetStamps(); }

    // matching ids for the current WHERE (empty where = everyone)
    function matchIds() {
      const w = buildWhere();
      try { const r = db.exec(`SELECT ${idField} FROM ${table}` + (w ? ` WHERE ${w}` : '')); return r && r.length ? r[0].values.map(x => x[0]) : []; }
      catch (e) { return null; }   // null = query error
    }

    // ---- the line-up render ----
    function paintLineup(keep, guiltyId) {
      const cols = master.cols;   // [Name, ...fields]
      const th = '<th class="dbd-stat-h"></th>' + cols.map(c => `<th>${esc(c)}</th>`).join('');
      const body = master.rows.map(row => {
        const id = row[0];
        const cleared = keep ? !keep.has(id) : false;
        const guilty = guiltyId != null && id === guiltyId;
        const cells = cols.map((c, i) => `<td>${esc(row[i + 1])}</td>`).join('');
        const stamp = guilty ? '<span class="dbd-stamp dbd-stamp-guilty">GUILTY</span>' : (cleared ? '<span class="dbd-stamp">CLEARED</span>' : '');
        const cls = guilty ? 'dbd-guilty' : (cleared ? 'dbd-cleared' : 'dbd-suspect');
        return `<tr class="${cls}"><td class="dbd-stat">${stamp}</td>${cells}</tr>`;
      }).join('');
      lineup.innerHTML = `<table class="dbd-table"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
      const n = keep ? keep.size : master.rows.length;
      remaining.textContent = `SUSPECTS REMAINING: ${n}`;
      remaining.classList.toggle('dbd-one', n === 1);
    }
    // clear the CLEARED/GUILTY stamps when the query changes (until they RUN again)
    function resetStamps() { if (master) paintLineup(null, null); }

    runBtn.addEventListener('click', () => {
      if (done || !db) return;
      const ids = matchIds();
      if (ids === null) { fb.className = 'dbd-fb dbd-fb-no'; fb.textContent = 'That query has an error — check the conditions.'; ctx.sfx.wrong(); return; }
      paintLineup(new Set(ids), null);
      if (ids.length === 0) { fb.className = 'dbd-fb dbd-fb-no'; fb.textContent = 'No one matches — you\'ve cleared every suspect. Loosen a condition.'; ctx.sfx.wrong(); }
      else if (ids.length === 1) { fb.className = 'dbd-fb'; fb.textContent = 'One suspect left. If they fit every clue, close the case.'; (ctx.sfx.uiClick || ctx.sfx.bitClick)(); }
      else { fb.className = 'dbd-fb'; fb.textContent = `${ids.length} suspects still fit — add another clue to narrow it down.`; (ctx.sfx.uiClick || ctx.sfx.bitClick)(); }
    });

    solveBtn.addEventListener('click', () => {
      if (done || !db) return;
      const ids = matchIds();
      if (ids === null) { fb.className = 'dbd-fb dbd-fb-no'; fb.textContent = 'That query has an error — check the conditions.'; ctx.sfx.wrong(); return; }
      const keep = new Set(ids);
      if (ids.length === 1 && ids[0] === question.target) {
        done = true;
        const name = (master.rows.find(r => r[0] === question.target) || [])[1] || 'the suspect';
        paintLineup(keep, question.target);
        fb.className = 'dbd-fb dbd-fb-ok'; fb.innerHTML = `✓ <b>CASE CLOSED</b> — ${esc(name)} matches every clue.`;
        [addBtn, runBtn, solveBtn].forEach(b => { b.disabled = true; });
        wrap.querySelectorAll('.dbd-sel, .dbd-rm').forEach(s => { s.disabled = true; });
        ctx.sfx.zap();
        ctx.onSubmit(true, {});
        return;
      }
      // not solved — nudge, but let them keep working (no life lost)
      paintLineup(keep, null);
      if (ids.length === 0) { fb.className = 'dbd-fb dbd-fb-no'; fb.textContent = 'No suspects match — you\'ve cleared everyone. Loosen a condition.'; }
      else if (ids.length > 1) { fb.className = 'dbd-fb dbd-fb-no'; fb.textContent = `Still ${ids.length} suspects fit — the evidence should leave exactly one.`; }
      else { fb.className = 'dbd-fb dbd-fb-no'; fb.textContent = 'That suspect doesn\'t fit all the evidence — re-read the clues.'; }
      ctx.sfx.wrong();
    });

    loadSql().then(SQL => {
      db = new SQL.Database();
      db.run(question.setup);
      // read the whole table once (a SELECT with rows reliably returns columns;
      // sql.js returns [] for a zero-row result, so derive everything from here).
      const full = db.exec(`SELECT * FROM ${table}`);
      const res = full && full.length ? full[0] : { columns: [], values: [] };
      const allCols = res.columns;
      if (!fields) fields = allCols.filter(c => c !== idField && c !== nameField);
      const idIdx = allCols.indexOf(idField), nameIdx = allCols.indexOf(nameField);
      const fieldIdx = fields.map(f => allCols.indexOf(f));
      master = { cols: [nameField, ...fields], rows: res.values.map(r => [r[idIdx], r[nameIdx], ...fieldIdx.map(ix => r[ix])]) };
      fields.forEach((f, k) => { const ix = fieldIdx[k]; fieldValues[f] = [...new Set(res.values.map(r => String(r[ix])))].sort(); });
      paintLineup(null, null);
      conds.push(makeCond());
      renderConds();
      paintPreview();
      runBtn.disabled = false; solveBtn.disabled = false;
    }).catch(() => { lineup.innerHTML = '<div class="dbd-err">Could not load the database engine.</div>'; });
  },
};
