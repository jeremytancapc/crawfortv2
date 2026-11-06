// Crawfort v2 worklist (PRODUCTION). Names start with CFP_ / cfp so they never clash
// with stg-cfv2.gs or the AXS file in the same project.
const CFP_CONFIG = {
  DB_URL: '<jdbc:postgresql://production neon host:5432/neondb>',
  DB_USER: 'sheet_worklist_reader',
  DB_PASSWORD: '<production reader password>',
};

const CFP_SHEET_NAME = '[PROD] CrawfortV2';
const CFP_HEADER_ROWS = 1;
const CFP_KEY_COL = 2;      // B: Ref
const CFP_SYNC_COLS = 25;   // A–Y; Z–AB are the team's and never written by the sync
const CFP_DAYS_BACK = 30;
const CFP_HEADERS = [
  'Created (SGT)', 'Ref', 'Mobile', 'Applied via', 'Pile', 'Stage', 'Needs follow-up',
  'Hours since last activity', 'Last activity (SGT)', 'Ascend result', 'Ascend reason',
  'V1 (Pre-Approved)', 'V2 (A-Card)', 'Requested', 'Income', 'Income type',
  'Plan chosen', 'Loan tenure', 'Decline reason', 'Booking (SGT)', 'Documents uploaded',
  'Last document issue', 'Why no Ascend order', 'Sent to AirConnect (SGT)', 'Last synced',
  'Remarks', 'PIC', 'Called on',
];
// The number format of each synced column, A–Y. Applied on every run: a cell
// keeps its format when its value changes, so without this a column that used to
// hold dates goes on showing a count or an hour total as a date.
const CFP_FORMATS = [
  'yyyy-mm-dd hh:mm', '@', '@', '@', '@', '@', '@',  // A created; B–G text (C: mobile)
  '0', 'yyyy-mm-dd hh:mm', '@', '@',                 // H hours, I last activity, J result, K reason
  '#,##0', '#,##0', '#,##0', '#,##0', '@',           // L V1, M V2, N requested, O income, P type
  '@', '@', '@', 'yyyy-mm-dd hh:mm', '0', '@', '@',  // Q, R tenure, S, T booking, U documents, V, W
  'yyyy-mm-dd hh:mm', 'yyyy-mm-dd hh:mm',            // X sent to AirConnect, Y last synced
];

function cfpConfig_(name) {
  const v = CFP_CONFIG[name];
  if (!v || v.startsWith('<')) throw new Error(`${name} is not filled in at the top of prod-cfv2.gs`);
  return v;
}

/** A figure the sheet can sort and sum, or '' when there is none (never 0). */
function cfpNum_(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? '' : n;
}

/**
 * Brings row 1 up to date, moving older layouts' columns so nothing the team
 * typed is written over.
 *
 * Earlier layouts are recognised by where Remarks sits. Each gets its new columns
 * inserted where they belong, so Remarks, PIC and Called on - and any formula in
 * them - move right with their rows instead of being overwritten by the sync:
 *   first  (Remarks in R): Mobile after B, V1 and V2 after Ascend result
 *   second (Remarks in U): Requested, Income and Income type after V2,
 *                          Loan tenure after Plan chosen
 * third  (Remarks in Y, 24 columns, no Ascend reason): Ascend reason after Ascend
 *                          result. Every older layout above ends up here first, so each
 *                          also gets this column last.
 * A sheet synced while it had Approved V1 and Approved V2 in M and N (Remarks in
 * AA) has those two columns deleted instead, which moves the team's columns
 * back left with their rows. M and N only ever held a copy of the A-Card limit.
 * The team's header cells (Remarks, PIC, Called on) are only written when empty,
 * so a formula in one of them is kept.
 */
