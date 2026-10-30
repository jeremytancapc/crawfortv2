# Google Sheet worklist: every applicant and where they stand

A sheet staff work from: one row per applicant, the mobile number to call, the
stage they reached, why they stopped, the amounts, the income Ascend was given
and the tenure. It is synced by Apps Script from the view
`reporting.sheet_worklist` (migrations `0019_reporting_sheet_worklist.sql`,
`0020_sheet_worklist_contact.sql` and `0021_sheet_worklist_income_tenure.sql`
in `db/migrations/`).

## What is in it, and what that means for access

The sheet **holds personal data**: the mobile number, the monthly income, and
what Ascend is willing to lend each applicant. It does not hold the name, NRIC, email,
address or anything from MyInfo, and it never will - the reader login can only
read this one view.

Because the sheet lives in Google, outside our own systems, the mobile numbers
and amounts are only as protected as the sheet is. Before applying `0020` and `0021`:

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

Row 1 is the header, written by the script. The sync writes **A-X** every run
and never touches **Y-AA**, the team's columns - including any formula in them,
such as one that fills in the PIC.

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
| K | V1 (pre-approved amount) | The **Maximum Loan Quantum** from MLCB: the figure the offer screen shows as the "pre-approved amount". What they could unlock, not an offer |
| L | V2 (A-Card credit amount) | The **A-Card Limit**: what Ascend is willing to lend today, and the most they can draw. Blank until Ascend answers with a pass and a figure |
| M | Requested | What they asked for at the start. **Replaced by the amount they chose to draw once they pick a plan** - the app keeps one figure |
| N | Income | The monthly income Ascend was last given: from the documents they submitted, otherwise from MyInfo |
| O | Income type | Ascend's label for that income: `NOA`, `CPF`, `NON_PANEL_PAYSLIP`, `PANEL_PAYSLIP`, `BANK_STATEMENT_OTHER_INCOME`, `SELF-DECLARED` |
| P | Plan chosen | |
| Q | Loan tenure | e.g. `6 months`. Like Requested, replaced by the plan's tenure once they choose one |
| R | Decline reason | The choice they picked on the offer screen |
| S | Booking (SGT) | Date and time, if booked |
| T | Documents uploaded | Count |
| U | Last document issue | The sentence they were shown when a document was refused |
| V | Why no Ascend order | Code, only for `submitted_no_ascend_order` |
| W | Sent to AirConnect (SGT) | When the lead was pushed; blank means not in AirConnect yet |
| X | Last synced | |
| Y | Remarks | Team |
| Z | PIC | Team |
| AA | Called on | Team |

Filter on **Needs follow-up = Yes** for the call list; sort by **Hours since
last activity**. The amounts (K-N) are numbers, so they sort and sum.

K and L are different amounts and must not be read as one (see `CONTEXT.md`,
"Amounts"): K is the ceiling the applicant was shown, L is what Ascend will
actually lend today and the most they can draw. Everything comes from this
app's own database; nothing in the sheet is read from AirConnect.

## 1. Database (once per environment)

Apply migrations `0019` to `0021` with `node scripts/db-migrate.mjs`. `0019`
creates the view and a login, `sheet_worklist_reader`, that can read that view
and nothing else; `0020` adds the mobile number and the two amounts; `0021` adds
the requested amount, the income, its type and the tenure. The
login has no password until you set one (never commit it):

```sql
alter role sheet_worklist_reader with password '<from the password manager>';
```

## 2. Apps Script

The scripts are `scripts/sheet-worklist/stg-cfv2.gs` (staging, tab
`[STG] CrawfortV2`, function `syncCrawfortWorklist`) and
`scripts/sheet-worklist/prod-cfv2.gs` (production, tab `[PROD] CrawfortV2`,
function `syncCrawfortWorklistProd`). They differ only in names, the tab and
the database, so both can sit in one Apps Script project next to other files.
Change both together. In the sheet, Extensions → Apps Script: paste each as its
own file and fill in its `CONFIG`.

- **Anyone who can edit the sheet's script can read `CONFIG`**, and **File →
  Make a copy** copies it. Give edit access only to the few who need it.
- **Use the `sheet_worklist_reader` login only**, never the owner or
  `looker_reader`: a leaked script then reads nothing but this view.
- **Neon only accepts encrypted connections.** If Apps Script fails to connect,
  check the error before adding URL parameters: Apps Script rejects some
  (`sslmode` among them).

Add a time-driven trigger for each sync function (for example every 15
minutes). Neither file has an `onOpen`: a project can only have one, so add the
menu items to the one the project already has.

On its first run, a script brings an older sheet up to date by **inserting** the
new columns where they belong, not by rewriting the header over them: the
team's Remarks, PIC and Called on move right with their rows, formulas
included. It also sets the number format of every synced column on each run,
because a cell keeps its format when its value changes - without that, a column
that used to hold dates shows hours and counts as dates.

## Known gaps

- **Not in AirConnect yet (column W blank):** an applicant is pushed only once
  Ascend opens an order, so earlier stages can't be looked up there by ref. They
  still have a mobile number in column C, which is the point of adding it.
- **Rows only leave the window, never the sheet:** an applicant older than
  `DAYS_BACK` days with no upcoming booking stops being refreshed but stays.
- **Requested and Loan tenure lose the first answer:** choosing a plan overwrites
  both with the plan's figures, so what the applicant first asked for is not kept.
