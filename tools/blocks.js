/* =====================================================================
   VoucherVault: site-specific block types for tools/build.js (kit hook).
   Data: data/vouchers.json (stores, offers, events). Every card is static,
   crawlable HTML; assets/site.js adds the code reveal, copy button, region
   filter, kind tabs and live "ends in" countdowns on top.

   "offers"  { "title", "intro", "preset": { store | category | kind | group | hot | first | expiring: days },
               "ids": [...], "limit": 12, "tabs": true, "sort": "expiry", "empty": "..." , "more": {title, slug} }
   "stores"  { "title", "intro", "category": "fashion", "limit": 12, "az": true }
   "ticker"  { "days": 14 }  slim "ending soon" strip
   "events"  { "title", "intro" }  big sale dates with countdowns
   "storeinfo" { "store": "nike" }  about / tips / official site panel

   Offer visibility: an offer shows while its published end date ("expires")
   hasn't passed. One with no end date shows only while "verified" is inside
   the recheck window for its kind (data recheckDays), so unchecked codes drop
   off by themselves. The build lists offers that need re-checking.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'vouchers.json'), 'utf8'));
const TODAY = new Date().toISOString().slice(0, 10);
const DAY = 864e5;
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const daysTo = d => Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(TODAY + 'T00:00:00Z')) / DAY);
const fmt = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtShort = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

// When an offer with no end date must be re-checked (or it is hidden)
const checkBy = o => o.expires ? null : addDays(o.verified, (DATA.recheckDays || {})[o.kind] || 14);
const isLive = o => o.expires ? o.expires >= TODAY : checkBy(o) >= TODAY;

// Validate once (problems stop the build through kit.errors on first use)
const problems = [];
for (const o of DATA.offers) {
  const where = `data/vouchers.json offer "${o.id}"`;
  if (!DATA.stores[o.store]) problems.push(`${where}: unknown store "${o.store}"`);
  if (!DATA.kinds[o.kind]) problems.push(`${where}: unknown kind "${o.kind}"`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.verified || '')) problems.push(`${where}: needs "verified": "YYYY-MM-DD"`);
  if (!o.source) problems.push(`${where}: needs a "source" URL (where the offer was seen)`);
  if (o.kind === 'code' && !o.code) problems.push(`${where}: kind "code" needs a "code"`);
  if (o.expires && !/^\d{4}-\d{2}-\d{2}$/.test(o.expires)) problems.push(`${where}: "expires" must be YYYY-MM-DD or null`);
}
const ids = new Set(); for (const o of DATA.offers) { if (ids.has(o.id)) problems.push(`data/vouchers.json: duplicate offer id "${o.id}"`); ids.add(o.id); }
const stale = DATA.offers.filter(o => !isLive(o));
if (stale.length) console.log(`  ! ${stale.length} offer(s) hidden (expired or due a re-check): ${stale.map(o => o.id).join(', ')}`);
const soon = DATA.offers.filter(o => isLive(o) && !o.expires && daysTo(checkBy(o)) <= 3);
if (soon.length) console.log(`  ! re-check soon (hidden after their recheck date): ${soon.map(o => `${o.id} (${checkBy(o)})`).join(', ')}`);

const live = () => DATA.offers.filter(isLive);
const liveFor = store => live().filter(o => o.store === store);

const P = d => `<path d="${d}"/>`;
const svg = (inner, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICO = {
  check: P('M20 6 9 17l-5-5'),
  clock: '<circle cx="12" cy="12" r="10"/>' + P('M12 6v6l4 2'),
  flame: P('M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'),
  ext: P('M15 3h6v6') + P('M10 14 21 3') + P('M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'),
};

const valueLabel = o => o.valueLabel || (/%$|^\$|^£|^€/.test(o.value) ? 'OFF' : '');
const logo = (s, id, kit, tag = 'a') => tag === 'a'
  ? `<a class="vc-logo" href="/stores/${id}/" style="--b:${kit.esc(s.color || '#333')}" aria-label="${kit.esc(s.name)} codes"><span>${kit.esc(s.mono || s.name[0])}</span></a>`
  : `<span class="vc-logo" style="--b:${kit.esc(s.color || '#333')}" aria-hidden="true"><span>${kit.esc(s.mono || s.name[0])}</span></span>`;

function card(o, p, kit) {
  const { esc } = kit;
  const s = DATA.stores[o.store];
  const storeHref = s.link && kit.LINKS[s.link] ? kit.goHref(s.link, p.slug || 'home') : s.url;
  const offerHref = o.link && kit.LINKS[o.link] ? kit.goHref(o.link, p.slug || 'home') : storeHref;
  const aff = (o.link && kit.LINKS[o.link]) || (s.link && kit.LINKS[s.link]);
  const rel = aff ? kit.AFF : 'rel="nofollow noopener" target="_blank"';
  const regions = o.regions || s.regions || [];
  const ends = o.expires ? `<span class="vc-ends${daysTo(o.expires) <= 3 ? ' is-soon' : ''}" data-ends="${o.expires}">${svg(ICO.clock, 14)} Ends ${fmtShort(o.expires)}</span>` : '';
  const onStore = p.slug === `stores/${o.store}`;
  const cta = o.kind === 'code'
    ? `<button type="button" class="vc-btn vc-get" data-reveal="${esc(o.id)}"><span class="vc-btn-label">Get code</span><span class="vc-peek" aria-hidden="true">${esc(o.code.slice(-3))}</span></button>`
    : `<a class="vc-btn vc-deal" href="${esc(offerHref)}" ${rel} data-out="${esc(o.id)}">Get ${o.kind === 'member' ? 'offer' : o.kind === 'gift' ? 'gift' : 'deal'}</a>`;
  return `<article class="vc vc-${esc(o.kind)}" id="o-${esc(o.id)}" data-kind="${esc(o.kind)}" data-regions="${esc(regions.join(' '))}"${o.expires ? ` data-expires="${o.expires}"` : ` data-checkby="${checkBy(o)}"`}
  data-store="${esc(s.name)}" data-title="${esc(o.title)}" data-href="${esc(offerHref)}" data-aff="${aff ? 1 : 0}"${o.code ? ` data-code="${esc(o.code)}"` : ''}>
  ${onStore ? logo(s, o.store, kit, 'span') : logo(s, o.store, kit)}
  <div class="vc-val"><strong>${esc(o.value)}</strong>${valueLabel(o) ? `<span>${esc(valueLabel(o))}</span>` : ''}</div>
  <div class="vc-body">
    <p class="vc-tags"><span class="vc-kind">${esc(DATA.kinds[o.kind])}</span>${o.hot ? `<span class="vc-hot">${svg(ICO.flame, 13)} Hot</span>` : ''}${o.first ? '<span class="vc-new">New customers</span>' : ''}${(o.groups || []).includes('student') ? '<span class="vc-new">Students</span>' : ''}${onStore ? '' : `<a class="vc-store" href="/stores/${esc(o.store)}/">${esc(s.name)}</a>`}<span class="vc-reg">${regions.map(r => esc(DATA.regions[r] || r)).join(' · ')}</span></p>
    <h3>${esc(o.title)}</h3>
    <p class="vc-sub"><span class="vc-check">${svg(ICO.check, 14)} ${o.via ? `From ${esc(s.name)}'s ${esc(o.via)} feed` : `Checked on ${esc(host(o.source))}`} · ${fmt(o.verified)}</span>${ends}</p>
    <details class="vc-terms"><summary>Terms &amp; details</summary><p>${esc(o.terms || 'See the store for full terms.')}</p><p class="vc-src">Source: <a href="${esc(o.source)}" rel="nofollow noopener" target="_blank">${esc(host(o.source))} ${svg(ICO.ext, 12)}</a>${o.expires ? ` · Ends ${fmt(o.expires)}` : ' · No end date published'}</p></details>
  </div>
  <div class="vc-cta">${cta}</div>
</article>`;
}

function pick(b) {
  const pr = b.preset || {};
  let list = b.ids ? b.ids.map(id => DATA.offers.find(o => o.id === id)).filter(o => o && isLive(o)) : live();
  if (!b.ids) {
    if (pr.store) list = list.filter(o => o.store === pr.store);
    if (pr.category) list = list.filter(o => DATA.stores[o.store].category === pr.category);
    if (pr.kind) list = list.filter(o => [].concat(pr.kind).includes(o.kind));
    if (pr.group) list = list.filter(o => (o.groups || []).includes(pr.group));
    if (pr.hot) list = list.filter(o => o.hot);
    if (pr.first) list = list.filter(o => o.first);
    if (pr.region) list = list.filter(o => (o.regions || []).includes(pr.region));
    if (pr.expiring) list = list.filter(o => o.expires && daysTo(o.expires) <= pr.expiring);
    const rank = o => (o.kind === 'code' ? 0 : o.kind === 'deal' ? 1 : o.kind === 'gift' ? 2 : 3) - (o.hot ? 0.5 : 0);
    list = b.sort === 'expiry'
      ? list.sort((a, c) => (a.expires || '9999').localeCompare(c.expires || '9999'))
      : list.sort((a, c) => rank(a) - rank(c));
  }
  return b.limit ? list.slice(0, b.limit) : list;
}

function head(b, kit) {
  if (!b.title) return '';
  const more = b.more ? `<a class="block-more" href="/${kit.esc(b.more.slug)}/">${kit.esc(b.more.title)} →</a>` : '';
  return `<div class="block-head"><h2>${kit.esc(b.title)}</h2>${b.intro ? `<p>${b.intro}</p>` : ''}${more}</div>`;
}

module.exports = {
  offers(b, p, kit) {
    if (problems.length) { kit.errors.push(...problems); problems.length = 0; }
    const list = pick(b);
    const kinds = [...new Set(list.map(o => o.kind))];
    const tabs = b.tabs && kinds.length > 1 ? `<div class="vc-tabs" data-vtabs hidden role="group" aria-label="Filter offers"><button type="button" data-vtab="all" aria-pressed="true">All <b>${list.length}</b></button>${Object.keys(DATA.kinds).filter(k => kinds.includes(k)).map(k =>
      `<button type="button" data-vtab="${k}" aria-pressed="false">${kit.esc(DATA.kinds[k])}s <b>${list.filter(o => o.kind === k).length}</b></button>`).join('')}</div>` : '';
    const body = list.length ? `<div class="vc-list${b.layout === 'grid' ? ' vc-grid' : ''}">${list.map(o => card(o, p, kit)).join('\n')}</div><p class="vc-none" hidden>No offers for your region here right now. <button type="button" class="linkish" data-region-all>Show all regions</button></p>`
      : `<p class="vc-empty">${b.empty || 'No live offers here right now. We only list offers we have checked on the brand’s own site, so check back soon.'}</p>`;
    return `<section class="blocks blocks-offers${b.class ? ` ${kit.esc(b.class)}` : ''}"${b.id ? ` id="${kit.esc(b.id)}"` : ''}><div class="wrap">${head(b, kit)}${tabs}${body}</div></section>`;
  },

  stores(b, p, kit) {
    const { esc } = kit;
    let ids = Object.keys(DATA.stores).filter(id => !b.category || DATA.stores[id].category === b.category);
    ids.sort((a, c) => b.az ? DATA.stores[a].name.localeCompare(DATA.stores[c].name) : liveFor(c).length - liveFor(a).length || DATA.stores[a].name.localeCompare(DATA.stores[c].name));
    if (b.limit) ids = ids.slice(0, b.limit);
    const tile = id => { const s = DATA.stores[id], n = liveFor(id).length, codes = liveFor(id).filter(o => o.kind === 'code').length;
      return `<a class="st" href="/stores/${id}/"><span class="st-logo" style="--b:${esc(s.color)}">${esc(s.mono || s.name[0])}</span><b>${esc(s.name)}</b><small>${n} offer${n === 1 ? '' : 's'}${codes ? ` · ${codes} code${codes === 1 ? '' : 's'}` : ''}</small></a>`; };
    let body;
    if (b.az) {
      const groups = {};
      ids.forEach(id => { const l = DATA.stores[id].name[0].toUpperCase().replace(/[^A-Z]/, '#'); (groups[l] = groups[l] || []).push(id); });
      body = `<nav class="az" aria-label="Stores A to Z">${Object.keys(groups).map(l => `<a href="#az-${l}">${l}</a>`).join('')}</nav>${Object.entries(groups).map(([l, list]) =>
        `<div class="az-group" id="az-${l}"><h3>${l}</h3><div class="st-grid">${list.map(tile).join('')}</div></div>`).join('')}`;
    } else body = `<div class="st-grid">${ids.map(tile).join('')}</div>`;
    return `<section class="blocks blocks-stores"><div class="wrap">${head(b, kit)}${body}</div></section>`;
  },

  ticker(b, p, kit) {
    const { esc } = kit;
    const list = live().filter(o => o.expires && daysTo(o.expires) <= (b.days || 14)).sort((a, c) => a.expires.localeCompare(c.expires))
      .concat(live().filter(o => o.hot && o.kind === 'code')).slice(0, 14);
    if (!list.length) return '';
    const items = list.map(o => `<a href="/stores/${esc(o.store)}/#o-${esc(o.id)}"${o.expires ? ` data-ends="${o.expires}"` : ''}><b>${esc(DATA.stores[o.store].name)}</b> ${esc(o.value)} ${esc(valueLabel(o).toLowerCase())}${o.expires ? ` <em>ends ${fmtShort(o.expires)}</em>` : o.code ? ' <em>code</em>' : ''}</a>`).join('');
    return `<section class="ticker" aria-label="Ending soon and hot codes"><div class="ticker-label">${svg(ICO.clock, 15)} Ending soon</div><div class="ticker-track"><div class="ticker-run">${items}</div></div></section>`;
  },

  events(b, p, kit) {
    const { esc } = kit;
    const list = (DATA.events || []).filter(e => e.date >= TODAY);
    if (!list.length) return '';
    return `<section class="blocks blocks-events"><div class="wrap">${head(b, kit)}<div class="ev-grid">${list.map(e =>
      `<div class="ev"><p class="ev-date"><b>${new Date(e.date + 'T12:00:00Z').getUTCDate()}</b><span>${new Date(e.date + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</span></p><div><h3>${esc(e.name)}</h3><p>${esc(e.text)}</p><p class="ev-count" data-countdown="${e.date}">${daysTo(e.date)} days to go</p></div></div>`).join('')}</div></div></section>`;
  },

  stats(b, p, kit) {
    const list = live(), stores = new Set(list.map(o => o.store)), codes = list.filter(o => o.kind === 'code').length;
    const last = list.map(o => o.verified).sort().pop();
    const items = [[list.length, 'live offers'], [codes, 'codes to copy'], [stores.size, 'global brands'], [last ? fmtShort(last) : '–', 'last checked']];
    return `<section class="stats" aria-label="VoucherVault at a glance"><div class="wrap"><ul>${items.map(([n, l]) => `<li><b>${kit.esc(String(n))}</b><span>${l}</span></li>`).join('')}</ul></div></section>`;
  },

  storeinfo(b, p, kit) {
    const { esc } = kit;
    const s = DATA.stores[b.store];
    if (!s) { kit.errors.push(`${p._file}: storeinfo block: unknown store "${b.store}"`); return ''; }
    const list = liveFor(b.store), codes = list.filter(o => o.kind === 'code');
    const last = list.map(o => o.verified).sort().pop();
    const href = s.link && kit.LINKS[s.link] ? kit.goHref(s.link, p.slug) : s.url;
    const rel = s.link && kit.LINKS[s.link] ? kit.AFF : 'rel="nofollow noopener" target="_blank"';
    return `<section class="blocks blocks-storeinfo"><div class="wrap si">
  <div class="si-id">${logo(s, b.store, kit, 'span')}<div><p class="si-kicker">${esc((DATA.categories[s.category] || {}).label || '')} · ${s.regions.map(r => DATA.regions[r]).join(', ')} store</p><p class="si-stats"><b>${list.length}</b> live offer${list.length === 1 ? '' : 's'} · <b>${codes.length}</b> code${codes.length === 1 ? '' : 's'}${last ? ` · last checked ${fmt(last)}` : ''}</p></div></div>
  <a class="vc-btn vc-deal si-go" href="${esc(href)}" ${rel}>Visit ${esc(host(s.url))} ${svg(ICO.ext, 14)}</a>
</div></section>`;
  },
};
module.exports._data = DATA;
module.exports._live = live;
module.exports._liveFor = liveFor;
module.exports._fmt = fmt;
