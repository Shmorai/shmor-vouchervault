/* Shmor site kit: menu toggle + on-site search (pages are found via /search-index.json) */
(function () {
  'use strict';
  var btn = document.querySelector('[data-menu]'), nav = document.querySelector('[data-nav]');
  if (btn && nav) btn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  });

  var out = document.getElementById('search-results');
  if (!out) return;
  var q = (new URLSearchParams(location.search).get('q') || '').trim();
  var input = document.querySelector('.search input[name=q]');
  if (input) input.value = q;
  if (!q) return;
  var say = function (k, d) { return out.getAttribute('data-' + k) || d; }; // words in the site's language, set by the build
  document.getElementById('search-title').textContent = say('results', 'Results for “{q}”').replace('{q}', q);
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var words = q.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 1; });
  fetch('/search-index.json').then(function (r) { return r.json(); }).then(function (pages) {
    var hits = pages.map(function (p) {
      var score = words.reduce(function (s, w) { return s + (p.terms.indexOf(w) > -1 ? 1 : 0); }, 0);
      return { p: p, score: score };
    }).filter(function (h) { return h.score > 0; }).sort(function (a, b) { return b.score - a.score; });
    out.innerHTML = hits.length
      ? hits.map(function (h) { return '<a class="card' + (h.p.img ? ' has-img' : '') + '" href="' + h.p.path + '">' + (h.p.img ? '<img class="card-img" src="' + esc(h.p.img) + '" alt="" loading="lazy" width="600" height="360">' : '') + '<h3>' + esc(h.p.title) + '</h3><p>' + esc(h.p.text) + '</p><span class="cta">' + esc(say('cta', 'Explore →')) + '</span></a>'; }).join('')
      : '<p class="empty">' + esc(say('empty', 'No pages matched. Try a broader search, or browse the guides below.')) + '</p>' +
        pages.slice(0, 6).map(function (p) { return '<a class="card" href="' + p.path + '"><h3>' + esc(p.title) + '</h3><p>' + esc(p.text) + '</p></a>'; }).join('');
  }).catch(function () { out.innerHTML = '<p class="empty">' + esc(say('error', 'Search is unavailable right now.')) + '</p>'; });
})();

/* "specs" blocks with "tabs": filter the cards by data-tag (every card shows without JS) */
(function () {
  'use strict';
  document.querySelectorAll('[data-tabs]').forEach(function (bar) {
    var grid = bar.nextElementSibling;
    bar.hidden = false;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (!b) return;
      var id = b.getAttribute('data-tab');
      bar.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      grid.querySelectorAll('[data-tag]').forEach(function (c) { c.hidden = id !== 'all' && c.getAttribute('data-tag') !== id; });
    });
  });
})();

