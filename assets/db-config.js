/* =====================================================================
   VoucherVault: where code-unlock details (name, email, mobile) and Code
   Alerts sign-ups are stored.

   Storage: a Google Sheet you own, via a small Apps Script web app
   (tools/google-sheets/Code.gs, steps in tools/google-sheets/SETUP.md).
   Paste the web app link ("…/macros/s/…/exec") below. The link can only ADD
   rows; it never shows the sheet's contents.

   While sheetsUrl is empty, forms fall back to the private preview's
   database or the local preview server (see assets/site.js).
   ===================================================================== */
window.VV_DB = {
  // "VoucherVault leads" sheet (youtube@shmor.ai), Apps Script "VoucherVault receiver", deployed 2026-10-16
  sheetsUrl: 'https://script.google.com/macros/s/AKfycbw5fW4AN0g0czi2upmuHLT01YbP9VIc3KmJBrO46-wSlBoUEFaud45kINeujvw6j7_VuA/exec',
};

(function () {
  'use strict';
  var url = (window.VV_DB || {}).sheetsUrl;
  if (!url) return; // not connected yet: site.js uses its fallbacks
  // table = "leads" (code unlocks) or "signups" (Code Alerts). Sent as text/plain so the
  // browser makes a simple request (no CORS preflight, which Apps Script can't answer).
  window.vvSaveRow = function (table, row) {
    var body = JSON.stringify(Object.assign({ sheet: table }, row));
    return fetch(url, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (res) { if (!res || !res.ok) throw new Error('Sheet refused the row'); })
      .catch(function (err) {
        // A refusal is a real failure. If only the reply couldn't be read (some privacy
        // extensions block it), the row has normally landed already, so don't resend
        // (that would duplicate it) and treat it as saved.
        if (err && err.message === 'Sheet refused the row') throw err;
      });
  };
})();
