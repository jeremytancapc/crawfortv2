# Google Sheet worklist: every applicant and where they stand

A sheet staff work from: one row per applicant, the mobile number to call, the
stage they reached, why they stopped, and the two credit limits that applicant
has been given. It is synced by Apps Script from the view
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

Row 1 is the header, written by the script. The sync writes **A-U** every run
and never touches **V-X**.

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
| K | V1 pre-approved | What the **first H5** pre-approved them for (`cf_h5_v1`). From AirConnect, not from this app - see "3. The V1 column". Blank for anyone the first H5 never pre-approved |
| L | V2 A-Card limit | The **A-Card Limit**: what Ascend is willing to lend, which is what this app (`cf_h5_v2`) sends to AirConnect. Blank until Ascend answers with a pass and a figure |
| M | Max loan quantum | The **Maximum Loan Quantum** from MLCB - the ceiling across all licensed moneylenders, shown on the offer screen as the "pre-approved amount". What they could unlock, not an offer |
| N | Plan chosen | |
| O | Decline reason | The choice they picked on the offer screen |
| P | Booking (SGT) | Date and time, if booked |
| Q | Documents uploaded | Count |
| R | Last document issue | The sentence they were shown when a document was refused |
| S | Why no Ascend order | Code, only for `submitted_no_ascend_order` |
| T | Sent to AirConnect (SGT) | When the lead was pushed; blank means not in AirConnect yet |
| U | Last synced | |
| V | Remarks | Team |
| W | PIC | Team |
| X | Called on | Team |

Filter on **Needs follow-up = Yes** for the call list; sort by **Hours since
last activity**. **K**, **L** and **M** are numbers, so they sort and sum.

K, L and M are three different amounts and must not be read as one (see
`CONTEXT.md`, "Amounts"): K is what the old funnel promised, L is what Ascend
will actually lend today, M is the regulatory ceiling. A K far above L is worth
a call - that applicant was told a bigger figure once.

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
  // AirConnect, for column K only (see "3. The V1 column"). Leave AC_DB_URL
  // empty and everything else still syncs, with K blank.
  AC_DB_URL: '',
  AC_DB_USER: 'cf_sheet_v1_reader',
  AC_DB_PASSWORD: '',
};

