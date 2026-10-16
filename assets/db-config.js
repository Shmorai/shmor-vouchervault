/* =====================================================================
   VoucherVault: where code-unlock details and Code Alerts sign-ups are stored.

   Database: Supabase (hosted Postgres). Create the tables once with
   tools/supabase-setup.sql, then paste the project's URL and its PUBLIC
   "anon" key below. The anon key is safe in a web page: the tables' row-level
   security only lets visitors ADD rows, never read, change or delete them.
   Read and export the data in the Supabase dashboard (Table Editor → leads / signups).
   Never put the "service_role" key here.

   While url/anonKey are empty, forms fall back to the private preview's
   database or the local preview server (see assets/site.js).
   ===================================================================== */
window.VV_DB = {
  url: '',      // e.g. 'https://abcdefghijklmnop.supabase.co'
  anonKey: '',  // Project Settings → API → Project API keys → anon / public
};

(function () {
  'use strict';
  var cfg = window.VV_DB || {};
  if (!cfg.url || !cfg.anonKey) return; // not connected yet: site.js uses its fallbacks
  // camelCase fields from the forms → snake_case columns in tools/supabase-setup.sql
  var COLS = {
    leads: { firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone', termsAccepted: 'terms_accepted',
      marketingEmail: 'marketing_email', marketingSms: 'marketing_sms', store: 'store', offer: 'offer', page: 'page' },
    signups: { email: 'email', list: 'list', interests: 'interests', store: 'store', placement: 'placement', page: 'page', consent: 'consent' },
  };
  window.vvSaveRow = function (table, row) {
    var map = COLS[table], body = {};
    if (!map) return Promise.reject(new Error('unknown table'));
    Object.keys(map).forEach(function (k) { if (row[k] !== undefined && row[k] !== '') body[map[k]] = row[k]; });
    return fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/' + table, {
      method: 'POST',
      headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    }).then(function (r) { if (!r.ok) throw new Error('Database HTTP ' + r.status); });
  };
})();
