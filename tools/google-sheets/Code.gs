/**
 * VoucherVault → Google Sheets receiver (Google Apps Script web app).
 *
 * Paste this whole file into Extensions → Apps Script in your Google Sheet,
 * then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * Full steps: tools/google-sheets/SETUP.md.
 *
 * The website POSTs one JSON row per unlock / sign-up. This script checks it
 * and appends it to the "Leads" or "Signups" tab (created with headers on
 * first use). It never returns any stored data, so the public link can only
 * ADD rows, not read them.
 */

var SHEETS = {
  leads: {
    tab: 'Leads',
    columns: ['Received', 'First name', 'Last name', 'Email', 'Mobile', 'Email marketing', 'SMS marketing', 'Terms accepted', 'Store', 'Offer', 'Page'],
    row: function (d) {
      return [new Date(), d.firstName, d.lastName, d.email, d.phone, yes(d.marketingEmail), yes(d.marketingSms), yes(d.termsAccepted), d.store, d.offer, d.page];
    },
    valid: function (d) {
      var digits = String(d.phone || '').replace(/\D/g, '');
      return name(d.firstName) && name(d.lastName) && email(d.email) && digits.length >= 7 && digits.length <= 15 && d.termsAccepted === true;
    },
  },
  signups: {
    tab: 'Signups',
    columns: ['Received', 'Email', 'List', 'Interests', 'Store', 'Where they signed up', 'Page', 'Consent'],
    row: function (d) {
      return [new Date(), d.email, d.list || 'code-alerts', d.interests, d.store, d.placement, d.page, yes(d.consent)];
    },
    valid: function (d) { return email(d.email) && d.consent === true; },
  },
};

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var cfg = SHEETS[data.sheet];
    if (!cfg) return reply(false, 'unknown sheet');
    if (data.website) return reply(true, 'ok'); // bot trap field filled: pretend success, store nothing
    if (!cfg.valid(data)) return reply(false, 'invalid');
    lock.waitLock(10000);
    var sheet = tab(cfg);
    sheet.appendRow(cfg.row(data).map(clean));
    return reply(true, 'saved');
  } catch (err) {
    return reply(false, 'error');
  } finally {
    try { lock.releaseLock(); } catch (x) { /* not held */ }
  }
}

// A plain visit to the web app link just confirms it's running (shows no data).
function doGet() { return reply(true, 'VoucherVault receiver is running'); }

function tab(cfg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(cfg.tab) || ss.insertSheet(cfg.tab);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(cfg.columns);
    sheet.getRange(1, 1, 1, cfg.columns.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Keep cells as plain text: stops "+44…" being read as a number and blocks
// spreadsheet formulas sent by spammers (values starting with = + - @).
function clean(v) {
  if (v instanceof Date) return v;
  var s = String(v === undefined || v === null ? '' : v).slice(0, 300);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
function yes(v) { return v === true ? 'yes' : 'no'; }
function name(v) { v = String(v || '').trim(); return v.length >= 1 && v.length <= 60 && !/[<>{}@\d]/.test(v); }
function email(v) { v = String(v || ''); return v.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }
function reply(ok, msg) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok, message: msg })).setMimeType(ContentService.MimeType.JSON);
}