/* Fold the top menu into the menu button whenever it doesn't fit (any screen width) */
(function () {
  'use strict';
  var root = document.documentElement, bar = document.querySelector('.site-header .bar'), nav = document.querySelector('[data-nav]');
  if (!bar || !nav) return;
  function fit() {
    root.classList.remove('nav-compact');
    nav.classList.remove('open');
    if (getComputedStyle(nav).display === 'none') return; // phone layout already uses the menu button
    var over = bar.scrollWidth > bar.clientWidth + 1 || nav.scrollWidth > nav.clientWidth + 1 ||
      nav.getBoundingClientRect().right > bar.getBoundingClientRect().right + 1;
    if (over) root.classList.add('nav-compact');
  }
  fit();
  window.addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();

/* =====================================================================
   VoucherVault: live expiry, countdowns, region filter, kind tabs and the
   code reveal (copy) modal. Every offer is already in the HTML; this only
   hides/labels cards and opens the modal.
   ===================================================================== */
(function () {
  'use strict';
  var DAY = 864e5;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var days = function (d) { return Math.round((new Date(d + 'T00:00:00') - today) / DAY); };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };

  // Current page in the menu
  document.querySelectorAll('.nav a').forEach(function (a) {
    var p = a.getAttribute('href');
    if (p !== '/' && location.pathname.indexOf(p) === 0) a.setAttribute('aria-current', 'page');
  });

  // 1. Expiry: hide offers past their end date (or past their re-check date), relabel "ends" chips
  document.querySelectorAll('.vc').forEach(function (c) {
    var exp = c.getAttribute('data-expires'), by = c.getAttribute('data-checkby');
    if ((exp && days(exp) < 0) || (by && days(by) < 0)) { c.remove(); return; }
    var ends = c.querySelector('[data-ends]');
    if (ends && exp) {
      var n = days(exp), svg = ends.querySelector('svg');
      var txt = n === 0 ? 'Ends today' : n === 1 ? 'Ends tomorrow' : n <= 7 ? 'Ends in ' + n + ' days' : null;
      if (txt) { ends.textContent = ' ' + txt; if (svg) ends.prepend(svg); ends.classList.toggle('is-soon', n <= 3); }
    }
  });
  document.querySelectorAll('.ticker-run a[data-ends]').forEach(function (a) { if (days(a.getAttribute('data-ends')) < 0) a.remove(); });
  document.querySelectorAll('[data-countdown]').forEach(function (el) {
    var n = days(el.getAttribute('data-countdown'));
    if (n < 0) { var ev = el.closest('.ev'); if (ev) ev.remove(); return; }
    el.textContent = n === 0 ? 'Today!' : n === 1 ? 'Tomorrow' : n + ' days to go';
  });
  // Seamless ticker loop: duplicate the run once
  document.querySelectorAll('.ticker-run').forEach(function (run) {
    if (!run.children.length) { run.closest('.ticker').remove(); return; }
    run.innerHTML += run.innerHTML.replace(/<a /g, '<a tabindex="-1" aria-hidden="true" ');
  });

  // 2. Kind tabs + region filter (combined)
  var region = store.get('vv-region') || 'all';
  function apply() {
    document.querySelectorAll('.blocks-offers').forEach(function (sec) {
      var bar = sec.querySelector('[data-vtabs]');
      var on = bar && bar.querySelector('[aria-pressed="true"]'), kind = on ? on.getAttribute('data-vtab') : 'all';
      var shown = 0, cards = sec.querySelectorAll('.vc');
      cards.forEach(function (c) {
        var okKind = !kind || kind === 'all' || c.getAttribute('data-kind') === kind;
        var okReg = region === 'all' || (' ' + c.getAttribute('data-regions') + ' ').indexOf(' ' + region + ' ') > -1;
        c.hidden = !(okKind && okReg);
        if (!c.hidden) shown++;
      });
      var none = sec.querySelector('.vc-none');
      if (none) none.hidden = shown > 0 || !cards.length;
    });
    document.querySelectorAll('[data-region]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-region') === region)); });
  }
  document.querySelectorAll('[data-vtabs]').forEach(function (bar) {
    bar.hidden = false;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-vtab]'); if (!b) return;
      bar.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      apply();
    });
  });
  document.addEventListener('click', function (e) {
    var r = e.target.closest('[data-region]'), all = e.target.closest('[data-region-all]');
    if (!r && !all) return;
    region = all ? 'all' : r.getAttribute('data-region');
    store.set('vv-region', region);
    apply();
  });
  apply();

  // 3. Code reveal: the first time, the visitor enters email + phone to unlock codes (remembered on this
  //    device), then the code shows with a copy button. Codes live in assets/codes.json, not in the page.
  var SRC = (document.currentScript && document.currentScript.src) || '/assets/site.js';
  var CODES_URL = SRC.replace(/site\.js(\?.*)?$/, 'codes.json'), codesP = null;
  var getCodes = function () { return codesP || (codesP = fetch(CODES_URL).then(function (r) { return r.json(); }).catch(function () { codesP = null; return {}; })); };
  var decode = function (v) { try { return decodeURIComponent(escape(atob(String(v).split('').reverse().join('')))); } catch (e) { return ''; } };
  var UNLOCK = 'vv-unlocked';
  var unlocked = function () { return store.get(UNLOCK) === '1'; };
  var modal = document.createElement('div');
  modal.className = 'vv-modal'; modal.hidden = true;
  modal.innerHTML = '<div class="vv-box" role="dialog" aria-modal="true" aria-labelledby="vv-title">' +
    '<button type="button" class="vv-x" aria-label="Close">×</button><p class="vv-store"></p><h2 class="vv-title" id="vv-title"></h2>' +
    '<form class="vv-gate" novalidate action="" method="post">' +
      '<p class="vv-gate-lead"><b>Unlock this code.</b> Enter your details once and every code on VoucherVault unlocks on this device.</p>' +
      '<div class="vv-names"><label class="vv-f"><span>First name</span><input type="text" name="first_name" id="vv-first" autocomplete="given-name" maxlength="60" required></label>' +
      '<label class="vv-f"><span>Last name</span><input type="text" name="last_name" id="vv-last" autocomplete="family-name" maxlength="60" required></label></div>' +
      '<label class="vv-f"><span>Email address</span><input type="email" name="email" id="vv-email" autocomplete="email" placeholder="you@example.com" required></label>' +
      '<input type="text" name="website" class="vv-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<label class="vv-f"><span>Mobile number</span><input type="tel" name="phone" id="vv-phone" autocomplete="tel" inputmode="tel" placeholder="+44 7700 900123" required></label>' +
      '<label class="vv-c"><input type="checkbox" name="terms" id="vv-terms" required><span>I agree to the <a href="https://shmor.ai/terms/" target="_blank" rel="noopener">Terms</a> and <a href="https://shmor.ai/privacy/" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>' +
      '<label class="vv-c"><input type="checkbox" name="mkt_email" id="vv-mkt-email"><span>Email me new codes and offers ending soon (optional).</span></label>' +
      '<label class="vv-c"><input type="checkbox" name="mkt_sms" id="vv-mkt-sms"><span>Text me big deals by SMS (optional). Msg &amp; data rates may apply. Reply STOP to opt out.</span></label>' +
      '<p class="vv-err" role="alert" hidden></p>' +
      '<button type="submit" class="vc-btn vv-unlock">Unlock code</button>' +
      '<p class="vv-fine">We never sell your details. Unsubscribe from marketing at any time.</p>' +
    '</form>' +
    '<div class="vv-reveal"><div class="vv-code"><output aria-live="polite"></output><button type="button" class="vv-copy">Copy</button></div><p class="vv-copied" aria-live="polite"></p>' +
    '<a class="vc-btn vc-deal vv-go" target="_blank"></a><p class="vv-note"></p></div></div>';
  document.body.appendChild(modal);
  var last = null, current = null;
  var $ = function (s) { return modal.querySelector(s); };
  function copy(text) {
    var done = function () { $('.vv-copied').textContent = 'Copied! Paste it at checkout.'; $('.vv-copy').textContent = 'Copied'; };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { select(); });
    else select();
    function select() { var r = document.createRange(); r.selectNodeContents($('output')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); $('.vv-copied').textContent = 'Code selected: press Ctrl/⌘ + C to copy.'; }
  }
  function showCode(card, btn) {
    modal.classList.remove('is-gate');
    getCodes().then(function (codes) {
      var code = decode(codes[card.id.slice(2)]);
      if (!code) { $('output').textContent = 'Code unavailable'; $('.vv-copied').textContent = 'This code may have just ended. Check the store’s own site.'; return; }
      $('output').textContent = code;
      $('.vv-copied').textContent = ''; $('.vv-copy').textContent = 'Copy';
      $('.vv-copy').focus();
      copy(code);
      btn.classList.add('is-revealed');
      var peek = btn.querySelector('.vc-peek'); if (peek) peek.textContent = code;
    });
  }
  function open(card, btn) {
    last = btn; current = { card: card, btn: btn };
    var href = card.getAttribute('data-href'), aff = card.getAttribute('data-aff') === '1', name = card.getAttribute('data-store');
    $('.vv-store').textContent = name;
    $('.vv-title').textContent = card.getAttribute('data-title');
    var go = $('.vv-go'); go.href = href; go.textContent = 'Go to ' + name + ' ↗';
    go.rel = aff ? 'sponsored nofollow noopener' : 'nofollow noopener';
    var terms = card.querySelector('.vc-terms p');
    $('.vv-note').textContent = terms ? terms.textContent : '';
    $('output').textContent = ''; $('.vv-copied').textContent = '';
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    if (history.replaceState) history.replaceState(null, '', '#' + card.id);
    if (unlocked()) showCode(card, btn);
    else { modal.classList.add('is-gate'); $('.vv-err').hidden = true; getCodes(); setTimeout(function () { $('#vv-first').focus(); }, 30); }
  }
  // Save the unlock details: database (assets/db-config.js) -> provider (gate form action) -> private preview db ("leads") -> local preview server
  function saveLead(row) {
    var action = $('.vv-gate').getAttribute('action');
    var viaDatabase = function () { return window.vvSaveRow ? window.vvSaveRow('leads', row) : Promise.reject(new Error('no database')); };
    var viaProvider = function () {
      if (!action) return Promise.reject(new Error('no provider'));
      var fd = new FormData(); Object.keys(row).forEach(function (k) { fd.append(k, row[k]); });
      return fetch(action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); });
    };
    var viaDb = function () {
      if (!window.claude || !window.claude.use) return Promise.reject(new Error('no viewer'));
      return window.claude.use('db').then(function (db) { if (!db) throw new Error('no db'); return db.collection('leads').add(row); });
    };
    var viaLocal = function () {
      return fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); });
    };
    return viaDatabase().catch(viaProvider).catch(viaDb).catch(viaLocal);
  }
  modal.addEventListener('submit', function (e) {
    var form = e.target.closest('.vv-gate'); if (!form) return;
    e.preventDefault();
    var err = $('.vv-err'), say = function (t, el) { err.textContent = t; err.hidden = false; if (el) el.focus(); };
    var first = $('#vv-first'), lastName = $('#vv-last'), email = $('#vv-email'), phone = $('#vv-phone'), terms = $('#vv-terms');
    var digits = phone.value.replace(/\D/g, '');
    var nameOk = function (v) { v = v.trim(); return v.length >= 1 && v.length <= 60 && !/[<>{}\d@]/.test(v); };
    if (!nameOk(first.value)) return say('Please enter your first name.', first);
    if (!nameOk(lastName.value)) return say('Please enter your last name.', lastName);
    if (!email.value || !email.checkValidity()) return say('Please enter a valid email address.', email);
    if (!/^\+?[\d\s().-]+$/.test(phone.value.trim()) || digits.length < 7 || digits.length > 15) return say('Please enter a valid mobile number, including the country code if you’re outside the UK.', phone);
    if (!terms.checked) return say('Please agree to the Terms and Privacy Policy to unlock codes.', terms);
    err.hidden = true;
    var btn = form.querySelector('.vv-unlock'); btn.disabled = true; btn.textContent = 'Unlocking…';
    var c = current && current.card;
    if ($('.vv-hp').value) { store.set(UNLOCK, '1'); if (current) showCode(current.card, current.btn); return; } // bot trap: unlock but don't save
    var row = { firstName: first.value.trim(), lastName: lastName.value.trim(), email: email.value.trim().toLowerCase(), phone: phone.value.trim(), termsAccepted: true,
      marketingEmail: $('#vv-mkt-email').checked, marketingSms: $('#vv-mkt-sms').checked,
      store: c ? c.getAttribute('data-store-id') : '', offer: c ? c.id.slice(2) : '', page: location.pathname, createdAt: new Date().toISOString() };
    saveLead(row).catch(function () { /* nothing could store it (no provider yet): still unlock, so codes never break */ })
      .then(function () {
        store.set(UNLOCK, '1');
        if (row.marketingEmail) store.set('vv-subscribed', '1');
        btn.disabled = false; btn.textContent = 'Unlock code';
        if (current) showCode(current.card, current.btn);
      });
  });
  function close() {
    modal.hidden = true; document.documentElement.style.overflow = '';
    if (last) last.focus();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-reveal]');
    if (b) { open(b.closest('.vc'), b); return; }
    if (e.target === modal || e.target.closest('.vv-x')) close();
    if (e.target.closest('.vv-copy')) copy($('output').textContent);
  });
  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { // keep focus inside the dialog
      var f = [].filter.call(modal.querySelectorAll('button, a[href], input'), function (el) { return el.offsetParent !== null; }), first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
  });
  // Arriving with #o-<id> (e.g. from the ticker): make sure the card shows
  if (/^#o-/.test(location.hash)) {
    var t = document.getElementById(location.hash.slice(1));
    if (t) { t.hidden = false; t.scrollIntoView({ block: 'center' }); }
  }
})();