function cfpEnsureHeader_(sheet) {
  const width = Math.max(CFP_HEADERS.length, sheet.getLastColumn());
  const row1 = sheet.getRange(1, 1, 1, width).getValues()[0].map((v) => String(v).trim());
  const synced = CFP_HEADERS.slice(0, CFP_SYNC_COLS);
  const team = CFP_HEADERS.slice(CFP_SYNC_COLS);

  if (!synced.every((h, i) => row1[i] === h)) {
    let layout = 0;
    if (row1[2] === 'Applied via' && row1[17] === 'Remarks') layout = 1;
    else if (row1[10] === 'V1 pre-approved' && row1[20] === 'Remarks') layout = 2;
    else if (row1[12] === 'Approved V1' && row1[13] === 'Approved V2' && row1[26] === 'Remarks') layout = 4;
    else if (row1[10] === 'V1 (Pre-Approved)' && row1[23] === 'Last synced' && row1[24] === 'Remarks') layout = 5;

    if (layout === 1) {
      sheet.insertColumnAfter(2);       // C: Mobile
      sheet.insertColumnsAfter(10, 2);  // K, L: V1 and V2
      layout = 2;
    }
    if (layout === 2) {
      sheet.insertColumnsAfter(12, 3);  // M, N, O: Requested, Income, Income type
      sheet.insertColumnAfter(16);      // Q: Loan tenure, after Plan chosen
    } else if (layout === 4) {
      sheet.deleteColumns(13, 2);       // M, N: Approved V1 and Approved V2
    }
    if (layout === 1 || layout === 2 || layout === 4 || layout === 5) {
      // Every layout above has reached the 24-column one by now: add Ascend reason after
      // Ascend result (J), so Remarks, PIC and Called on move right with their rows.
      sheet.insertColumnAfter(10);      // K: Ascend reason
    } else if (row1[CFP_KEY_COL - 1] !== CFP_HEADERS[CFP_KEY_COL - 1] && row1.some(String)) {
      // Row 1 holding data rather than any header: push it down, never overwrite it.
      sheet.insertRowBefore(1);
    }
    sheet.getRange(1, 1, 1, CFP_SYNC_COLS).setValues([synced]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const teamRange = sheet.getRange(1, CFP_SYNC_COLS + 1, 1, team.length);
  const current = teamRange.getValues()[0];
  if (current.some((v) => String(v).trim() === '')) {
    teamRange.setValues([team.map((h, i) => (String(current[i]).trim() === '' ? h : current[i]))])
      .setFontWeight('bold');
  }
}

/** Applies CFP_FORMATS to every data row of A–Y. The header row and the team columns are left alone. */
function cfpEnsureFormats_(sheet) {
  const rows = sheet.getMaxRows() - CFP_HEADER_ROWS;
  if (rows < 1) return;
  sheet.getRange(CFP_HEADER_ROWS + 1, 1, rows, CFP_SYNC_COLS)
    .setNumberFormats(Array.from({ length: rows }, () => CFP_FORMATS));
}

/** Refreshes A–Y for every applicant from the last CFP_DAYS_BACK days or with an upcoming booking. */
function syncCrawfortWorklistProd() {
  const sql = `
    select created_sgt, ref, mobile, applied_via, pile, stage, needs_follow_up,
           hours_since_last_activity, last_activity_sgt, ascend_result, ascend_reason,
           max_loan_quantum, acard_limit, requested, income, income_type,
           plan_chosen, loan_tenure, decline_reason, booking_sgt,
           documents_uploaded, last_document_issue, no_order_reason,
           sent_to_airconnect_sgt
    from reporting.sheet_worklist
    where created_at > (now() at time zone 'Asia/Singapore') - interval '${CFP_DAYS_BACK} days'
       or booking_date >= current_date
    order by created_at asc`;

  const conn = Jdbc.getConnection(cfpConfig_('DB_URL'), cfpConfig_('DB_USER'), cfpConfig_('DB_PASSWORD'));
  const rs = conn.createStatement().executeQuery(sql);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFP_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${CFP_SHEET_NAME}" not found`);
  cfpEnsureHeader_(sheet);
  cfpEnsureFormats_(sheet);

  const lastRow = sheet.getLastRow();
  const rowOf = {};
  if (lastRow > CFP_HEADER_ROWS) {
    sheet.getRange(CFP_HEADER_ROWS + 1, CFP_KEY_COL, lastRow - CFP_HEADER_ROWS, 1).getValues()
      .forEach(([v], i) => { if (v) rowOf[String(v).trim()] = CFP_HEADER_ROWS + 1 + i; });
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
      cfpNum_(rs.getString('hours_since_last_activity')),
      rs.getString('last_activity_sgt') || '',
      rs.getString('ascend_result') || '',
      rs.getString('ascend_reason') || '',                // K: Ascend's reason for leaving it pending
      cfpNum_(rs.getString('max_loan_quantum')),            // L: V1 (Pre-Approved)
      cfpNum_(rs.getString('acard_limit')),                 // M: V2 (A-Card)
      cfpNum_(rs.getString('requested')),                   // N
      cfpNum_(rs.getString('income')),                      // O
      rs.getString('income_type') || '',                   // P
      rs.getString('plan_chosen') || '',
      rs.getString('loan_tenure') || '',                   // R
      rs.getString('decline_reason') || '',
      rs.getString('booking_sgt') || '',
      cfpNum_(rs.getString('documents_uploaded')),
      rs.getString('last_document_issue') || '',
      rs.getString('no_order_reason') || '',
      rs.getString('sent_to_airconnect_sgt') || '',
      synced,                                              // Y: last synced
    ];
    const at = rowOf[row[CFP_KEY_COL - 1]];
    if (at) updates.push({ at, row }); else inserts.push(row);
  }
  rs.close();
  conn.close();

  updates.forEach(({ at, row }) => sheet.getRange(at, 1, 1, CFP_SYNC_COLS).setValues([row]));
  if (inserts.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, inserts.length, CFP_SYNC_COLS).setValues(inserts);
  }
  console.log(`Crawfort v2 worklist (prod): ${updates.length} updated, ${inserts.length} added`);
}
