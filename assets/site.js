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

  // 3. Code reveal modal
  var modal = document.createElement('div');
  modal.className = 'vv-modal'; modal.hidden = true;
  modal.innerHTML = '<div class="vv-box" role="dialog" aria-modal="true" aria-labelledby="vv-title">' +
    '<button type="button" class="vv-x" aria-label="Close">×</button><p class="vv-store"></p><h2 class="vv-title" id="vv-title"></h2>' +
    '<div class="vv-code"><output aria-live="polite"></output><button type="button" class="vv-copy">Copy</button></div><p class="vv-copied" aria-live="polite"></p>' +
    '<a class="vc-btn vc-deal vv-go" target="_blank"></a><p class="vv-note"></p></div>';
  document.body.appendChild(modal);
  var last = null;
  var $ = function (s) { return modal.querySelector(s); };
  function copy(text) {
    var done = function () { $('.vv-copied').textContent = 'Copied! Paste it at checkout.'; $('.vv-copy').textContent = 'Copied'; };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { select(); });
    else select();
    function select() { var r = document.createRange(); r.selectNodeContents($('output')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); $('.vv-copied').textContent = 'Code selected: press Ctrl/⌘ + C to copy.'; }
  }
  function open(card, btn) {
    last = btn;
    var code = card.getAttribute('data-code'), href = card.getAttribute('data-href'), aff = card.getAttribute('data-aff') === '1', name = card.getAttribute('data-store');
    $('.vv-store').textContent = name;
    $('.vv-title').textContent = card.getAttribute('data-title');
    $('output').textContent = code;
    $('.vv-copied').textContent = ''; $('.vv-copy').textContent = 'Copy';
    var go = $('.vv-go'); go.href = href; go.textContent = 'Go to ' + name + ' ↗';
    go.rel = aff ? 'sponsored nofollow noopener' : 'nofollow noopener';
    var terms = card.querySelector('.vc-terms p');
    $('.vv-note').textContent = terms ? terms.textContent : '';
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    $('.vv-copy').focus();
    copy(code);
    btn.classList.add('is-revealed');
    var peek = btn.querySelector('.vc-peek'); if (peek) peek.textContent = code;
    if (history.replaceState) history.replaceState(null, '', '#' + card.id);
  }
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
      var f = modal.querySelectorAll('button, a[href]'), first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
  });
  // Arriving with #o-<id> (e.g. from the ticker): make sure the card shows and show its code in place
  if (/^#o-/.test(location.hash)) {
    var t = document.getElementById(location.hash.slice(1));
    if (t) {
      t.hidden = false;
      var rb = t.querySelector('[data-reveal]'), pk = rb && rb.querySelector('.vc-peek');
      if (pk) { rb.classList.add('is-revealed'); pk.textContent = t.getAttribute('data-code'); }
      t.scrollIntoView({ block: 'center' });
    }
  }
})();