const SHEET_NAME = 'Crawfort v2';
const HEADER_ROWS = 1;
const KEY_COL = 2;      // B: Ref
const MOBILE_COL = 3;   // C
const AMOUNT_COLS = [11, 12, 13]; // K, L, M
const SYNC_COLS = 21;   // A-U; V-X are never written by the sync
const DAYS_BACK = 30;
const HEADERS = [
  'Created (SGT)', 'Ref', 'Mobile', 'Applied via', 'Pile', 'Stage', 'Needs follow-up',
  'Hours since last activity', 'Last activity (SGT)', 'Ascend result',
  'V1 pre-approved', 'V2 A-Card limit', 'Max loan quantum',
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

/**
 * The last 8 digits, which is how one Singapore mobile matches across systems:
 * we store `91234567`, AirConnect may hold `+6591234567` or `65 9123 4567`.
 */
function last8_(mobile) {
  return String(mobile || '').replace(/\D/g, '').slice(-8);
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

/**
 * The first H5's pre-approved amount per mobile, from AirConnect.
 *
 * Returns {} when AirConnect is not configured or unreachable: column K is
 * extra information, and the rest of the worklist must still sync without it.
 */
function preApprovedV1_() {
  const url = CONFIG.AC_DB_URL;
  if (!url || url.startsWith('<')) return {};
  try {
    const conn = Jdbc.getConnection(url, CONFIG.AC_DB_USER, CONFIG.AC_DB_PASSWORD);
    const rs = conn.createStatement().executeQuery('select mobile8, v1_amount from sheet_v1_limit');
    const byMobile = {};
    while (rs.next()) byMobile[rs.getString('mobile8')] = num_(rs.getString('v1_amount'));
    rs.close();
    conn.close();
    return byMobile;
  } catch (e) {
    console.warn(`AirConnect unreachable, column K left blank: ${e.message}`);
    return {};
  }
}

/** Refreshes A-U for every applicant from the last DAYS_BACK days or with an upcoming booking. */
function syncCrawfortWorklist() {
  const sql = `
    select created_sgt, ref, mobile, applied_via, pile, stage, needs_follow_up,
           hours_since_last_activity, last_activity_sgt, ascend_result,
           acard_limit, max_loan_quantum, plan_chosen, decline_reason, booking_sgt,
           documents_uploaded, last_document_issue, no_order_reason,
           sent_to_airconnect_sgt
    from reporting.sheet_worklist
    where created_at > (now() at time zone 'Asia/Singapore') - interval '${DAYS_BACK} days'
       or booking_date >= current_date
    order by created_at asc`;

  const v1 = preApprovedV1_();

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
  let v1Hits = 0;
  while (rs.next()) {
    const mobile = rs.getString('mobile') || '';
    const v1Amount = v1[last8_(mobile)];
    if (v1Amount !== undefined && v1Amount !== '') v1Hits++;
    const row = [
      rs.getString('created_sgt') || '',
      rs.getString('ref') || '',
      mobile,                                              // C
      rs.getString('applied_via') || '',
      rs.getString('pile') || '',
      rs.getString('stage') || '',
      rs.getString('needs_follow_up') || '',
      num_(rs.getString('hours_since_last_activity')),
      rs.getString('last_activity_sgt') || '',
      rs.getString('ascend_result') || '',
      v1Amount === undefined ? '' : v1Amount,              // K: from AirConnect
      num_(rs.getString('acard_limit')),                   // L
      num_(rs.getString('max_loan_quantum')),              // M
      rs.getString('plan_chosen') || '',
      rs.getString('decline_reason') || '',
      rs.getString('booking_sgt') || '',
      num_(rs.getString('documents_uploaded')),
      rs.getString('last_document_issue') || '',
      rs.getString('no_order_reason') || '',
      rs.getString('sent_to_airconnect_sgt') || '',
      synced,                                              // U
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
  console.log(`Crawfort v2 worklist: ${updates.length} updated, ${inserts.length} added, ${v1Hits} with a V1 limit`);
}
```

Then reload the sheet for the **Crawfort v2** menu, and add a time-driven
trigger for `syncCrawfortWorklist` (for example every 15 minutes). If the
spreadsheet already has an `onOpen` (another sync script), merge the two into
one: a project can only have one.

## 3. The V1 column

Column K is the only thing in the sheet that does not come from this app's
database, and the only step that touches another system. **It is optional**:
leave `AC_DB_URL` empty and K stays blank.

The first H5's pre-approved amount was never sent to this database. Both H5s
report their limits to AirConnect instead - the first as `cf_h5_v1`, this one as
`cf_h5_v2` (see `docs/ascend-open-api.md`, "The credit limit we give
AirConnect") - so AirConnect's `t3gallery_credit_limits` is the only place both
figures exist. One read-only view there gives the sheet the V1 figure and
nothing else.

Run this once per environment in **AirConnect's** database (`t3gallery`), dev
before production. Like our own reader, the view runs with its owner's rights,
which is what lets the role read it with no grant on the tables behind it:

```sql
-- One row per mobile number: the latest amount the first H5 pre-approved.
-- Leads and borrowers both carry limits, and the same person can be in either.
create or replace view sheet_v1_limit as
with v1 as (
  select right(regexp_replace(l.phone_number, '\D', '', 'g'), 8) as mobile8,
         cl.amount, cl.received_at
  from t3gallery_credit_limits cl
  join t3gallery_leads l on l.id = cl.lead_id
  where cl.source = 'cf_h5_v1'
  union all
  select right(regexp_replace(b.phone_number, '\D', '', 'g'), 8) as mobile8,
         cl.amount, cl.received_at
  from t3gallery_credit_limits cl
  join t3gallery_borrowers b on b.id = cl.borrower_id
  where cl.source = 'cf_h5_v1'
)
select distinct on (mobile8) mobile8, amount as v1_amount, received_at as v1_at
from v1
order by mobile8, received_at desc;

create role cf_sheet_v1_reader login connection limit 3;
grant select on sheet_v1_limit to cf_sheet_v1_reader;
-- Set the password by hand, and never commit it:
alter role cf_sheet_v1_reader with password '<from the password manager>';
```

Then put the AirConnect host and that password into `CONFIG` and sync. The log
line ends with how many rows got a V1 figure; `0 with a V1 limit` means the
match found nothing - check that AirConnect's `phone_number` and our `mobile`
agree in their last 8 digits.

The join is on the **last 8 digits** of the mobile, not the whole string: we
store what the applicant typed (usually `91234567`) and AirConnect is sent
E.164 (`+6591234567`). It follows that an applicant whose number is not a
Singapore mobile will not match, and that two people sharing a number cannot be
told apart - this column is background for a call, not a record to act on.

## Known gaps

- **Not in AirConnect yet (column T blank):** an applicant is pushed only once
  Ascend opens an order, so earlier stages can't be looked up there by ref. They
  still have a mobile number in column C, which is the point of adding it.
- **Rows only leave the window, never the sheet:** an applicant older than
  `DAYS_BACK` days with no upcoming booking stops being refreshed but stays.
- **Column K is a snapshot of AirConnect, keyed by number.** It is read fresh
  every sync, but a limit the first H5 recorded against a different number for
  the same person will not show.
