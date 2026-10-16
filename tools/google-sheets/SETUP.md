# Store VoucherVault leads in Google Sheets

Every code unlock (first name, last name, email, mobile, marketing choices, store, offer) goes to a **Leads** tab, and every Code Alerts sign-up to a **Signups** tab, in a Google Sheet you own. Takes about 10 minutes, once.

## 1. Create the sheet
1. Go to <https://sheets.google.com> and create a blank spreadsheet.
2. Name it **VoucherVault leads** (top left). Leave it private: don't share it with anyone.

## 2. Add the script
1. In the sheet: **Extensions → Apps Script**.
2. Delete everything in the editor, then paste the whole of `tools/google-sheets/Code.gs` from the VoucherVault folder.
3. Click the **Save** icon. Name the project **VoucherVault receiver** if asked.

## 3. Publish it as a web app
1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**. ("Anyone" lets the website send rows. The link can only add rows, never show them.)
4. Click **Deploy**, then **Authorize access**, pick your Google account, and allow it. If Google shows "Google hasn't verified this app", click **Advanced → Go to VoucherVault receiver (unsafe)**. It's your own script, so this is expected.
5. Copy the **Web app URL**. It ends in `/exec`.

## 4. Connect the website
Send that URL to Claude in the VoucherVault chat. It goes into `assets/db-config.js` → `sheetsUrl`, then the site is rebuilt. (To do it yourself: paste it between the quotes after `sheetsUrl:`, then run `node tools/build.js`.)

The **Leads** and **Signups** tabs appear with headers the first time someone submits.

## Good to know
- **Changing the script later:** Deploy → Manage deployments → pencil icon → Version: **New version** → Deploy. That keeps the same URL.
- **Privacy:** this sheet holds personal data (names, emails, phone numbers). Keep it private, don't download copies you don't need, and delete rows when someone asks. Only email or text people who ticked the marketing boxes ("Email marketing" / "SMS marketing" = yes).
- **Spam:** the website has a hidden bot trap and the script rejects badly formed rows. If junk still appears, delete those rows.
- **Limits:** fine for thousands of sign-ups a day. If traffic grows a lot, move to a dedicated database or CRM.
