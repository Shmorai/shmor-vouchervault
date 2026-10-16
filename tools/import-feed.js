/* =====================================================================
   VoucherVault: import codes from an affiliate network's voucher export
   (Awin "Promotions/Vouchers", CJ "Promotional links", Impact "Promo
   codes", Rakuten "Coupon feed"...) into data/vouchers.json.

     node tools/import-feed.js <export.csv> --network awin [--dry]
     node tools/sync-stores.js && node tools/build.js

   This is how the big voucher sites get live codes: brands publish them to
   their affiliates through these feeds, with the tracking link included.
   Column names differ per network, so each field accepts several headers
   (case-insensitive). Rows are matched to a store by advertiser name
   (store "name" or "aliases" in data/vouchers.json); unknown advertisers
   are listed so you can add the store first. Imported offers get
   "verified" = today and "source" = the network, and replace earlier
   imports with the same id (<network>-<promotion id>). The row's tracking
   URL is pasted unchanged into shmor-site.json "links" as <store>-<network>.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const flag = k => { const i = args.indexOf('--' + k); return i > -1 ? args[i + 1] : undefined; };
const network = (flag('network') || '').toLowerCase();
const DRY = args.includes('--dry');
if (!file || !network) { console.error('Usage: node tools/import-feed.js <export.csv> --network awin|cj|impact|rakuten|... [--dry]'); process.exit(1); }

const COLS = {
  id: ['promotion id', 'promotionid', 'id', 'link id', 'promo id', 'coupon id'],
  advertiser: ['advertiser', 'advertiser name', 'merchant', 'merchant name', 'program', 'brand', 'campaign'],
  code: ['code', 'voucher code', 'coupon code', 'promo code', 'promotion code'],
  title: ['title', 'description', 'promotion title', 'link name', 'offer description', 'name'],
  terms: ['terms', 'terms and conditions', 'restrictions', 'details', 'additional information'],
  start: ['starts', 'start date', 'start', 'valid from', 'promotion start date'],
  end: ['ends', 'end date', 'end', 'expires', 'expiry date', 'valid to', 'promotion end date'],
  url: ['deeplink tracking', 'tracking url', 'click url', 'deeplink', 'link', 'url', 'tracking link'],
  regions: ['regions', 'region', 'country', 'countries', 'target country'],
};

// Minimal RFC 4180 CSV parser (quoted fields, commas and newlines inside quotes)
function csv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

const dataFile = path.join(ROOT, 'data', 'vouchers.json');
const siteFile = path.join(ROOT, 'shmor-site.json');
const DATA = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const SITE = JSON.parse(fs.readFileSync(siteFile, 'utf8'));
const TODAY = new Date().toISOString().slice(0, 10);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const byName = new Map();
for (const [id, s] of Object.entries(DATA.stores)) [s.name, ...(s.aliases || [])].forEach(n => byName.set(norm(n), id));

const [header, ...rows] = csv(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const H = header.map(h => h.trim().toLowerCase());
const col = k => COLS[k].map(n => H.indexOf(n)).find(i => i > -1);
const idx = Object.fromEntries(Object.keys(COLS).map(k => [k, col(k)]));
for (const k of ['advertiser', 'title']) if (idx[k] === undefined) { console.error(`✗ No "${k}" column found. Headers: ${header.join(', ')}`); process.exit(1); }
const date = s => { if (!s) return null; const d = new Date(s.trim().replace(/\//g, '-')); return isNaN(d) ? null : d.toISOString().slice(0, 10); };
const REG = { gb: 'uk', uk: 'uk', 'united kingdom': 'uk', us: 'us', usa: 'us', 'united states': 'us' };
const EU = ['de', 'fr', 'es', 'it', 'nl', 'ie', 'be', 'at', 'pt', 'se', 'dk', 'fi', 'pl', 'eu', 'europe'];

const unknown = new Set(); let added = 0, skipped = 0;
for (const r of rows) {
  const get = k => idx[k] === undefined ? '' : (r[idx[k]] || '').trim();
  const store = byName.get(norm(get('advertiser')));
  if (!store) { unknown.add(get('advertiser')); continue; }
  const end = date(get('end')), start = date(get('start'));
  if ((end && end < TODAY) || (start && start > TODAY)) { skipped++; continue; }
  const id = `${network}-${norm(get('id') || get('code') + get('title')).slice(0, 40)}`;
  const regions = [...new Set(get('regions').toLowerCase().split(/[;,|]/).map(x => x.trim()).filter(Boolean)
    .map(x => REG[x] || (EU.includes(x) ? 'eu' : null)).filter(Boolean))];
  const code = get('code');
  const title = get('title');
  const pct = title.match(/(\d{1,2})\s?%/), money = title.match(/[$£€]\s?\d+/);
  let link;
  if (get('url')) { link = `${store}-${network}`; if (!DRY) SITE.links[link] = { ...(SITE.links[link] || {}), merchant: DATA.stores[store].name, network, url: get('url') }; }
  const offer = { id, store, kind: code ? 'code' : 'deal', ...(code ? { code } : {}), value: pct ? `${pct[1]}%` : money ? money[0].replace(/\s/, '') : 'Deal',
    title, terms: get('terms') || 'See the store for full terms.', regions: regions.length ? regions : DATA.stores[store].regions,
    expires: end, verified: TODAY, source: DATA.stores[store].url, via: network, ...(link ? { link } : {}) };
  const i = DATA.offers.findIndex(o => o.id === id);
  if (i > -1) DATA.offers[i] = { ...DATA.offers[i], ...offer }; else DATA.offers.push(offer);
  added++;
}
if (!DRY) { fs.writeFileSync(dataFile, JSON.stringify(DATA, null, 2) + '\n'); fs.writeFileSync(siteFile, JSON.stringify(SITE, null, 2) + '\n'); }
console.log(`${DRY ? '(dry run) ' : ''}✓ ${added} offers imported from ${network}, ${skipped} skipped (not live yet or ended).`);
if (unknown.size) console.log(`  ! Advertisers with no store in data/vouchers.json (add them, or an "aliases" entry): ${[...unknown].join(', ')}`);
if (!DRY && added) console.log('  Next: node tools/sync-stores.js && node tools/build.js, then sync the master (new links).');
