/* =====================================================================
   VoucherVault: export a self-contained preview copy of the built site
   (for a private claude.ai preview link before launch).

     node tools/build.js
     node tools/preview-export.js <out dir>

   The live site uses root-relative links ("/reviews/"). A preview is served
   from a sub-path, so this rewrites every href/src/action that starts with
   "/" into a relative path ending in index.html, points search at the
   relative search-index.json, and marks every page noindex.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '..', 'preview-vouchervault'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.build-manifest.json'), 'utf8'));
const pages = manifest.filter(f => f.endsWith('.html'));
const assets = ['assets/site.css', 'assets/site.js', 'assets/favicon.svg', 'assets/codes.json', 'search-index.json'];

fs.rmSync(OUT, { recursive: true, force: true });
const write = (rel, text) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };

// "/x/y/?q#h" → "../../x/y/index.html?q#h" relative to the page's folder
function rel(url, depth) {
  const m = url.match(/^\/([^?#]*)([?#].*)?$/);
  let p = m[1], rest = m[2] || '';
  if (p === '' || p.endsWith('/')) p += 'index.html';
  return '../'.repeat(depth) + p + rest;
}

// Preview viewers only allow the preview's own files, so every Unsplash photo is downloaded
// once (1200px wide) into assets/img/<photo-id>.jpg and srcset attributes are dropped.
const UNSPLASH = /https:\/\/images\.unsplash\.com\/(photo-[0-9a-f-]+)(\?[^"\s,]*)?/g;
const photos = new Set();
const localImg = (id, depth) => `${'../'.repeat(depth)}assets/img/${id}.jpg`;

for (const file of pages) {
  const depth = file.split('/').length - 1;
  let html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  html = html.replace(/\b(href|src|action)="(\/(?!\/)[^"]*)"/g, (m, attr, url) => `${attr}="${rel(url, depth)}"`);
  html = html.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, nofollow">');
  html = html.replace(/ srcset="[^"]*images\.unsplash\.com[^"]*"/g, '');
  html = html.replace(/(<img\b[^>]*\bsrc=")(https:\/\/images\.unsplash\.com\/(photo-[0-9a-f-]+)[^"]*)"/g, (m, pre, url, id) => { photos.add(id); return `${pre}${localImg(id, depth)}"`; });
  write(file, html);
}

let index = fs.readFileSync(path.join(ROOT, 'search-index.json'), 'utf8')
  .replace(UNSPLASH, (m, id) => { photos.add(id); return `assets/img/${id}.jpg`; });

let js = fs.readFileSync(path.join(ROOT, 'assets/site.js'), 'utf8');
js = js.replace("'use strict';", "'use strict';\n  var BASE = (document.currentScript && document.currentScript.src || '').replace(/assets\\/site\\.js.*$/, '');")
  .replace("fetch('/search-index.json')", "fetch(BASE + 'search-index.json')")
  .split("'\" href=\"' + h.p.path + '\">'").join("'\" href=\"' + BASE + h.p.path.slice(1) + 'index.html\">'")
  .split("'<a class=\"card\" href=\"' + p.path + '\"").join("'<a class=\"card\" href=\"' + BASE + p.path.slice(1) + 'index.html\"")
  .split('esc(h.p.img)').join('esc(BASE + h.p.img)');
for (const a of assets) write(a, a === 'assets/site.js' ? js : a === 'search-index.json' ? index : fs.readFileSync(path.join(ROOT, a)));

(async () => {
  let bytes = 0;
  for (const id of photos) {
    const res = await fetch(`https://images.unsplash.com/${id}?w=1200&q=70&fm=jpg`);
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    bytes += buf.length;
    write(`assets/img/${id}.jpg`, buf);
  }
  console.log(`✓ Preview export: ${pages.length} pages, ${assets.length} assets, ${photos.size} photos (${(bytes / 1048576).toFixed(1)} MB) → ${OUT}`);
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
