# VoucherVault (vouchervault.shmor.ai)

A Shmor marketplace (shared rules in `../../CLAUDE.md`): its own brand, design and SEO. Live voucher codes, promo codes, deals, free gifts and member perks (student, military, sign-up) for global brands in the US, UK and EU, plus hot deals, ending-soon offers, sale dates and money-saving advice. Replaced the planned "Shmor Deals" card on shmor.ai (2026-10-16). Repo: `Shmorai/shmor-vouchervault` (private until launch). Status: **building**, with no referral links yet.

## Where things are
| What | Where |
|---|---|
| Card on shmor.ai, search keywords, **referral links**, SEO defaults | `shmor-site.json` |
| **Offer database** (stores, offers, sale-date events) | `data/vouchers.json` |
| Offer cards, store tiles, ticker, stats, events, store panel (kit hook) | `tools/blocks.js` |
| Store pages (generated from the data) | `content/stores/*.json` via `tools/sync-stores.js` (don't hand-edit files with `"generated": true`) |
| Import codes from an affiliate network export (CSV) | `tools/import-feed.js` |
| Other pages (1 JSON file = 1 Google landing page) | `content/` |
| Design: header, logo, footer | `templates/layout.html` |
| Design: styles / behaviour | `assets/site.css`, `assets/site.js` (kit code first; **VoucherVault theme** block at the bottom of each) |
| Private preview export | `tools/preview-export.js` |

## How offers work (the rules that keep codes "live")
- Every offer in `data/vouchers.json` needs `store`, `kind` (code | deal | gift | member), `title`, `value`, `terms`, `regions`, `verified` (the day someone saw it live), `source` (URL where it was seen) and `expires` (the brand's published end date, or null). Optional: `code`, `valueLabel`, `hot`, `first` (new customers), `groups` (student, military, keyworker, teacher, senior), `link` (referral slug).
- **Sources:** only the brand's own site/app, or the brand's official affiliate feed. We decided (2026-10-16) **not to copy codes from other coupon sites** (VoucherCodes, RetailMeNot, etc.): their listings are often stale or fake, copying them can breach their terms/database rights, and it would break our "no invented deals" rule. Their own codes come from the same affiliate feeds we'll get once approved.
- **Automatic expiry:** offers vanish after `expires`; offers with no end date are hidden once `verified` is older than `recheckDays` (code 10, deal 14, gift 14, member 45), both at build time and live in the browser (`data-expires` / `data-checkby`). The build prints which offers are hidden or due a re-check: re-check them on the brand site, update `verified`, rebuild.
- Cards show "Checked on <site> · <date>", end date / live countdown, region, terms + source link. Codes are revealed in a modal with a copy button; deals link to the store (via `shmor.ai/go/` when the store or offer has a referral `link`). No fake "used X times" counters, success rates or star ratings.
- Store logos are coloured monogram tiles (brand colour + initials), not trademarked logos. Footer says brands aren't affiliated unless stated.
- **First import (2026-10-16):** 36 offers (9 copy-and-paste codes) from 14 brands checked live on their own sites: ASOS (NEWHERE/HEYAPP), Under Armour (EXTRA25, sign-up 15%, ID.me 20%), PUMA (STOCKUP), Old Navy (EXTRA), Kohl's (GET20, text 15%), UNIQLO ($10 app), The North Face (XPLR Pass 15%), Nike (10% student/military/responders/educators/birthday), Gymshark (15% sign-up, 12% Student Beans, $10 refer), LOOKFANTASTIC (FLASH + dated gifts), Sephora (ALLFAVES), Dell (education/heroes/seniors/rewards), Lenovo (YOGA7DEAL), Samsung (Offer Programs, Fold8 Ultra). Codes without end dates drop off ~26 Oct unless re-checked.

## Going live with affiliate codes
1. Join programmes (Awin, CJ, Impact, Rakuten, Partnerize). Many voucher programmes require approval as a "voucher/coupon" publisher.
2. Export the network's voucher/promotions file as CSV, then `node tools/import-feed.js <file.csv> --network awin` (add `--dry` to preview). Advertiser names are matched to stores (`name` or `aliases`); tracking URLs are pasted unchanged into `shmor-site.json` links as `<store>-<network>`.
3. For a brand-level referral link (all deals for a store), add it to `links` and set the store's `"link": "<slug>"` in the data.
4. `node tools/sync-stores.js && node tools/build.js`, then sync the master and commit both repos.

## Pages (34)
Home (stats → ending-soon ticker → hot codes → popular stores → ending soon → latest codes → categories → advice posts → sale dates → how we check → FAQ) · voucher-codes · hot-deals · expiring-soon · stores (A–Z) + 14 store pages · categories (+ fashion, sportswear, tech, beauty) · student-discounts · key-worker-discounts · black-friday (27 Nov 2026 / Cyber Monday 30 Nov) · how-we-check (editorial standards) · blog "Saving advice" + 5 posts (why codes don't work, finding codes that work, student verification, Singles' Day, sign-up discounts).
Top menu: All codes, Hot deals, Ending soon, Stores, Categories, Student, Black Friday, Saving advice. Region switch (All/US/UK/EU, remembered) in the header filters every offer list.

## Design
"Coupon marketplace" (modelled on the layout of the big voucher sites, no copying of their branding): dark utility strip → white header with logo, big rounded search and "by Shmor.ai" pill → nav band with region switch. Soft lavender page #F5F3F9, white cards, hot pink #E5136F (brand, code buttons, values), purple #6B2BD9 (member perks/gifts, tags), green #0E8A5F ("checked"), orange for hot/ending soon. Fonts: Plus Jakarta Sans (headings, values, buttons) + Inter. Hero = photo with a purple→pink overlay and yellow highlighted word. Code button = pink "Get code" label over a dashed box showing the last 3 characters ("peel" effect). Logo = pink rounded square with a white ticket and % sign. Dark footer.
**Not yet visually checked in a browser** (the local preview slot limit was full on 2026-10-16): check desktop + 375px next time a preview slot is free.

## Private preview link
https://claude.ai/artifact/2PemWRj3KBC2aUkEBFUvZC (private, owner only). Refresh: `node tools/build.js`, `node tools/preview-export.js ../../previews/vouchervault`, then republish `Shmor/previews/vouchervault/index.html` to that URL with all files.

## Commands (run here)
```bash
node tools/sync-stores.js && node tools/build.js   # after ANY change to data/, content/, templates/ or shmor-site.json
node tools/build.js --check                        # validate only
node tools/import-feed.js feed.csv --network awin  # import affiliate voucher feed
node tools/serve.js 4024                           # preview (config "vouchervault")
```
After changing `shmor-site.json`, also run `node tools/sync-network.js` in `../../shmor-ai`.

## Ideas / next
Re-check codes twice a week (scheduled job) · join Awin/CJ/Impact voucher programmes and import feeds · more global brands (Amazon, Apple, eBay, Adidas, H&M, Zara, Booking.com, Expedia, Samsung UK, Currys, Boots) once codes are confirmed on their sites · EU-region offers (none yet) · newsletter "this week's codes".
