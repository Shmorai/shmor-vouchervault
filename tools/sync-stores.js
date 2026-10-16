/* =====================================================================
   VoucherVault: write one SEO landing page per store from data/vouchers.json
     node tools/sync-stores.js && node tools/build.js

   Creates/updates content/stores/<id>.json ("generated": true) with a unique
   title + description built from the store's live offers, its tips, and FAQs
   whose answers come from the data (so they stay true). Pages for stores that
   were removed from the data are deleted. Hand-written store pages (without
   "generated": true) are never touched.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const blocks = require('./blocks.js');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'content', 'stores');
const DATA = blocks._data;
const TODAY = new Date().toISOString().slice(0, 10);
const host = u => new URL(u).hostname.replace(/^www\./, '');
const CAT_IMG = {
  fashion: { src: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04', alt: 'Clothing boutique with rails of clothes', credit: 'Clark Street Mercantile', creditUrl: 'https://unsplash.com/@mercantile' },
  sportswear: { src: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff', alt: 'A red running trainer on a red background', credit: 'Ryan Waring', creditUrl: 'https://unsplash.com/@ryanwaring' },
  tech: { src: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853', alt: 'A laptop on a wooden table', credit: 'Kari Shea', creditUrl: 'https://unsplash.com/@karishea' },
  beauty: { src: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796', alt: 'Assorted cosmetics and make-up products', credit: 'Jazmin Quaynor', creditUrl: 'https://unsplash.com/@jazminantoinette' },
};
const fit = (s, max) => s.length <= max ? s : s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';

fs.mkdirSync(DIR, { recursive: true });
const wanted = new Set();
for (const [id, s] of Object.entries(DATA.stores)) {
  const file = path.join(DIR, `${id}.json`);
  if (fs.existsSync(file) && !JSON.parse(fs.readFileSync(file, 'utf8')).generated) { wanted.add(`${id}.json`); continue; }
  const list = blocks._liveFor(id);
  const codes = list.filter(o => o.kind === 'code');
  const student = list.filter(o => (o.groups || []).includes('student'));
  const uk = s.regions.includes('uk') && !s.regions.includes('us');
  const words = uk ? 'Discount Codes & Voucher Codes' : 'Promo Codes & Discount Codes';
  const best = codes.find(o => o.hot) || codes[0] || list.find(o => o.hot) || list[0];
  const last = list.map(o => o.verified).sort().pop() || TODAY;
  const site = host(s.url);
  const cat = DATA.categories[s.category] || {};

  const head = `${list.length || 'No'} live ${s.name} offer${list.length === 1 ? '' : 's'}, checked on ${site} on ${blocks._fmt(last)}`;
  let description = best ? `${head}: ${best.title}.` : `${head}.`;
  const tail = ' Terms, end dates and tips.';
  if (description.length > 158) description = fit(`${head}: ${best.title}`, 157) + '.';
  else if (description.length + tail.length <= 158) description += tail;
  if (description.length < 120) description = fit(description + ` See how to use ${s.name} codes and save more.`, 158);

  const codeList = codes.map(o => `<strong>${o.code}</strong> (${o.title.charAt(0).toLowerCase() + o.title.slice(1)})`).join('; ');
  const faqs = [
    { q: `Is there a ${s.name} discount code right now?`, a: codes.length
      ? `Yes. As of ${blocks._fmt(last)} we found ${codes.length === 1 ? 'this code' : 'these codes'} on ${site}: ${codeList}. Codes can end without notice, so the store's checkout has the final word.`
      : `We haven't found a public ${s.name} code on ${site} at our last check (${blocks._fmt(last)}). ${list.length ? `There ${list.length === 1 ? 'is' : 'are'} still ${list.length} offer${list.length === 1 ? '' : 's'} that need no code, listed above.` : 'Check back soon: we re-check regularly.'}` },
    student.length
      ? { q: `Does ${s.name} have a student discount?`, a: `Yes: ${student.map(o => o.title.charAt(0).toLowerCase() + o.title.slice(1)).join('; ')}. ${student[0].terms}` }
      : null,
    { q: `How does VoucherVault check ${s.name} codes?`, a: `We only list offers we have seen on ${s.name}'s own site or app, or in its official affiliate feed, and show the date we last checked each one. Offers with a published end date disappear when it passes; offers without one are hidden if we haven't re-checked them recently.` },
    { q: `Why isn't my ${s.name} code working?`, a: `The usual reasons are: the code only covers selected items, you haven't reached a minimum spend, it is for new customers or app orders only, it can't be combined with another offer, or it has just ended. Read the terms on the offer and check your basket meets them.` },
  ].filter(Boolean);

  const page = {
    generated: true,
    slug: `stores/${id}`,
    title: `${s.name} ${words} | VoucherVault`,
    description,
    nav: s.name,
    h1: `${s.name} ${uk ? 'discount codes' : 'promo codes'} & offers`,
    eyebrow: `${cat.label || ''} · ${s.regions.map(r => DATA.regions[r]).join(', ')}`,
    intro: s.about,
    image: CAT_IMG[s.category],
    search: false,
    ctaSearch: false,
    blocks: [
      { type: 'storeinfo', store: id, position: 'top' },
      { type: 'offers', position: 'top', preset: { store: id }, tabs: true, title: `${s.name} codes & offers`, intro: `Every offer below was checked on ${site}. Tap a code to reveal and copy it.` },
      { type: 'alerts', position: 'top', store: id },
    ],
    sections: [
      { h2: `How to use a ${s.name} ${uk ? 'discount code' : 'promo code'}`, html: `<ol><li>Pick an offer above and tap <strong>Get code</strong> to reveal and copy it (deals and member perks need no code).</li><li>Open <a href="${s.url}" rel="nofollow noopener" target="_blank">${site}</a>, add the items you want to your ${uk ? 'basket' : 'cart'} and check they meet the offer's terms.</li><li>Paste the code into the promo or discount box at checkout and check the price drops before you pay.</li></ol>` },
      { h2: `Tips for saving at ${s.name}`, html: `<ul>${(s.tips || []).map(t => `<li>${t}</li>`).join('')}</ul>` },
    ],
    faqs,
    related: [cat.page, 'voucher-codes', 'blog/why-voucher-codes-dont-work'].filter(Boolean),
    keywords: [`${s.name} discount code`, `${s.name} promo code`, `${s.name} voucher code`, `${s.name} coupon`, `${s.name} student discount`, `${s.name} offers`].map(k => k.toLowerCase()),
    cardText: best ? `${best.value} ${best.valueLabel || 'off'}: ${best.title}` : `${s.name} offers and saving tips`,
    updated: last,
  };
  fs.writeFileSync(file, JSON.stringify(page, null, 2) + '\n');
  wanted.add(`${id}.json`);
}
for (const f of fs.readdirSync(DIR)) {
  if (wanted.has(f) || !f.endsWith('.json')) continue;
  const p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (p.generated) { fs.unlinkSync(path.join(DIR, f)); console.log(`  removed store page ${f}`); }
}
// RSS feed of live offers (newest check first) at /feeds/codes.xml. A mailing-list provider's
// RSS-to-email campaign can send new codes to Code Alerts subscribers automatically.
{
  const SITE = JSON.parse(fs.readFileSync(path.join(ROOT, 'shmor-site.json'), 'utf8'));
  const BASE = `https://${SITE.subdomain}.shmor.ai`;
  const x = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const items = blocks._live().slice()
    .sort((p, q) => q.verified.localeCompare(p.verified) || (p.expires || '9').localeCompare(q.expires || '9')).slice(0, 50)
    .map(o => {
      const st = DATA.stores[o.store];
      const desc = `${o.code ? `Code: ${o.code}. ` : ''}${o.terms}${o.expires ? ` Ends ${blocks._fmt(o.expires)}.` : ''}`;
      return `<item><title>${x(`${st.name}: ${o.title}`)}</title><link>${BASE}/stores/${o.store}/#o-${o.id}</link><guid isPermaLink="false">${x(o.id)}-${o.verified}</guid><pubDate>${new Date(o.verified + 'T08:00:00Z').toUTCString()}</pubDate><category>${x(st.category)}</category><description>${x(desc)}</description></item>`;
    });
  fs.mkdirSync(path.join(ROOT, 'feeds'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'feeds', 'codes.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>VoucherVault: latest voucher codes</title><link>${BASE}/voucher-codes/</link><description>New and updated voucher codes and offers, checked on the brands' own sites.</description><language>en</language>
<atom:link href="${BASE}/feeds/codes.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
</channel></rss>
`);
}
console.log(`✓ ${wanted.size} store pages in content/stores/ + feeds/codes.xml`);
