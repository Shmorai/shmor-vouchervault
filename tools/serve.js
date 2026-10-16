/* Local preview server that mimics GitHub Pages (folder/index.html, 404.html).
   Run from this site's folder:  node tools/serve.js [port]   (default 4001) */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4024);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

// VoucherVault: Code Alerts sign-ups on the local preview are appended to subscribers/signups.csv
// (git-ignored, never served). Temporary until a mailing-list provider is wired in.
const SUBS = path.join(ROOT, 'subscribers', 'signups.csv');
const csv = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/newsletter' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 4096) req.destroy(); });
    req.on('end', () => {
      try {
        const row = JSON.parse(body);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email || '') || row.consent !== true) throw new Error('bad');
        fs.mkdirSync(path.dirname(SUBS), { recursive: true });
        if (!fs.existsSync(SUBS)) fs.writeFileSync(SUBS, 'email,list,interests,store,placement,page,signed_up_at,consent\n');
        fs.appendFileSync(SUBS, [row.email, row.list, row.interests, row.store, row.placement, row.page, row.signedUpAt, "yes"].map(csv).join(',') + '\n');
        res.writeHead(201, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); }
    });
    return;
  }
  if (p.startsWith('/subscribers')) { res.writeHead(404); return res.end('Not found'); }
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    return fs.existsSync(path.join(ROOT, '404.html')) ? fs.createReadStream(path.join(ROOT, '404.html')).pipe(res) : res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}`));
