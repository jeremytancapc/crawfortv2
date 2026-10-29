# Google Sheet worklist: every applicant and where they stand

A sheet staff work from: one row per applicant, the stage they reached, and
why they stopped. It is synced by Apps Script from the view
`reporting.sheet_worklist` (migration `db/migrations/0019_reporting_sheet_worklist.sql`).

It holds **no personal data**: no name, NRIC, mobile, email, address, income or
loan amounts. The sheet lives in Google, outside our own systems, and company
policy (PDPA) does not allow customer details to be copied there. Staff find
the customer in AirConnect by the **CFH5-** reference. For the figures, use the
Data Studio report (`docs/data-studio-report.md`), which stays inside its own
read-only connection.

## Columns

Row 1 is the header, written by the script. The sync writes **A–Q** every run
and never touches **R–T**.

| Col | Header | Meaning |
|---|---|---|
| A | Created (SGT) | When the applicant started |
| B | Ref | **Key.** `CFH5-` and the last 8 characters of the applicant id |
| C | Applied via | `singpass` or the manual form |
| D | Pile | `booked` / `got_credit_limit` / `reloan` / `other` (see the Data Studio doc) |
| E | Stage | Where they stopped, e.g. `plan_chosen_not_booked` (see the stage table in the Data Studio doc) |
| F | Needs follow-up | `Yes` for every stage except booked, declined and existing customer |
| G | Hours since last activity | |
| H | Last activity (SGT) | |
| I | Ascend result | `passed` / `pending` / `rejected` |
| J | Plan chosen | |
| K | Decline reason | The choice they picked on the offer screen |
| L | Booking (SGT) | Date and time, if booked |
| M | Documents uploaded | Count |
| N | Last document issue | The sentence they were shown when a document was refused |
| O | Why no Ascend order | Code, only for `submitted_no_ascend_order` |
| P | Sent to AirConnect (SGT) | When the lead was pushed; blank means not in AirConnect yet |
| Q | Last synced | |
| R | Remarks | Team |
| S | PIC | Team |
| T | Called on | Team |

Filter on **Needs follow-up = Yes** for the call list; sort by **Hours since
last activity**.

## 1. Database (once per environment)

Apply migration `0019` with `node scripts/db-migrate.mjs`. It creates the view
and a login, `sheet_worklist_reader`, that can read that view and nothing else.
The login has no password until you set one (never commit it):

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
const SYNC_COLS = 17;   // A–Q; R–T are never written by the sync
const DAYS_BACK = 30;
const HEADERS = [
  'Created (SGT)', 'Ref', 'Applied via', 'Pile', 'Stage', 'Needs follow-up',
  'Hours since last activity', 'Last activity (SGT)', 'Ascend result', 'Plan chosen',
  'Decline reason', 'Booking (SGT)', 'Documents uploaded', 'Last document issue',
  'Why no Ascend order', 'Sent to AirConnect (SGT)', 'Last synced',
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

/** Writes the header row if row 1 doesn't already have it. */
function ensureHeader_(sheet) {
  if (String(sheet.getRange(1, KEY_COL).getValue()).trim() === HEADERS[KEY_COL - 1]) return;
  if (sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].some(String)) sheet.insertRowBefore(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/** Refreshes A–Q for every applicant from the last DAYS_BACK days or with an upcoming booking. */
function syncCrawfortWorklist() {
  const sql = `
    select created_sgt, ref, applied_via, pile, stage, needs_follow_up,
           hours_since_last_activity, last_activity_sgt, ascend_result, plan_chosen,
           decline_reason, booking_sgt, documents_uploaded, last_document_issue,
           no_order_reason, sent_to_airconnect_sgt
    from reporting.sheet_worklist
    where created_at > (now() at time zone 'Asia/Singapore') - interval '${DAYS_BACK} days'
       or booking_date >= current_date
    order by created_at asc`;

  const conn = Jdbc.getConnection(props_('DB_URL'), props_('DB_USER'), props_('DB_PASSWORD'));
  const rs = conn.createStatement().executeQuery(sql);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found`);
  ensureHeader_(sheet);

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
    const row = [];
    for (let c = 1; c <= 16; c++) row.push(rs.getString(c) || '');
    row.push(synced); // Q: last synced
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

- **Not in AirConnect yet (column P blank):** an applicant is pushed only once
  Ascend opens an order, so earlier stages can't be looked up there by ref.
- **Rows only leave the window, never the sheet:** an applicant older than
  `DAYS_BACK` days with no upcoming booking stops being refreshed but stays.