/* =====================================================================
   VoucherVault Code Alerts (email sign-up). Every form[data-newsletter]:
   checks email + consent, then saves the sign-up
     1. to a mailing-list provider when the form has an action (set it once a provider is chosen), else
     2. in the private claude.ai preview's database (collection "signups"), else
     3. on the local preview server (tools/serve.js -> subscribers/signups.csv, git-ignored).
   It only says "you're in" when one of those really saved it.
   Also: a dismissible slide-in prompt.
   ===================================================================== */
(function () {
  'use strict';
  var KEY = 'vv-subscribed', HIDE = 'vv-alerts-hidden-until';
  var ls = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  var CONSENT = 'Email me VoucherVault code alerts. I can unsubscribe at any time. <a href="https://shmor.ai/privacy/">Privacy policy</a>.';
  function formHtml(placement, store, btn) {
    var id = 'nl-' + placement + '-' + Math.random().toString(36).slice(2, 7);
    return '<form class="nl-form nl-compact" data-newsletter data-placement="' + placement + '" action="" method="post" target="_blank" novalidate>' +
      (store ? '<input type="hidden" name="store" value="' + store + '">' : '') +
      '<div class="nl-row"><label class="sr" for="' + id + '">Email address</label><input id="' + id + '" type="email" name="email" placeholder="you@example.com" autocomplete="email" required><button type="submit">' + (btn || 'Get alerts') + '</button></div>' +
      '<label class="nl-consent"><input type="checkbox" name="consent" required><span>' + CONSENT + '</span></label><p class="nl-msg" data-newsletter-msg role="status" hidden></p></form>';
  }
  function viaPreviewDb(row) {
    if (!window.claude || !window.claude.use) return Promise.reject(new Error('no viewer'));
    return window.claude.use('db').then(function (db) { if (!db) throw new Error('no db'); return db.collection('signups').add(row); });
  }
  function viaLocalServer(row) {
    return fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); });
  }
  function done() {
    ls.set(KEY, '1');
    var s = document.querySelector('.nl-slide'); if (s) s.hidden = true;
  }
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-newsletter]'); if (!form) return;
    var msg = form.querySelector('[data-newsletter-msg]'), btn = form.querySelector('button[type=submit]');
    var say = function (t) { msg.textContent = t; msg.hidden = false; };
    var email = form.querySelector('input[type=email]'), consent = form.querySelector('input[name=consent]');
    if (!email.value || !email.checkValidity()) { e.preventDefault(); say('Please enter a valid email address.'); email.focus(); return; }
    if (!consent.checked) { e.preventDefault(); say('Please tick the box so we can email you.'); consent.focus(); return; }
    if (form.getAttribute('action')) { done(); say('Almost there! Check your inbox to confirm.'); return; }
    e.preventDefault();
    var interests = [].map.call(form.querySelectorAll('input[name=interest]:checked'), function (x) { return x.value; });
    var store = form.querySelector('input[name=store]');
    var row = { email: email.value.trim().toLowerCase(), consent: true, list: 'code-alerts', interests: interests.join(' '),
      store: store ? store.value : '', placement: form.getAttribute('data-placement') || '', page: location.pathname, signedUpAt: new Date().toISOString() };
    btn.disabled = true; say('Saving…');
    (window.vvSaveRow ? window.vvSaveRow('signups', row) : Promise.reject(new Error('no database')))
      .catch(function () { return viaPreviewDb(row); }).catch(function () { return viaLocalServer(row); }).then(function () {
      form.classList.add('is-done'); email.value = ''; consent.checked = false; done();
      say(row.store ? 'You’re in! We’ll email you new codes for this store.' : 'You’re in! Your first code alerts are on the way.');
    }).catch(function () { say('We couldn’t save that just now. Please try again in a moment.'); })
      .then(function () { btn.disabled = false; });
  });

  // Slide-in prompt: after the reader scrolls 40% or spends 25 s, once per 14 days, never after signing up
  if (!ls.get(KEY) && Date.now() > Number(ls.get(HIDE) || 0)) {
    var slide = document.createElement('aside');
    slide.className = 'nl-slide'; slide.hidden = true; slide.setAttribute('aria-label', 'Code alerts');
    slide.innerHTML = '<button type="button" class="nl-slide-x" aria-label="Close">×</button><p class="nl-slide-k">Free code alerts</p><h2>Get new codes before they’re gone</h2><p>One email a week with fresh codes and offers ending soon.</p>' + formHtml('slide-in');
    document.body.appendChild(slide);
    var shown = false;
    var show = function () { var m = document.querySelector('.vv-modal'); if (shown || ls.get(KEY) || (m && !m.hidden)) return; shown = true; slide.hidden = false; };
    var onScroll = function () { if ((scrollY + innerHeight) / document.documentElement.scrollHeight > 0.4) { show(); removeEventListener('scroll', onScroll); } };
    addEventListener('scroll', onScroll, { passive: true });
    setTimeout(show, 25000);
    slide.querySelector('.nl-slide-x').addEventListener('click', function () { slide.hidden = true; ls.set(HIDE, String(Date.now() + 14 * 864e5)); });
    // Hide it while the footer band is on screen
    var band = document.getElementById('alerts');
    if (band && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { slide.classList.toggle('is-tucked', es[0].isIntersecting); }).observe(band);
  }

})();
