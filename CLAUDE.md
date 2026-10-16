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

## Where unlock details and sign-ups are stored (database)
- **Database: Supabase** (hosted Postgres, free tier). Setup: `tools/supabase-setup.sql` creates `leads` (first_name, last_name, email, phone, terms_accepted, marketing_email, marketing_sms, store, offer, page, created_at) and `signups` (Code Alerts), with row-level security so the website can only INSERT (no reading/editing from the site), plus dashboard views `marketing_email_list` / `marketing_sms_list` (opted-in people only).
- **Connect:** paste the project URL + public anon key into `assets/db-config.js` (`window.VV_DB`), rebuild, commit. Never the service_role key. Pick an EU/UK region. View/export rows in Supabase → Table Editor.
- Save order in `assets/site.js`: Supabase (`window.vvSaveRow`) → form `action` provider → private preview db (`leads` / `signups`) → site's own preview server CSVs. **Status 2026-10-16: not connected yet** (waiting for the user to create the Supabase project; Claude can't create accounts).
- Unlock form now asks **first + last name** too (required), with a hidden honeypot field (`website`) that skips saving for bots.

## Code unlock: email + mobile before reveal (added 2026-10-16, user request)
- Tapping **Get code** opens the modal on an unlock step: email + mobile number (both required), required Terms/Privacy tick, and two **separate optional** opt-ins (email alerts, SMS offers with STOP wording). Marketing consent is never bundled with the unlock (UK/EU GDPR + PECR, US TCPA need separate, freely given opt-in). After unlocking once, every code reveals on that device (`localStorage vv-unlocked`).
- Codes are **not in the page HTML, feed, FAQs or search index**: `tools/sync-stores.js` writes `assets/codes.json` (offer id → reversed base64), fetched only at reveal. `blocks._mask()` swaps any code mention in titles/terms for "the code". This hides codes from casual viewing and search engines; it isn't real security (the file is public), and the codes are on the brands' own sites anyway.
- Unlock details are saved: 1) to a provider when `.vv-gate` gets an `action` (POSTs form fields, e.g. Formspree / a CRM webhook); 2) the private preview artifact db, collection `leads` (owner only); 3) the site's own preview server `node tools/serve.js 4024` → `subscribers/leads.csv` (git-ignored). The master preview on :4000 serves the site without these routes, so local leads only save when the site's own server runs. **If nothing can save (live site with no provider), the code still unlocks** so the site never breaks; connect a provider before launch or no leads are captured.
- Risk notes given to the user: requiring a phone number to see a public code may be challenged under UK/EU data-minimisation rules and lowers conversion; affiliate programmes may restrict gated codes (check each programme's terms). Easy to relax later: make the phone field optional in `assets/site.js` (gate block).

## Code Alerts email sign-up (added 2026-10-16, user asked for it "lots everywhere")
- **Placements:** header "Code alerts" button + utility-strip link (both jump to `#alerts`); big gradient band above the footer on every page (`templates/layout.html`, optional topic chips: fashion, sportswear, tech, beauty, student, black-friday); inline `alerts` block (tools/blocks.js) on home (after hot codes), every store page ("Get <Store> code alerts", saves the store), categories, hot deals, ending soon, all codes, stores, student, key workers, Black Friday and the blog index; an "Alert me" mini form in the code-reveal modal (saves that store); a slide-in after 40% scroll or 25 s (dismiss hides it 14 days; never shown again after sign-up; tucks away while the footer band is visible); an in-text link at the end of every blog post.
- Unticked consent box on every form (UK/EU GDPR). Each sign-up records email, interests, store, placement, page, time.
- **Storage (temporary, same pattern as ViralGadgets):** 1) the provider, once the forms get an `action`; 2) the private preview artifact's db, collection `signups` (read/write admin = owner only; read with ArtifactData "list"); 3) local preview server POST `/api/newsletter` → `subscribers/signups.csv` (git-ignored, never served). GitHub Pages has no server, so the live site needs a provider before launch.
- **Before launch:** pick a provider (recommended **Kit**, free to 10,000 subscribers, double opt-in, RSS-to-email). Set the forms' `action`/field names (footer band in layout.html, `signupForm` in tools/blocks.js, `formHtml` in assets/site.js), import any stored sign-ups, remove temporary paths.
- **Automatic emails:** `tools/sync-stores.js` writes `/feeds/codes.xml` (50 newest live offers). Point the provider's RSS-to-email campaign at `https://vouchervault.shmor.ai/feeds/codes.xml` (weekly) so subscribers get new codes without manual sends; tag by interest/store for segments.

