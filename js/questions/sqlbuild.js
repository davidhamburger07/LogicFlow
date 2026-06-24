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
let sqlPromise = null;
function loadSql() {
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
    let db = null, done = false;

    const wrap = el('sq');
    wrap.appendChild(el('sq-label')).textContent = 'TABLE: ' + table;
    const srcBox = el('sq-src');
    srcBox.innerHTML = '<div class="sq-loading">loading database…</div>';
    wrap.appendChild(srcBox);

    const builder = el('sq-builder');
    const mkSel = opts => { const s = document.createElement('select'); s.className = 'sq-sel'; (opts || ['(none)']).forEach(o => { const op = document.createElement('option'); op.value = o; op.textContent = o; s.appendChild(op); }); return s; };
    const part = (label, ctrl) => { const p = el('sq-part'); p.appendChild(el('sq-kw')).textContent = label; p.appendChild(ctrl); return p; };
    const selSel = mkSel(question.selects);
    const selWhere = mkSel(question.wheres);
    const selOrder = mkSel(question.orders || ['(none)']);
    const fromTag = el('sq-from'); fromTag.textContent = table;
    builder.append(part('SELECT', selSel), part('FROM', fromTag), part('WHERE', selWhere), part('ORDER BY', selOrder));
    wrap.appendChild(builder);

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
      if (o && !/none/i.test(o)) q += ` ORDER BY ${o}`;
      return q;
    }
    function paintPreview() { preview.textContent = buildQuery() + ';'; }
    [selSel, selWhere, selOrder].forEach(s => s.addEventListener('change', () => { paintPreview(); resultBox.innerHTML = ''; (ctx.sfx.uiClick || ctx.sfx.bitClick)(); }));
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
      [selSel, selWhere, selOrder].forEach(s => { s.disabled = true; });
      runBtn.disabled = true; submit.disabled = true;
      if (correct) ctx.sfx.zap(); else ctx.sfx.wrong();
      ctx.onSubmit(correct, correct ? {} : { feedbackOnWrong: `One correct query is: ${question.answer}` });
    });

    loadSql().then(SQL => {
      db = new SQL.Database();
      db.run(question.setup);
      srcBox.innerHTML = tableHTML(db.exec('SELECT * FROM ' + table));
      runBtn.disabled = false; submit.disabled = false;
    }).catch(() => { srcBox.innerHTML = '<div class="sq-err">Could not load the database engine.</div>'; });
  },
};
