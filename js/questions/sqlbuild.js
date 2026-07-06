// ============================================================
// questions/sqlbuild.js — SQLBUILD: build and RUN a real SQL query.
//
// SQL is a language you build and run — so the player assembles the
// SELECT / WHERE / ORDER BY clauses from dropdowns, RUNs the query against
// a real sample table (executed by sql.js — SQLite in the browser, lazy-
// loaded), and sees the result rows. CHECK compares their result to the
// model query's result (any query giving the same rows is accepted).
//
//   render(answerHost, question, ctx) -> ctx.onSubmit(correct, details)
//
// Question schema:
//   { type:'SQLBUILD',
//     setup:'CREATE TABLE Students(...); INSERT ...;',   // run once to seed
//     table:'Students',
//     selects:['Name','*','Name, Year'],
//     wheres:['(no filter)','Year = 11','Year > 9'],
//     orders:['(none)','Name','Year'],
//     answer:'SELECT Name FROM Students WHERE Year = 11',
//     badge, board, title, desc, hints, explain }
// ============================================================

function el(cls, tag = 'div') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// sql.js (SQLite-in-browser) — lazy-loaded on first SQLBUILD render.
// Exported so other DB question types (e.g. DBDETECTIVE) share the one engine.
let sqlPromise = null;
export function loadSql() {
  if (window.__SQLjs) return Promise.resolve(window.__SQLjs);
  if (sqlPromise) return sqlPromise;
  sqlPromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/sql-wasm.js';
    s.onload = () => { try { window.initSqlJs({ locateFile: f => 'js/vendor/' + f }).then(SQL => { window.__SQLjs = SQL; res(SQL); }).catch(rej); } catch (e) { rej(e); } };
    s.onerror = () => rej(new Error('failed to load sql-wasm.js'));
    document.head.appendChild(s);
  });
  return sqlPromise;
}

