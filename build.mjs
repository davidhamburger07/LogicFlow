// ============================================================
// build.mjs — assemble a self-contained dist/ for CrazyGames upload.
//
//   node build.mjs   ->  dist/   (index.html at root + styles.css + js/)
//
// The game is plain static ES modules, so "building" is really just
// copying the runtime files into a clean folder (leaving dev tooling,
// docs and git out) and localising the one external font so the upload
// is fully self-contained. sql.js (js/vendor/) is already bundled.
// Zip dist/ and upload it — index.html sits at the zip root.
// ============================================================

import { mkdir, rm, cp, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';

async function dirSize(dir) {
  let total = 0, files = 0;
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) { const sub = await dirSize(p); total += sub.total; files += sub.files; }
    else { total += s.size; files++; }
  }
  return { total, files };
}

// 1. clean slate
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

// 2. copy the runtime files (js/ includes vendor/ = sql.js + wasm)
await cp('index.html', join(DIST, 'index.html'));
await cp('styles.css', join(DIST, 'styles.css'));
await cp('js', join(DIST, 'js'), { recursive: true });
console.log('copied index.html, styles.css, js/');

// 2b. CrazyGames build: blank the backend config so that upload has no
//     accounts/payments (external payment providers are not allowed there).
//     Default build = standalone site (keeps whatever config.js holds).
if (process.argv.includes('--crazygames')) {
  let cfg = await readFile(join(DIST, 'js', 'config.js'), 'utf8');
  cfg = cfg
    .replace(/export const SUPABASE_URL = '[^']*';/, `export const SUPABASE_URL = '';`)
    .replace(/export const SUPABASE_ANON_KEY = '[^']*';/, `export const SUPABASE_ANON_KEY = '';`);
  await writeFile(join(DIST, 'js', 'config.js'), cfg);
  console.log('CRAZYGAMES build: backend config blanked (free + ad-supported, no accounts)');
} else {
  console.log('STANDALONE SITE build: backend config kept as-is');
}

// 3. localise the Share Tech Mono font so nothing external is required
//    (best-effort — if offline, keep the Google Fonts link; it falls back
//     to system monospace anyway).
let fontMsg = 'font: kept Google Fonts link (offline or fetch failed) — falls back to monospace';
try {
  // a full Chrome UA is needed for Google to serve woff2; older/plain UAs get ttf.
  const cssRes = await fetch('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap',
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
  const css = await cssRes.text();
  const m = css.match(/url\((https:\/\/[^)]+\.(woff2|ttf))\)/);
  if (!m) throw new Error('no font url in font CSS');
  const ext = m[2], fmt = ext === 'woff2' ? 'woff2' : 'truetype';
  const font = Buffer.from(await (await fetch(m[1])).arrayBuffer());
  await mkdir(join(DIST, 'fonts'), { recursive: true });
  await writeFile(join(DIST, 'fonts', `share-tech-mono.${ext}`), font);
  let html = await readFile(join(DIST, 'index.html'), 'utf8');
  html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/,
    `<style>@font-face{font-family:'Share Tech Mono';font-style:normal;font-weight:400;font-display:swap;src:url('fonts/share-tech-mono.${ext}') format('${fmt}');}</style>`);
  await writeFile(join(DIST, 'index.html'), html);
  fontMsg = `font: bundled locally (fonts/share-tech-mono.${ext}, ${(font.length / 1024).toFixed(0)} KB)`;
} catch (e) { /* keep external link */ }
console.log(fontMsg);

// 4. size report (CrazyGames cap = 50 MB)
const { total, files } = await dirSize(DIST);
const mb = total / (1024 * 1024);
console.log(`\ndist/: ${files} files, ${mb.toFixed(2)} MB  (CrazyGames cap 50 MB — ${mb < 50 ? 'OK' : 'OVER'})`);
console.log('Next: zip the CONTENTS of dist/ (index.html at the zip root) and upload.');
