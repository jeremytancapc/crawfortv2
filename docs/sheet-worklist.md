# Google Sheet worklist: every applicant and where they stand

A sheet staff work from: one row per applicant, the mobile number to call, the
stage they reached, why they stopped, and two amounts: the V1 pre-approved
amount and the V2 A-Card limit. It is synced by Apps Script from the view
`reporting.sheet_worklist` (migrations
`db/migrations/0019_reporting_sheet_worklist.sql` and
`db/migrations/0020_sheet_worklist_contact.sql`).

## What is in it, and what that means for access

The sheet **holds personal data**: the mobile number, and what Ascend is
willing to lend each applicant. It does not hold the name, NRIC, email,
address or anything from MyInfo, and it never will - the reader login can only
read this one view.

Because the sheet lives in Google, outside our own systems, the mobile numbers
and amounts are only as protected as the sheet is. Before applying `0020`:

- **Share with named staff only.** No "anyone with the link", no public
  publishing, no embedding.
- **Viewer, not Editor**, for everyone who only reads it. An Editor can read
  the database password in the Apps Script.
- **Turn off copy, print and download** for viewers (Share → ⚙).
- **No copies.** File → Make a copy takes the script, the password and the
  numbers with it.
- Anyone added needs to be someone who may see customer contact details in the
  first place.

If any of that cannot be guaranteed, revert to `0019`'s column set, which has
no personal data in it, and keep using the **CFH5-** reference to look the
customer up in AirConnect.

## Columns

Row 1 is the header, written by the script. The sync writes **A-T** every run
and never touches **U-W**.

| Col | Header | Meaning |
|---|---|---|
| A | Created (SGT) | When the applicant started |
| B | Ref | **Key.** `CFH5-` and the last 8 characters of the applicant id |
| C | Mobile | As the applicant gave it, usually 8 local digits. Kept as text so the leading digit survives |
| D | Applied via | `singpass` or the manual form |
| E | Pile | `booked` / `got_credit_limit` / `reloan` / `other` (see the Data Studio doc) |
| F | Stage | Where they stopped, e.g. `plan_chosen_not_booked` (see the stage table in the Data Studio doc) |
| G | Needs follow-up | `Yes` for every stage except booked, declined and existing customer |
| H | Hours since last activity | |
| I | Last activity (SGT) | |
| J | Ascend result | `passed` / `pending` / `rejected` |
| K | V1 pre-approved | The **Maximum Loan Quantum** from MLCB: the figure the offer screen shows as the "pre-approved amount". The ceiling across all licensed moneylenders - what they could unlock, not an offer |
| L | V2 A-Card limit | The **A-Card Limit**: what Ascend is willing to lend today, and the most they can draw. Blank until Ascend answers with a pass and a figure |
| M | Plan chosen | |
| N | Decline reason | The choice they picked on the offer screen |
| O | Booking (SGT) | Date and time, if booked |
| P | Documents uploaded | Count |
| Q | Last document issue | The sentence they were shown when a document was refused |
| R | Why no Ascend order | Code, only for `submitted_no_ascend_order` |
| S | Sent to AirConnect (SGT) | When the lead was pushed; blank means not in AirConnect yet |
| T | Last synced | |
| U | Remarks | Team |
| V | PIC | Team |
| W | Called on | Team |

Filter on **Needs follow-up = Yes** for the call list; sort by **Hours since
last activity**. **K** and **L** are numbers, so they sort and sum.

K and L are different amounts and must not be read as one (see `CONTEXT.md`,
"Amounts"): K is the ceiling the applicant was shown, L is what Ascend will
actually lend today and the most they can draw. Both come from this app's own
database; nothing in the sheet is read from AirConnect.

## 1. Database (once per environment)

Apply migrations `0019` and `0020` with `node scripts/db-migrate.mjs`. `0019`
creates the view and a login, `sheet_worklist_reader`, that can read that view
and nothing else; `0020` adds the mobile number and the two amounts to it. The
login has no password until you set one (never commit it):

```sql
alter role sheet_worklist_reader with password '<from the password manager>';
```

## 2. Apps Script

In the sheet, Extensions → Apps Script. Paste the script and fill in `CONFIG`.

- **Anyone who can edit the sheet's script can read `CONFIG`**, and **File →
  Make a copy** copies it. Give edit access only to the few who need it.
- **Use the `sheet_worklist_reader` login only**, never the owner or
  `looker_reader`: a leaked script then reads nothing but this view.
- **Neon only accepts encrypted connections.** If Apps Script fails to connect,
  check the error before adding URL parameters: Apps Script rejects some
  (`sslmode` among them).

