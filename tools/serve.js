/* Local preview server that mimics GitHub Pages (folder/index.html, 404.html).
   Run from this site's folder:  node tools/serve.js [port]   (default 4024)
   Temporary local storage until a mailing-list / CRM provider is connected (subscribers/ is git-ignored, never served):
     POST /api/newsletter  Code Alerts sign-ups -> subscribers/signups.csv
     POST /api/lead        code unlock (email + mobile, marketing opt-ins) -> subscribers/leads.csv */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4024);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const csv = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ROUTES = {
  '/api/newsletter': {
    file: 'signups.csv', head: 'email,list,interests,store,placement,page,signed_up_at,consent',
    ok: r => EMAIL.test(r.email || '') && r.consent === true,
    cols: r => [r.email, r.list, r.interests, r.store, r.placement, r.page, r.signedUpAt, 'yes'],
  },
  '/api/lead': {
    file: 'leads.csv', head: 'first_name,last_name,email,phone,marketing_email,marketing_sms,store,offer,page,created_at',
    ok: r => { const d = String(r.phone || '').replace(/\D/g, ''); return r.firstName && r.lastName && EMAIL.test(r.email || '') && d.length >= 7 && d.length <= 15 && r.termsAccepted === true; },
    cols: r => [r.firstName, r.lastName, r.email, r.phone, r.marketingEmail ? 'yes' : 'no', r.marketingSms ? 'yes' : 'no', r.store, r.offer, r.page, r.createdAt],
  },
};

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const route = ROUTES[p];
  if (route && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 4096) req.destroy(); });
    req.on('end', () => {
      try {
        const row = JSON.parse(body);
        if (!route.ok(row)) throw new Error('bad');
        const file = path.join(ROOT, 'subscribers', route.file);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        if (!fs.existsSync(file)) fs.writeFileSync(file, route.head + '\n');
        fs.appendFileSync(file, route.cols(row).map(csv).join(',') + '\n');
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