function tableHTML(execRes) {
  if (!execRes || !execRes.length) return '<div class="sq-empty">(no rows)</div>';
  const { columns, values } = execRes[0];
  const head = columns.map(c => `<th>${esc(c)}</th>`).join('');
  const body = values.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
  return `<table class="sq-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
// order-insensitive unless the model query uses ORDER BY
function normResult(execRes, ordered) {
  if (!execRes || !execRes.length) return '[]';
  const { columns, values } = execRes[0];
  let rows = values.map(r => JSON.stringify(r));
  if (!ordered) rows = rows.sort();
  return JSON.stringify([columns, rows]);
}

export const sqlbuild = {
  type: 'SQLBUILD',

  render(host, question, ctx) {
    host.innerHTML = '';
    const table = question.table;
    let db = null, done = false, master = null;

    const wrap = el('sq');
    wrap.appendChild(el('sq-label')).textContent = 'TABLE: ' + table + '  —  watch it change as you build the query';
    const srcBox = el('sq-src');
    srcBox.innerHTML = '<div class="sq-loading">loading database…</div>';
    wrap.appendChild(srcBox);
    const status = el('sq-status');
    wrap.appendChild(status);

    const builder = el('sq-builder');
    const mkSel = opts => { const s = document.createElement('select'); s.className = 'sq-sel'; (opts || ['(none)']).forEach(o => { const op = document.createElement('option'); op.value = o; op.textContent = o; s.appendChild(op); }); return s; };
    const part = (label, ctrl) => { const p = el('sq-part'); p.appendChild(el('sq-kw')).textContent = label; p.appendChild(ctrl); return p; };
    const selSel = mkSel(question.selects);
    const selWhere = mkSel(question.wheres);
    const selOrder = mkSel(question.orders || ['(none)']);
    const selDir = mkSel(['ASC', 'DESC']);   // sort direction (only used when a field is chosen)
    selDir.title = 'ASC = ascending (A→Z, low→high); DESC = descending';
    const fromTag = el('sq-from'); fromTag.textContent = table;
    const orderPart = part('ORDER BY', selOrder); orderPart.appendChild(selDir);
    builder.append(part('SELECT', selSel), part('FROM', fromTag), part('WHERE', selWhere), orderPart);
    wrap.appendChild(builder);
    // the direction only means something once a field is picked
    const syncDir = () => { selDir.disabled = !selOrder.value || /none/i.test(selOrder.value); };

    const preview = el('sq-preview');
    wrap.appendChild(preview);

    const runBtn = el('sq-run', 'button'); runBtn.type = 'button'; runBtn.textContent = '▶ RUN'; runBtn.disabled = true;
    wrap.appendChild(runBtn);
    const resultBox = el('sq-result');
    wrap.appendChild(resultBox);

    const submit = el('sq-submit', 'button'); submit.type = 'button'; submit.textContent = 'CHECK →'; submit.disabled = true;
    wrap.appendChild(submit);
    host.appendChild(wrap);

    function buildQuery() {
      const s = selSel.value, w = selWhere.value, o = selOrder.value;
      let q = `SELECT ${s} FROM ${table}`;
      if (w && !/no filter/i.test(w)) q += ` WHERE ${w}`;
      if (o && !/none/i.test(o)) q += ` ORDER BY ${o} ${selDir.value}`;
      return q;
    }
    function paintPreview() { preview.textContent = buildQuery() + ';'; }

    // Run a query for its raw row values; [] on any error (never throws mid-build).
    function runVals(sql) { try { const r = db.exec(sql); return r && r.length ? r[0].values : []; } catch (e) { return []; } }
    // Which columns the SELECT keeps — null means all (SELECT *).
    function selectedCols() { const v = selSel.value; if (/\*/.test(v)) return null; return v.split(',').map(s => s.trim()).filter(Boolean); }

    // Repaint the SOURCE table so the query's effect is VISIBLE as it's built:
    // unselected columns grey out (projection), rows the WHERE rejects fade and
    // strike through (selection), ORDER BY reorders them, and a status line says
    // exactly what each clause did.
    function paintSource() {
      if (!master) return;
      const sel = selectedCols();
      const w = selWhere.value, o = selOrder.value;
      const filtering = !!w && !/no filter/i.test(w);
      const matchSet = filtering ? new Set(runVals(`SELECT rowid FROM ${table} WHERE ${w}`).map(r => r[0])) : null;
      const ordering = !!o && !/none/i.test(o);
      let order = master.rows.map(r => r[0]);
      if (ordering) { const ord = runVals(`SELECT rowid FROM ${table} ORDER BY ${o} ${selDir.value}`).map(r => r[0]); if (ord.length === order.length) order = ord; }
      const byId = new Map(master.rows.map(r => [r[0], r]));
      const cols = master.cols;
      const colKept = cols.map(c => !sel || sel.includes(c));
      const head = cols.map((c, i) => `<th class="${colKept[i] ? '' : 'sq-col-drop'}">${esc(c)}</th>`).join('');
      const body = order.map(id => {
        const row = byId.get(id); if (!row) return '';
        const out = matchSet ? !matchSet.has(id) : false;
        const cells = cols.map((c, i) => `<td class="${colKept[i] ? '' : 'sq-col-drop'}">${esc(row[i + 1])}</td>`).join('');
        return `<tr class="${out ? 'sq-row-out' : (filtering ? 'sq-row-in' : '')}">${cells}</tr>`;
      }).join('');
      srcBox.innerHTML = `<table class="sq-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
      const total = master.rows.length;
      const shownCols = colKept.filter(Boolean).length;
      const bits = [];
      bits.push(filtering
        ? `<span class="sq-stat-hot">WHERE keeps ${matchSet.size} of ${total} row${total === 1 ? '' : 's'}</span>`
        : `<span>${total} row${total === 1 ? '' : 's'}</span>`);
      if (sel) bits.push(`<span class="sq-stat-hot">SELECT shows ${shownCols} of ${cols.length} column${cols.length === 1 ? '' : 's'}</span>`);
      status.innerHTML = bits.join('');
    }

    [selSel, selWhere, selOrder, selDir].forEach(s => s.addEventListener('change', () => { syncDir(); paintPreview(); paintSource(); resultBox.innerHTML = ''; (ctx.sfx.uiClick || ctx.sfx.bitClick)(); }));
    syncDir();
    paintPreview();

    runBtn.addEventListener('click', () => {
      if (!db) return;
      try { resultBox.innerHTML = '<div class="sq-result-label">RESULT</div>' + tableHTML(db.exec(buildQuery())); }
      catch (e) { resultBox.innerHTML = `<div class="sq-err">${esc(e.message || e)}</div>`; }
    });

    submit.addEventListener('click', () => {
      if (done || !db) return;
      done = true;
      const ordered = /order\s+by/i.test(question.answer);
      let correct = false;
      try { correct = normResult(db.exec(buildQuery()), ordered) === normResult(db.exec(question.answer), ordered); } catch (e) { correct = false; }
      [selSel, selWhere, selOrder, selDir].forEach(s => { s.disabled = true; });
      runBtn.disabled = true; submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `One correct query is: ${question.answer}` });
    });

    loadSql().then(SQL => {
      db = new SQL.Database();
      db.run(question.setup);
      // keep the full rowset (with rowid, so rows stay identifiable through
      // filtering/reordering) — paintSource repaints from this.
      const m = db.exec('SELECT rowid, * FROM ' + table);
      master = m && m.length ? { cols: m[0].columns.slice(1), rows: m[0].values } : { cols: [], rows: [] };
      paintSource();
      runBtn.disabled = false; submit.disabled = false;
    }).catch(() => { srcBox.innerHTML = '<div class="sq-err">Could not load the database engine.</div>'; });
  },
};