```javascript
// Fill these in. See "2. Apps Script" for who can read them.
const CONFIG = {
  DB_URL: 'jdbc:postgresql://<neon host>:5432/neondb',
  DB_USER: 'sheet_worklist_reader',
  DB_PASSWORD: '<reader password>',
};

const SHEET_NAME = 'Crawfort v2';
const HEADER_ROWS = 1;
const KEY_COL = 2;      // B: Ref
const MOBILE_COL = 3;   // C
const AMOUNT_COLS = [11, 12]; // K, L
const SYNC_COLS = 20;   // A-T; U-W are never written by the sync
const DAYS_BACK = 30;
const HEADERS = [
  'Created (SGT)', 'Ref', 'Mobile', 'Applied via', 'Pile', 'Stage', 'Needs follow-up',
  'Hours since last activity', 'Last activity (SGT)', 'Ascend result',
  'V1 pre-approved', 'V2 A-Card limit',
  'Plan chosen', 'Decline reason', 'Booking (SGT)', 'Documents uploaded',
  'Last document issue', 'Why no Ascend order', 'Sent to AirConnect (SGT)', 'Last synced',
  'Remarks', 'PIC', 'Called on',
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Crawfort v2')
    .addItem('Sync now', 'syncCrawfortWorklist')
    .addToUi();
}

function props_(name) {
  const v = CONFIG[name];
  if (!v || v.startsWith('<')) throw new Error(`${name} is not filled in at the top of the script`);
  return v;
}

/** A figure the sheet can sort and sum, or '' when there is none. */
function num_(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? '' : n;
}

/** Writes the header row, and rewrites it when the columns have changed. */
function ensureHeader_(sheet) {
  const row1 = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].map((v) => String(v).trim());
  if (HEADERS.every((h, i) => row1[i] === h)) return;
  // Row 1 holding data rather than any header: push it down, never overwrite it.
  if (row1[KEY_COL - 1] !== HEADERS[KEY_COL - 1] && row1.some(String)) sheet.insertRowBefore(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/** Mobile as text (or Sheets eats the leading digit), amounts as figures. */
function ensureFormats_(sheet) {
  const rows = sheet.getMaxRows();
  sheet.getRange(1, MOBILE_COL, rows, 1).setNumberFormat('@');
  AMOUNT_COLS.forEach((c) => sheet.getRange(1, c, rows, 1).setNumberFormat('#,##0'));
}

/** Refreshes A-T for every applicant from the last DAYS_BACK days or with an upcoming booking. */
function syncCrawfortWorklist() {
  const sql = `
    select created_sgt, ref, mobile, applied_via, pile, stage, needs_follow_up,
           hours_since_last_activity, last_activity_sgt, ascend_result,
           max_loan_quantum, acard_limit, plan_chosen, decline_reason, booking_sgt,
           documents_uploaded, last_document_issue, no_order_reason,
           sent_to_airconnect_sgt
    from reporting.sheet_worklist
    where created_at > (now() at time zone 'Asia/Singapore') - interval '${DAYS_BACK} days'
       or booking_date >= current_date
    order by created_at asc`;

  const conn = Jdbc.getConnection(props_('DB_URL'), props_('DB_USER'), props_('DB_PASSWORD'));
  const rs = conn.createStatement().executeQuery(sql);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found`);
  ensureHeader_(sheet);
  ensureFormats_(sheet);

  const lastRow = sheet.getLastRow();
  const rowOf = {};
  if (lastRow > HEADER_ROWS) {
    sheet.getRange(HEADER_ROWS + 1, KEY_COL, lastRow - HEADER_ROWS, 1).getValues()
      .forEach(([v], i) => { if (v) rowOf[String(v).trim()] = HEADER_ROWS + 1 + i; });
  }

  const synced = Utilities.formatDate(new Date(), 'Asia/Singapore', 'yyyy-MM-dd HH:mm');
  const updates = [];
  const inserts = [];
  while (rs.next()) {
    const row = [
      rs.getString('created_sgt') || '',
      rs.getString('ref') || '',
      rs.getString('mobile') || '',                        // C
      rs.getString('applied_via') || '',
      rs.getString('pile') || '',
      rs.getString('stage') || '',
      rs.getString('needs_follow_up') || '',
      num_(rs.getString('hours_since_last_activity')),
      rs.getString('last_activity_sgt') || '',
      rs.getString('ascend_result') || '',
      num_(rs.getString('max_loan_quantum')),              // K: V1 pre-approved
      num_(rs.getString('acard_limit')),                   // L: V2 A-Card limit
      rs.getString('plan_chosen') || '',
      rs.getString('decline_reason') || '',
      rs.getString('booking_sgt') || '',
      num_(rs.getString('documents_uploaded')),
      rs.getString('last_document_issue') || '',
      rs.getString('no_order_reason') || '',
      rs.getString('sent_to_airconnect_sgt') || '',
      synced,                                              // T
    ];
    const at = rowOf[row[KEY_COL - 1]];
    if (at) updates.push({ at, row }); else inserts.push(row);
  }
  rs.close();
  conn.close();

  updates.forEach(({ at, row }) => sheet.getRange(at, 1, 1, SYNC_COLS).setValues([row]));
  if (inserts.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, inserts.length, SYNC_COLS).setValues(inserts);
  }
  console.log(`Crawfort v2 worklist: ${updates.length} updated, ${inserts.length} added`);
}
```

Then reload the sheet for the **Crawfort v2** menu, and add a time-driven
trigger for `syncCrawfortWorklist` (for example every 15 minutes). If the
spreadsheet already has an `onOpen` (another sync script), merge the two into
one: a project can only have one.

## Known gaps

- **Not in AirConnect yet (column S blank):** an applicant is pushed only once
  Ascend opens an order, so earlier stages can't be looked up there by ref. They
  still have a mobile number in column C, which is the point of adding it.
- **Rows only leave the window, never the sheet:** an applicant older than
  `DAYS_BACK` days with no upcoming booking stops being refreshed but stays.