## Twice-weekly code refresh (Tue + Fri mornings)
Recurring in-chat job (cron `17 8 * * 2,5`, set up 2026-10-16 in the "VoucherVault code refresh" session). **Limits:** it lives only in that Claude session (gone if the app/session closes) and auto-expires after 7 days, so re-create it (or move it to a desktop scheduled task) when it lapses. Each run:
1. For every offer in `data/vouchers.json`, open its `source` on the brand's own site (built-in browser when plain fetch is blocked; a page's `textContent` often holds banner/terms text that `innerText` hides). Confirm it is still shown; set `verified` to today; fix terms/end dates; remove offers that are gone.
2. Add new codes from the same brands' homepage banners / official offer pages, and new global brands only where a live offer is visible on the brand's own site. Never other coupon sites; never bypass bot checks (The North Face's discount-programme pages show one).
3. Keep the file's compact layout (store = 3 lines; offer = 2 lines, grouped by store).
4. `node tools/sync-stores.js && node tools/build.js` → `node tools/preview-export.js ../../previews/vouchervault` → republish the preview artifact with all files → in `../../shmor-ai`: `node tools/sync-network.js && node tools/test-network.js` → commit both repos (don't push without asking) → add a line to the log below.

### Refresh log
- **2026-10-16:** all 36 offers re-seen live. Fixes: PUMA STOCKUP now 40% off 4+ (ends 20 Oct), UNIQLO app $10 needs $75+, Kohl's GET20 in store too, ASOS £500/€690 cap, Samsung Fold8 ends 2 Nov. Added 18 offers on existing brands (UA student 20%, PUMA email 20%, Old Navy text $10, Kohl's email 15%, UNIQLO email/SMS/refer, Gymshark free shipping, 3 LOOKFANTASTIC gifts, Sephora LIFTCREAM/THREEGIFT/MJGIFT/4XHYDRATE, Lenovo Rewards, Samsung PYPL100 + S26 FE) and 4 brands: adidas (adiClub 15%, heroes 30%, free shipping), Boots (SAVE23, COSY20, MENO20, BABY10), Currys (20CANON + 3 deals), H&M (15% off $100 / 20% off $125 to 18 Oct). 66 offers, 18 stores.

## Going live with affiliate codes
1. Join programmes (Awin, CJ, Impact, Rakuten, Partnerize). Many voucher programmes require approval as a "voucher/coupon" publisher.
2. Export the network's voucher/promotions file as CSV, then `node tools/import-feed.js <file.csv> --network awin` (add `--dry` to preview). Advertiser names are matched to stores (`name` or `aliases`); tracking URLs are pasted unchanged into `shmor-site.json` links as `<store>-<network>`.
3. For a brand-level referral link (all deals for a store), add it to `links` and set the store's `"link": "<slug>"` in the data.
4. `node tools/sync-stores.js && node tools/build.js`, then sync the master and commit both repos.

## Pages (38)
Home (stats → ending-soon ticker → hot codes → popular stores → ending soon → latest codes → categories → advice posts → sale dates → how we check → FAQ) · voucher-codes · hot-deals · expiring-soon · stores (A–Z) + 18 store pages · categories (+ fashion, sportswear, tech, beauty) · student-discounts · key-worker-discounts · black-friday (27 Nov 2026 / Cyber Monday 30 Nov) · how-we-check (editorial standards) · blog "Saving advice" + 5 posts (why codes don't work, finding codes that work, student verification, Singles' Day, sign-up discounts).
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
join Awin/CJ/Impact voucher programmes and import feeds · more global brands (Amazon, Apple, eBay, Zara, Booking.com, Expedia, Samsung UK) once codes are confirmed on their sites · EU-region offers (none yet) · newsletter "this week's codes".
