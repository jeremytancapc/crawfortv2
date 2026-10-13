/**
 * Builds the eval cases and their documents from one place.
 *
 * Every case's expected answer comes from the same numbers that are printed on
 * its document, so the two cannot disagree - the usual way a golden set goes
 * wrong is a human mis-copying a figure. Everything is synthetic: fictional
 * people, a fictional bank (HARBOURFRONT, accepted only because run.mts sets
 * TEST_RECOGNISED_BANKS), and every document says SAMPLE on it.
 *
 *   npx tsx evals/make-fixtures.mts
 *
 * Needs Google Chrome to turn the HTML into PDF/PNG. The outputs are committed,
 * so running the evals does not need Chrome - only changing a case does.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures");
const CASES = path.join(HERE, "cases");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

mkdirSync(FIXTURES, { recursive: true });
mkdirSync(CASES, { recursive: true });

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SAMPLE = "SAMPLE - synthetic test document for evaluation. Not a real document.";
const MONTH = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// ── Rendering ─────────────────────────────────────────────────────────────

const tmp = mkdtempSync(path.join(tmpdir(), "evals-"));
function render(html: string, out: string, kind: "pdf" | "png") {
  const src = path.join(tmp, `${path.basename(out)}.html`);
  writeFileSync(src, html);
  const common = ["--headless=new", "--disable-gpu", `--user-data-dir=${path.join(tmp, "profile")}`, "--hide-scrollbars"];
  if (kind === "pdf") {
    execFileSync(CHROME, [...common, "--no-pdf-header-footer", `--print-to-pdf=${out}`, `file://${src}`], { stdio: "ignore" });
  } else {
    execFileSync(CHROME, [...common, "--window-size=700,980", "--force-device-scale-factor=1", `--screenshot=${out}`, `file://${src}`], { stdio: "ignore" });
  }
}

// ── Document templates ────────────────────────────────────────────────────

type Line = [label: string, amount: number];

/** The phone-app payslip layout: name and employee code in the header. */
function appPayslip(a: {
  header: string;
  employer: string;
  year: number;
  month: number;
  earnings: Line[];
  claims?: Line[];
  ytdGross: number;
  ytdNett: number;
  bank?: string;
  skew?: boolean;
  /** An explicit period - half a month, or a week crossing a month end. Default: the whole month. */
  period?: { start: string; end: string };
}) {
  const last = lastDay(a.year, a.month);
  const periodStart = a.period?.start ?? iso(a.year, a.month, 1);
  const periodEnd = a.period?.end ?? iso(a.year, a.month, last);
  const show = (d: string) => `${d.slice(8, 10)} ${MONTH[Number(d.slice(5, 7))]} ${d.slice(0, 4)}`;
  const gross = a.earnings.reduce((s, [, n]) => s + n, 0);
  const claims = (a.claims ?? []).reduce((s, [, n]) => s + n, 0);
  const nett = gross + claims;
  const rows = [...a.earnings, ...(a.claims ?? [])]
    .map(([l, n]) => `<div class=row><span>${l}</span><span>${money(n)}</span></div>`)
    .join("");
  const html = `<html><head><style>
body{font-family:'Helvetica Neue',Arial,sans-serif;margin:0;color:#222;background:${a.skew ? "#d9d6cf" : "#fff"}}
.page{width:520px;margin:30px auto;${a.skew ? "background:#f4f2ec;padding:24px;transform:rotate(1.6deg);filter:blur(0.7px) contrast(0.82) grayscale(0.6);" : ""}}
h1{color:#4a6fa5;font-size:21px;margin:0 0 22px}.l{font-size:14px;margin-bottom:3px}.v{color:#4a6fa5;font-weight:700;font-size:14px;margin-bottom:16px}
.grid{display:grid;grid-template-columns:1fr 1fr;column-gap:20px}.box{border:1px solid #bbb;border-radius:12px;padding:10px 16px;margin:12px 0 18px}
.row{display:flex;justify-content:space-between;font-size:14px;padding:4px 0}.row span:last-child{color:#4a6fa5;font-weight:700}
.foot{display:flex;justify-content:space-between;font-size:14px;margin:8px 0}.foot span:last-child{color:#4a6fa5;font-weight:700}
.note{margin-top:24px;font-size:10px;color:#888}</style></head><body><div class=page>
<h1>${a.header}</h1>
<div class=grid><div><div class=l>Department</div><div class=v>OPERATIONS</div></div><div><div class=l>Designation</div><div class=v>EXECUTIVE</div></div></div>
<div class=l>Company Name</div><div class=v>${a.employer}</div>
<div class=l>Pay Period</div><div class=v>${show(periodStart)} to ${show(periodEnd)}</div>
<div class=box>${rows}</div>
<div class="box grid" style="row-gap:4px">
<div><div class=l>Nett Wages</div><div class=v style="margin-bottom:8px">${money(nett)} / ${money(a.ytdNett)}</div></div>
<div><div class=l>Gross Wages</div><div class=v style="margin-bottom:8px">${money(gross)} / ${money(a.ytdGross)}</div></div></div>
<div class=foot><span>Salary Credited To</span><span>BANK</span></div>
<div class=foot><span>Bank account</span><span>${a.bank ?? "HARBOURFRONT BANK - 0000000000"}</span></div>
<div class=note>${SAMPLE}</div></div></body></html>`;
  return { html, gross, nett, start: periodStart, end: periodEnd };
}

/** The older table layout: net pay beside a year-to-date figure, paid a month later. */
function classicPayslip(a: {
  name: string;
  code: string;
  employer: string;
  year: number;
  month: number;
  earnings: Line[];
  employeeCpf: number;
  ytdNett: number;
  paidOn: string;
}) {
  const last = lastDay(a.year, a.month);
  const gross = a.earnings.reduce((s, [, n]) => s + n, 0);
  const nett = gross - a.employeeCpf;
  const items = a.earnings.map(([l, n]) => `<tr><td class=g>${l}</td><td>${money(n)}</td></tr>`).join("");
  const html = `<html><head><style>body{font-family:Arial,sans-serif;font-size:11px;margin:36px}table{width:100%;border-collapse:collapse}
td{padding:6px 8px;border-bottom:1px solid #ccc}.h td{background:#3a3a3a;color:#fff;font-weight:700}.g{background:#e3e3e3;font-weight:700}</style></head><body>
<p style="font-size:12px"><b>Payslip for 01 ${MONTH[a.month]} ${a.year} to ${last} ${MONTH[a.month]} ${a.year}</b></p><table>
<tr class=h><td colspan=2>NAME OF EMPLOYER</td></tr><tr><td colspan=2><b>${a.employer}</b></td></tr>
<tr class=h><td>NAME OF EMPLOYEE</td><td>EMPLOYEE CODE</td></tr><tr><td><b>${a.name}</b></td><td><b>${a.code}</b></td></tr>
<tr class=h><td>ITEM</td><td>AMOUNT</td></tr>${items}
<tr><td class=g>EMPLOYEE CPF</td><td>-${money(a.employeeCpf)}</td></tr>
<tr class=h><td colspan=2>DATE OF PAYMENT</td></tr><tr><td colspan=2>${a.paidOn}</td></tr>
<tr><td class=g>NET PAY</td><td>${money(nett)} / ${money(a.ytdNett)}</td></tr>
<tr class=h><td colspan=2>MESSAGE</td></tr><tr><td colspan=2 style="color:#888">${SAMPLE}</td></tr></table></body></html>`;
  return { html, gross, nett, start: iso(a.year, a.month, 1), end: iso(a.year, a.month, last) };
}

type Credit = { day: number; amount: number; category: string; text: string };
type Debit = { day: number; amount: number; text: string };

const DESCRIPTIONS: Record<string, string> = {
  salary: "GIRO SALARY KIMSENG FOOD PTE LTD",
  platform_payout: "GRAB HOLDINGS PTE LTD PAYOUT",
  transfer_from_others: "PAYNOW FROM: TEO MEI LING  OTHR",
  cash_deposit: "CASH DEPOSIT MACHINE  BEDOK",
  cpf_life: "CPFB CPF LIFE PAYOUT",
  government_payout: "GOVT GST VOUCHER PAYMENT",
  interest: "INTEREST CREDIT",
  refund_or_reversal: "REFUND SHOPEE SINGAPORE PTE LTD",
  own_account_transfer: "FUNDS TRANSFER FROM OWN A/C 301-000555-2",
  loan_disbursement: "ABC CREDIT PTE LTD LOAN DISBURSEMENT",
};
const credit = (day: number, amount: number, category: string, text = DESCRIPTIONS[category]): Credit => ({ day, amount, category, text });

/** One statement per month, in one document, each with its own printed period. */
function bankStatement(a: {
  bank: string;
  holder: string;
  months: Array<{ year: number; month: number; credits: Credit[]; debits?: Debit[] }>;
}) {
  const sections = a.months
    .map(({ year, month, credits, debits = [] }, i) => {
      const last = lastDay(year, month);
      const rows = [
        ...credits.map((c) => ({ day: c.day, text: c.text, w: "", d: money(c.amount) })),
        ...debits.map((d) => ({ day: d.day, text: d.text, w: money(d.amount), d: "" })),
      ]
        .sort((x, y) => x.day - y.day)
        .map((r) => `<tr><td>${String(r.day).padStart(2, "0")} ${MONTH[month]}</td><td>${r.text}</td><td class=n>${r.w}</td><td class=n>${r.d}</td></tr>`)
        .join("");
      return `<section style="${i ? "page-break-before:always;" : ""}">
<h1>${a.bank} - Statement of Account</h1>
<p>${a.holder}<br>Blk 55 Sample Road #03-12, Singapore 000000</p>
<p><b>Statement period:</b> 01 ${MONTH[month]} ${year} to ${String(last).padStart(2, "0")} ${MONTH[month]} ${year}<br><b>Account:</b> Savings 301-000555-1 (SGD)</p>
<table><tr><th>Date</th><th>Description</th><th class=n>Withdrawal</th><th class=n>Deposit</th></tr>${rows}</table>
<p class=s>${SAMPLE}</p></section>`;
    })
    .join("");
  return `<html><head><style>body{font-family:Arial;font-size:11px;margin:32px}h1{font-size:16px}table{width:100%;border-collapse:collapse;margin-top:14px}
td,th{border-bottom:1px solid #ccc;padding:5px;text-align:left}.n{text-align:right}.s{color:#888;margin-top:20px}</style></head><body>${sections}</body></html>`;
}

function letter(a: { bank: string; holder: string }) {
  return `<html><head><style>body{font-family:Georgia,serif;font-size:13px;margin:56px;line-height:1.5}</style></head><body>
<p><b>${a.bank}</b></p><p>Date: 3 October 2026</p><p>To whom it may concern,</p>
<p>This letter confirms that <b>${a.holder}</b> holds a savings account with us and has done so since 2019. This letter is not a statement of account and shows no transactions or balances.</p>
<p>Yours faithfully,<br>Customer Service</p><p style="color:#888;font-size:10px">${SAMPLE}</p></body></html>`;
}

/** A ride-hailing style earnings statement: fares, less commission and rental, = earnings. */
function earningsStatement(a: { platform: string; name: string; year: number; month: number; fares: number; commission: number; rental: number }) {
  const last = lastDay(a.year, a.month);
  const earnings = a.fares - a.commission - a.rental;
  const html = `<html><head><style>body{font-family:Arial,sans-serif;font-size:12px;margin:40px}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:14px}
td{padding:7px 8px;border-bottom:1px solid #ddd}.n{text-align:right}.t td{font-weight:700;background:#eef6ee}.s{color:#888;margin-top:22px;font-size:10px}</style></head><body>
<h1>${a.platform} - Driver Earnings Statement</h1>
<p>Driver: <b>${a.name}</b><br>Statement period: 01 ${MONTH[a.month]} ${a.year} to ${last} ${MONTH[a.month]} ${a.year}</p>
<table><tr><td>Total fares collected</td><td class=n>${money(a.fares)}</td></tr>
<tr><td>Platform commission</td><td class=n>-${money(a.commission)}</td></tr>
<tr><td>Vehicle rental</td><td class=n>-${money(a.rental)}</td></tr>
<tr class=t><td>Net earnings for the period</td><td class=n>${money(earnings)}</td></tr></table>
<p class=s>${SAMPLE}</p></body></html>`;
  return { html, earnings, start: iso(a.year, a.month, 1), end: iso(a.year, a.month, last) };
}

/** A bank statement printed for periods that do not follow the calendar (15th to 14th). */
function bankStatementPeriods(a: { bank: string; holder: string; periods: Array<{ start: string; end: string; credits: Array<{ date: string; amount: number; category: string }> }> }) {
  const sections = a.periods
    .map(({ start, end, credits }, i) => {
      const rows = credits
        .map((c) => `<tr><td>${c.date.slice(8, 10)} ${MONTH[Number(c.date.slice(5, 7))]}</td><td>${DESCRIPTIONS[c.category]}</td><td class=n></td><td class=n>${money(c.amount)}</td></tr>`)
        .join("");
      const show = (d: string) => `${d.slice(8, 10)} ${MONTH[Number(d.slice(5, 7))]} ${d.slice(0, 4)}`;
      return `<section style="${i ? "page-break-before:always;" : ""}"><h1>${a.bank} - Statement of Account</h1><p>${a.holder}<br>Blk 55 Sample Road #03-12, Singapore 000000</p>
<p><b>Statement period:</b> ${show(start)} to ${show(end)}<br><b>Account:</b> Savings 301-000555-1 (SGD)</p>
<table><tr><th>Date</th><th>Description</th><th class=n>Withdrawal</th><th class=n>Deposit</th></tr>${rows}</table><p class=s>${SAMPLE}</p></section>`;
    })
    .join("");
  return `<html><head><style>body{font-family:Arial;font-size:11px;margin:32px}h1{font-size:16px}table{width:100%;border-collapse:collapse;margin-top:14px}
td,th{border-bottom:1px solid #ccc;padding:5px;text-align:left}.n{text-align:right}.s{color:#888;margin-top:20px}</style></head><body>${sections}</body></html>`;
}

function platformLetter(a: { platform: string; holder: string; month: string; amount: number }) {
  return `<html><head><style>body{font-family:Georgia,serif;font-size:13px;margin:56px;line-height:1.55}</style></head><body>
<p><b>${a.platform}</b></p><p>Date: 8 October 2026</p><p>To Person(s)-In Charge,</p>
<p>This is a letter of engagement for ${a.holder}, who is presently a Freelance Care Professional of ${a.platform}, providing personal home care services.</p>
<p>This is a breakdown of the total pay-out for the care visits completed with us, for the period requested:</p>
<p>${a.month}: $${money(a.amount)}</p>
<p>Yours sincerely,<br>Head of Operations<br>${a.platform}</p><p style="color:#888;font-size:10px">${SAMPLE}</p></body></html>`;
}

// ── Cases ─────────────────────────────────────────────────────────────────

type Case = Record<string, unknown> & { id: string };
const cases: Case[] = [];
const files = (names: string[]) => names.map((file) => ({ file: `fixtures/${file}`, mediaType: file.endsWith(".png") ? "image/png" : "application/pdf" }));
const BANK = "HARBOURFRONT BANK";

// 1. The failure that flaked one run in four: the header prints "NAME (EMPLOYEE NUMBER)".
//
// These are the EXACT files that flaked on 9 Oct (sha256 9a5e09cd / aa015599 /
// 23966b90), committed as they were, not re-rendered. A freshly built lookalike
// did not reproduce the failure at all - 0 in 24 on the old reader - so the
// layout details matter and this case must keep the original bytes. They are
// synthetic (a staging test persona, stamped as not a real payslip).
{
  const name = "CHRISTOPHER DAVID LEE";
  // Newest first, as the upload step sends them - and as they were on 9 Oct.
  // The order is part of the case: the failure showed up with September first.
  const months = [
    { name: "payslip-empno-sep.pdf", month: 9, gross: 29000, nett: 29000 },
    { name: "payslip-empno-aug.pdf", month: 8, gross: 29000, nett: 30200 }, // a 1,200 expense claim is in nett, not in gross
    { name: "payslip-empno-jul.pdf", month: 7, gross: 29000, nett: 29000 },
  ];
  cases.push({
    id: "payslip-empno-3months",
    description: "Three payslips whose header reads NAME (employee number). The reader sometimes returned the number inside the name. The original files from 9 Oct, unchanged.",
    origin: ["add533c", "sha256 9a5e09cd / aa015599 / 23966b90"],
    tags: ["regression", "payslip", "name-with-number"],
    today: "2026-10-09",
    applicant: { name },
    employmentType: "EMPLOYED",
    documents: files(months.map((m) => m.name)),
    expect: {
      reader: {
        readable: true,
        documents: [1, 2, 3].map((index) => ({ index, kind: "payslip", holderName: name, issuer: "CONSULTING" })),
        periods: months.map((m) => ({ start: iso(2026, m.month, 1), end: iso(2026, m.month, lastDay(2026, m.month)), gross: m.gross, net: m.nett })),
      },
      pipeline: { kind: "usable", incomeType: "NON_PANEL_PAYSLIP", m1: 29000, m2: 29000, m3: 29000 },
    },
  });
}

// 2. Year-to-date beside net pay, paid a month later, in the older layout.
{
  const name = "LIM WEI JIE";
  const p = classicPayslip({
    name,
    code: "200418",
    employer: "SAMPLE LOGISTICS PTE LTD",
    year: 2026,
    month: 9,
    earnings: [["BASIC PAY", 6800], ["PERFORMANCE ALLOWANCE", 250]],
    employeeCpf: 1410,
    ytdNett: 49991.4,
    paidOn: "03 Oct 2026",
  });
  render(p.html, path.join(FIXTURES, "payslip-classic-ytd.pdf"), "pdf");
  cases.push({
    id: "payslip-classic-ytd-netpay",
    description: "Net pay printed beside a year-to-date total, paid a month after the period. Gross is for the month, before CPF.",
    origin: ["header comment lib/income-extraction.ts (2026-09-17)"],
    tags: ["payslip", "ytd-column", "payment-date"],
    today: "2026-10-09",
    applicant: { name },
    employmentType: "EMPLOYED",
    documents: files(["payslip-classic-ytd.pdf"]),
    expect: {
      reader: {
        readable: true,
        documents: [{ index: 1, kind: "payslip", holderName: name, issuer: "SAMPLE LOGISTICS" }],
        periods: [{ start: p.start, end: p.end, gross: p.gross, net: p.nett }],
      },
      pipeline: { kind: "usable", incomeType: "NON_PANEL_PAYSLIP", m1: 7050, m2: 0, m3: 0 },
    },
  });
}

// 3. A masked ID and a connector word in the name.
{
  const name = "NURUL AINA BINTE YUSOF";
  const p = appPayslip({
    header: `${name}  S****123A`,
    employer: "SAMPLE RETAIL PTE LTD",
    year: 2026,
    month: 9,
    earnings: [["BASIC PAY", 3500]],
    ytdGross: 31500,
    ytdNett: 28000,
  });
  render(p.html, path.join(FIXTURES, "payslip-masked-id.pdf"), "pdf");
  cases.push({
    id: "payslip-masked-id-name",
    description: "A masked NRIC after the name, and a name with BINTE in it.",
    origin: ["add533c"],
    tags: ["regression", "payslip", "name-with-number", "name-connector"],
    today: "2026-10-09",
    applicant: { name },
    employmentType: "EMPLOYED",
    documents: files(["payslip-masked-id.pdf"]),
    expect: {
      reader: {
        readable: true,
        documents: [{ index: 1, kind: "payslip", holderName: name, issuer: "SAMPLE RETAIL" }],
        periods: [{ start: p.start, end: p.end, gross: 3500, net: 3500 }],
      },
      pipeline: { kind: "usable", incomeType: "NON_PANEL_PAYSLIP", m1: 3500, m2: 0, m3: 0 },
    },
  });
}

// 4. The self-employed statement that was refused: uneven months, October dated ahead.
{
  const holder = "SITI DON ASHIM";
  const doc = bankStatement({
    bank: BANK,
    holder,
    months: [
      { year: 2026, month: 8, credits: [credit(14, 1800, "transfer_from_others", "FAST PAYMENT FROM: ONG CONSULTING PTE LTD INV 2291"), credit(18, 850, "government_payout"), credit(20, 432.73, "cpf_life")], debits: [{ day: 6, amount: 212.4, text: "NETS DEBIT  COLD STORAGE" }] },
      { year: 2026, month: 9, credits: [credit(8, 2447.68, "transfer_from_others", "FAST PAYMENT FROM: ONG CONSULTING PTE LTD INV 2307"), credit(20, 432.73, "cpf_life"), credit(30, 0.62, "interest")], debits: [{ day: 12, amount: 96.3, text: "GIRO SP SERVICES" }] },
      { year: 2026, month: 10, credits: [credit(3, 432.73, "cpf_life")], debits: [{ day: 5, amount: 30, text: "NETS DEBIT  FAIRPRICE" }] },
    ],
  });
  render(doc, path.join(FIXTURES, "bank-freelancer-aug-oct.pdf"), "pdf");
  cases.push({
    id: "bank-freelancer-future-dated",
    description: "Self-employed, three uneven months, the October statement printed to 31 Oct but read on 12 Oct. Neither the uneven months nor the unfinished month may cause a refusal; October is left out.",
    origin: ["7d89ee6"],
    tags: ["regression", "bank", "uneven-months", "future-dated"],
    today: "2026-10-12",
    env: { TEST_RECOGNISED_BANKS: "HARBOURFRONT" },
    applicant: { name: holder },
    employmentType: "SELF EMPLOYED",
    documents: files(["bank-freelancer-aug-oct.pdf"]),
    expect: {
      reader: {
        readable: true,
        documents: [{ index: 1, kind: "bank_statement", holderName: holder, issuer: "HARBOURFRONT" }],
        statements: [
          { start: "2026-08-01", end: "2026-08-31" },
          { start: "2026-09-01", end: "2026-09-30" },
          { start: "2026-10-01", end: "2026-10-31" },
        ],
        credits: [
          { date: "2026-08-14", amount: 1800, category: "transfer_from_others" },
          { date: "2026-08-18", amount: 850, category: "government_payout" },
          { date: "2026-08-20", amount: 432.73, category: "cpf_life" },
          { date: "2026-09-08", amount: 2447.68, category: "transfer_from_others" },
          { date: "2026-09-20", amount: 432.73, category: "cpf_life" },
          { date: "2026-09-30", amount: 0.62, category: "interest" },
          { date: "2026-10-03", amount: 432.73, category: "cpf_life" },
        ],
      },
      pipeline: { kind: "usable", incomeType: "BANK_STATEMENT_OTHER_INCOME", m1: 2880.41, m2: 3082.73, m3: 0 },
    },
  });
}

// 5. Employed: everything that is money in counts, except the five that are not income.
{
  const holder = "LIM WEI JIE";
  const month = (m: number) => ({
    year: 2026,
    month: m,
    credits: [
      credit(25, 3000, "salary"), credit(3, 200, "transfer_from_others"), credit(10, 400, "cash_deposit"),
      credit(28, 0.31, "interest"), credit(18, 36.9, "refund_or_reversal"), credit(8, 1500, "own_account_transfer"), credit(20, 5000, "loan_disbursement"),
    ],
    debits: [{ day: 5, amount: 132.8, text: "NETS DEBIT  NTUC FAIRPRICE" }],
  });
  render(bankStatement({ bank: BANK, holder, months: [month(7), month(8), month(9)] }), path.join(FIXTURES, "bank-employed-mixed.pdf"), "pdf");
  const dates = (m: number) => [
    { date: iso(2026, m, 25), amount: 3000, category: "salary" }, { date: iso(2026, m, 3), amount: 200, category: "transfer_from_others" },
    { date: iso(2026, m, 10), amount: 400, category: "cash_deposit" }, { date: iso(2026, m, 28), amount: 0.31, category: "interest" },
    { date: iso(2026, m, 18), amount: 36.9, category: "refund_or_reversal" }, { date: iso(2026, m, 8), amount: 1500, category: "own_account_transfer" },
    { date: iso(2026, m, 20), amount: 5000, category: "loan_disbursement" },
  ];
  cases.push({
    id: "bank-employed-mixed-credits",
    description: "Employed. Salary, a PayNow from a person and cash count; interest, a refund, money from their own account and a loan do not.",
    origin: ["de9b5d3", "4ca6a8c"],
    tags: ["bank", "credit-categories"],
    today: "2026-10-02",
    env: { TEST_RECOGNISED_BANKS: "HARBOURFRONT" },
    applicant: { name: holder },
    employmentType: "EMPLOYED",
    documents: files(["bank-employed-mixed.pdf"]),
    expect: {
      reader: {
        readable: true,
        documents: [{ index: 1, kind: "bank_statement", holderName: holder, issuer: "HARBOURFRONT" }],
        credits: [...dates(7), ...dates(8), ...dates(9)],
      },
      pipeline: { kind: "usable", incomeType: "BANK_STATEMENT_OTHER_INCOME", m1: 3600, m2: 3600, m3: 3600 },
    },
  });
}

// 6. Unemployed with income: only the CPF payout counts.
{
  const holder = "TEO AH HOCK";
  const month = (m: number) => ({
    year: 2026,
    month: m,
    credits: [credit(3, 500, "transfer_from_others"), credit(10, 300, "cash_deposit"), credit(15, 1060, "cpf_life"), credit(28, 0.31, "interest")],
    debits: [{ day: 5, amount: 85.2, text: "NETS DEBIT  COLD STORAGE" }],
  });
  render(bankStatement({ bank: BANK, holder, months: [month(7), month(8), month(9)] }), path.join(FIXTURES, "bank-unemployed-cpf-life.pdf"), "pdf");
  const dates = (m: number) => [
    { date: iso(2026, m, 3), amount: 500, category: "transfer_from_others" }, { date: iso(2026, m, 10), amount: 300, category: "cash_deposit" },
    { date: iso(2026, m, 15), amount: 1060, category: "cpf_life" }, { date: iso(2026, m, 28), amount: 0.31, category: "interest" },
  ];
  cases.push({
    id: "bank-unemployed-cpf-life",
    description: "Unemployed with income: only the CPF LIFE payout counts, whatever else is paid in.",
    origin: ["4ca6a8c"],
    tags: ["bank", "employment-rule", "cpf-life"],
    today: "2026-10-09",
    env: { TEST_RECOGNISED_BANKS: "HARBOURFRONT" },
    applicant: { name: holder },
    employmentType: "UNEMPLOYED WITH INCOME",
    documents: files(["bank-unemployed-cpf-life.pdf"]),
    expect: {
      reader: {
        readable: true,
        documents: [{ index: 1, kind: "bank_statement", holderName: holder, issuer: "HARBOURFRONT" }],
        credits: [...dates(7), ...dates(8), ...dates(9)],
      },
      pipeline: { kind: "usable", incomeType: "BANK_STATEMENT_OTHER_INCOME", m1: 1060, m2: 1060, m3: 1060 },
    },
  });
}

// 7. Negative: someone else's statement must be refused.
{
  const holder = "GOH MEI LING";
  render(
    bankStatement({ bank: BANK, holder, months: [{ year: 2026, month: 9, credits: [credit(25, 3000, "salary")] }] }),
    path.join(FIXTURES, "bank-someone-else.pdf"),
    "pdf",
  );
  cases.push({
    id: "bank-wrong-name",
    description: "A statement in another person's name. Must be refused, naming the file.",
    origin: ["d6d5c0a"],
    tags: ["bank", "negative", "name-check"],
    today: "2026-10-09",
    env: { TEST_RECOGNISED_BANKS: "HARBOURFRONT" },
    applicant: { name: "LIM WEI JIE" },
    employmentType: "EMPLOYED",
    documents: files(["bank-someone-else.pdf"]),
    expect: {
      reader: { documents: [{ index: 1, kind: "bank_statement", holderName: holder }] },
      pipeline: { kind: "needs_review", reasonMatches: "belong to someone else" },
    },
  });
}

// 8. Negative: a bank that is not a recognised Singapore bank.
{
  const holder = "LIM WEI JIE";
  render(
    bankStatement({ bank: "MERLION SAVINGS BANK", holder, months: [{ year: 2026, month: 9, credits: [credit(25, 3000, "salary")] }] }),
    path.join(FIXTURES, "bank-unrecognised.pdf"),
    "pdf",
  );
  cases.push({
    id: "bank-unrecognised-bank",
    description: "The name is right but the bank is not a recognised Singapore bank. Must be refused.",
    origin: ["d6d5c0a"],
    tags: ["bank", "negative", "bank-check"],
    today: "2026-10-09",
    env: { TEST_RECOGNISED_BANKS: "HARBOURFRONT" },
    applicant: { name: holder },
    employmentType: "EMPLOYED",
    documents: files(["bank-unrecognised.pdf"]),
    expect: {
      reader: { documents: [{ index: 1, kind: "bank_statement", holderName: holder, issuer: "MERLION" }] },
      pipeline: { kind: "needs_review", reasonMatches: "Singapore bank" },
    },
  });
}

// 9. Negative: a document that is not an income document.
{
  const holder = "LIM WEI JIE";
  render(letter({ bank: BANK, holder }), path.join(FIXTURES, "letter-not-income.pdf"), "pdf");
  cases.push({
    id: "letter-not-income",
    description: "A bank letter with no transactions. Must be refused, in a sentence an applicant can act on.",
    origin: ["docs/income-verification.md"],
    tags: ["negative", "refusal-path"],
    today: "2026-10-09",
    env: { TEST_RECOGNISED_BANKS: "HARBOURFRONT" },
    applicant: { name: holder },
    employmentType: "EMPLOYED",
    documents: files(["letter-not-income.pdf"]),
    expect: {
      reader: { documents: [{ index: 1, kind: "other" }] },
      // Refused either as unreadable (the model's own sentence) or as needing
      // review (ours). Either way the applicant is told what to upload.
      pipeline: { kind: ["needs_review", "unreadable"], reasonMatches: "statement" },
    },
  });
}

// 10. A skewed, soft, low-contrast image, like the slow scans that returned markup in the note.
{
  const name = "LIM WEI JIE";
  const p = appPayslip({
    header: name,
    employer: "SAMPLE LOGISTICS PTE LTD",
    year: 2026,
    month: 9,
    earnings: [["BASIC PAY", 4800]],
    ytdGross: 43200,
    ytdNett: 38400,
    skew: true,
  });
  render(p.html, path.join(FIXTURES, "payslip-scanned-skewed.png"), "png");
  cases.push({
    id: "payslip-scanned-skewed",
    description: "A payslip photographed at an angle: skewed, soft and low contrast. Whatever the reader says for an applicant must be a sentence, never markup.",
    origin: ["applicantSafeNote comment lib/income-extraction.ts"],
    tags: ["payslip", "scan", "note-is-sentence"],
    today: "2026-10-09",
    applicant: { name },
    employmentType: "EMPLOYED",
    documents: files(["payslip-scanned-skewed.png"]),
    expect: {
      reader: {
        readable: true,
        documents: [{ index: 1, kind: "payslip", holderName: name, issuer: "SAMPLE LOGISTICS" }],
        periods: [{ start: p.start, end: p.end, gross: 4800, net: 4800 }],
      },
      pipeline: { kind: "usable", incomeType: "NON_PANEL_PAYSLIP", m1: 4800, m2: 0, m3: 0 },
    },
  });
}

// ── Cases 11-23: the rules the first ten did not reach ───────────────────

/** A payslip written to a file, with the figures its case will expect. */
function slip(file: string, a: Parameters<typeof appPayslip>[0]) {
  const p = appPayslip(a);
  render(p.html, path.join(FIXTURES, file), "pdf");
  return p;
}
const READ_OK = (name: string, issuer: string, n: number) => ({
  readable: true,
  documents: Array.from({ length: n }, (_, i) => ({ index: i + 1, kind: "payslip", holderName: name, issuer })),
});

// 11. Paid twice a month: September arrives as two half-month payslips.
{
  const name = "LIM WEI JIE";
  const base = { header: `${name} (200418)`, employer: "SAMPLE LOGISTICS PTE LTD", year: 2026, ytdGross: 40000, ytdNett: 40000 };
  const h1 = slip("payslip-semimonthly-sep1.pdf", { ...base, month: 9, earnings: [["BASIC PAY", 2400]], period: { start: "2026-09-01", end: "2026-09-15" } });
  const h2 = slip("payslip-semimonthly-sep2.pdf", { ...base, month: 9, earnings: [["BASIC PAY", 2600]], period: { start: "2026-09-16", end: "2026-09-30" } });
  const aug = slip("payslip-semimonthly-aug.pdf", { ...base, month: 8, earnings: [["BASIC PAY", 4900]] });
  const jul = slip("payslip-semimonthly-jul.pdf", { ...base, month: 7, earnings: [["BASIC PAY", 4800]] });
  cases.push({
    id: "payslip-semimonthly",
    description: "September as two half-month payslips (1-15 and 16-30), plus monthly August and July. The halves add up to September.",
    origin: ["docs/income-verification.md - which months count"],
    tags: ["payslip", "half-month"],
    today: "2026-10-09", applicant: { name }, employmentType: "EMPLOYED",
    documents: files(["payslip-semimonthly-sep2.pdf", "payslip-semimonthly-sep1.pdf", "payslip-semimonthly-aug.pdf", "payslip-semimonthly-jul.pdf"]),
    expect: {
      reader: { ...READ_OK(name, "SAMPLE LOGISTICS", 4), periods: [h1, h2, aug, jul].map((p) => ({ start: p.start, end: p.end, gross: p.gross, net: p.nett })) },
      pipeline: { kind: "usable", incomeType: "NON_PANEL_PAYSLIP", m1: 5000, m2: 4900, m3: 4800 },
    },
  });
}

// 12. Only the second half of September: ask for the first half, by date.
{
  const name = "LIM WEI JIE";
  slip("payslip-half-only.pdf", { header: `${name} (200418)`, employer: "SAMPLE LOGISTICS PTE LTD", year: 2026, month: 9, earnings: [["BASIC PAY", 2600]], ytdGross: 20000, ytdNett: 20000, period: { start: "2026-09-16", end: "2026-09-30" } });
  cases.push({
    id: "payslip-half-month-only",
    description: "Only 16-30 September. Must ask for the missing days by date rather than ask for everything again.",
    origin: ["docs/income-verification.md - which months count"],
    tags: ["payslip", "half-month", "ask"],
    today: "2026-10-09", applicant: { name }, employmentType: "EMPLOYED",
    documents: files(["payslip-half-only.pdf"]),
    expect: { reader: { readable: true }, pipeline: { kind: "needs_review", reasonMatches: "1 to 15 September" } },
  });
}

// 13. Two jobs in one month: both payslips count, added together.
{
  const name = "NURUL AINA BINTE YUSOF";
  const a = slip("payslip-job-a.pdf", { header: `${name} (A-1042)`, employer: "SAMPLE RETAIL PTE LTD", year: 2026, month: 9, earnings: [["BASIC PAY", 3200]], ytdGross: 28800, ytdNett: 28800 });
  const b = slip("payslip-job-b.pdf", { header: `${name} (B-77)`, employer: "SAMPLE CAFE PTE LTD", year: 2026, month: 9, earnings: [["PART-TIME WAGES", 1100]], ytdGross: 9900, ytdNett: 9900 });
  cases.push({
    id: "payslip-two-employers",
    description: "Two employers' payslips for September. Both count, added together; they are not refused as the same month twice.",
    origin: ["d428225"],
    tags: ["payslip", "two-jobs"],
    today: "2026-10-09", applicant: { name }, employmentType: "EMPLOYED",
    documents: files(["payslip-job-a.pdf", "payslip-job-b.pdf"]),
    expect: {
      reader: { readable: true, documents: [{ index: 1, kind: "payslip", holderName: name, issuer: "SAMPLE RETAIL" }, { index: 2, kind: "payslip", holderName: name, issuer: "SAMPLE CAFE" }], periods: [] },
      pipeline: { kind: "usable", incomeType: "NON_PANEL_PAYSLIP", m1: 4300, m2: 0, m3: 0 },
    },
  });
  void a; void b;
}

// 14. A payslip that is too old to start from.
{
  const name = "LIM WEI JIE";
  slip("payslip-june-only.pdf", { header: `${name} (200418)`, employer: "SAMPLE LOGISTICS PTE LTD", year: 2026, month: 6, earnings: [["BASIC PAY", 4800]], ytdGross: 28800, ytdNett: 28800 });
  cases.push({
    id: "payslip-too-old",
    description: "Only a June payslip, read on 9 October. The latest must be for September or August; it says so.",
    origin: ["docs/income-verification.md - which months count"],
    tags: ["payslip", "window", "ask"],
    today: "2026-10-09", applicant: { name }, employmentType: "EMPLOYED",
    documents: files(["payslip-june-only.pdf"]),
    expect: { reader: { readable: true }, pipeline: { kind: "needs_review", reasonMatches: "latest payslip" } },
  });
}

// 15. Weekly payslips: only monthly payslips are used.
{
  const name = "LIM WEI JIE";
  const weeks = [["2026-08-31", "2026-09-06"], ["2026-09-07", "2026-09-13"], ["2026-09-14", "2026-09-20"], ["2026-09-21", "2026-09-27"], ["2026-09-28", "2026-10-04"]];
  const names = weeks.map((_, i) => `payslip-weekly-${i + 1}.pdf`);
  weeks.forEach(([start, end], i) => slip(names[i], { header: `${name} (200418)`, employer: "SAMPLE LOGISTICS PTE LTD", year: 2026, month: 9, earnings: [["WEEKLY WAGES", 1100]], ytdGross: 40000, ytdNett: 40000, period: { start, end } }));
  cases.push({
    id: "payslip-weekly",
    description: "Five weekly payslips that cover September. Only a monthly payslip is used, so it must ask for one.",
    origin: ["MONTHLY_ONLY policy, lib/income-extraction.ts"],
    tags: ["payslip", "weekly", "ask"],
    today: "2026-10-09", applicant: { name }, employmentType: "EMPLOYED",
    documents: files(names),
    expect: { reader: { readable: true, documents: names.map((_, i) => ({ index: i + 1, kind: "payslip", holderName: name })) }, pipeline: { kind: "needs_review", reasonMatches: "monthly payslip" } },
  });
}

// 16. The same period twice from one employer.
{
  const name = "LIM WEI JIE";
  const base = { header: `${name} (200418)`, employer: "SAMPLE LOGISTICS PTE LTD", year: 2026, month: 9, ytdGross: 43200, ytdNett: 43200 };
  slip("payslip-sep-original.pdf", { ...base, earnings: [["BASIC PAY", 4800]] });
  slip("payslip-sep-revised.pdf", { ...base, earnings: [["BASIC PAY", 4900]] });
  cases.push({
    id: "payslip-same-period-twice",
    description: "An original and a 'revised' payslip for the same September from the same employer. They cover the same days, so one must be chosen - it must not add them or pick one silently.",
    origin: ["lib/income-periods.ts - overlaps"],
    tags: ["payslip", "overlap", "ask"],
    today: "2026-10-09", applicant: { name }, employmentType: "EMPLOYED",
    documents: files(["payslip-sep-original.pdf", "payslip-sep-revised.pdf"]),
    expect: { reader: { readable: true }, pipeline: { kind: "needs_review", reasonMatches: "same days" } },
  });
}

// 17 + 18. A bank statement that shows the pay arriving makes the payslip panel; one that does not, does not.
for (const [id, credited, type, text] of [
  ["payslip-bank-confirms-panel", "net", "PANEL_PAYSLIP", "The bank statement shows the payslip's take-home pay arriving, so the payslip is confirmed (panel)."],
  ["payslip-bank-no-match", 3000, "NON_PANEL_PAYSLIP", "The bank statement shows a different amount arriving, so the payslip stays unconfirmed (non-panel)."],
] as const) {
  const name = "TEO AH HOCK";
  const p = slip(`${id}-slip.pdf`, { header: `${name} (300112)`, employer: "SAMPLE FOODS PTE LTD", year: 2026, month: 9, earnings: [["BASIC PAY", 5200]], ytdGross: 46800, ytdNett: 46800 });
  // What the bank shows must be the payslip's PRINTED net pay to confirm it. (The
  // first version hard-coded 4,160, which this payslip does not print - a fixture
  // error, not a reader one.) `credited` is "net" or a different amount.
  const paidIn = credited === "net" ? p.nett : credited;
  render(bankStatement({ bank: BANK, holder: name, months: [{ year: 2026, month: 9, credits: [credit(28, paidIn, "salary")] }] }), path.join(FIXTURES, `${id}-bank.pdf`), "pdf");
  cases.push({
    id,
    description: text,
    origin: ["de9b5d3"],
    tags: ["payslip", "bank", "panel"],
    today: "2026-10-09", env: { TEST_RECOGNISED_BANKS: "HARBOURFRONT" }, applicant: { name }, employmentType: "EMPLOYED",
    documents: files([`${id}-slip.pdf`, `${id}-bank.pdf`]),
    expect: {
      reader: { readable: true, documents: [{ index: 1, kind: "payslip", holderName: name }, { index: 2, kind: "bank_statement", holderName: name, issuer: "HARBOURFRONT" }] },
      pipeline: { kind: "usable", incomeType: type, m1: 5200, m2: 0, m3: 0 },
    },
  });
}

// 19 + 20. A ride-hailing platform's earnings: after commission and rental; panel when the cash-outs add up.
{
  const name = "RAJESH KUMAR S/O MURUGAN";
  const e = earningsStatement({ platform: "ZOOMRIDE PTE LTD", name, year: 2026, month: 9, fares: 4200, commission: 630, rental: 170 });
  render(e.html, path.join(FIXTURES, "earnings-zoomride-sep.pdf"), "pdf");
  const payouts = [[7, 850], [14, 830], [21, 860], [28, 840]] as const;
  render(
    bankStatement({
      bank: BANK, holder: name,
      months: [{ year: 2026, month: 9, credits: payouts.map(([d, n]) => credit(d, n, "platform_payout", "ZOOMRIDE PTE LTD PAYOUT")) }],
    }),
    path.join(FIXTURES, "bank-zoomride-payouts.pdf"), "pdf",
  );
  const earningsExpect = { readable: true, periods: [{ start: e.start, end: e.end, gross: 3400, net: 3400 }] };
  cases.push({
    id: "earnings-statement-alone",
    description: "A platform earnings statement: earnings are taken after the platform's commission and the vehicle rental (3,400), and it is sent as a payslip, unconfirmed.",
    origin: ["f1137d9"],
    tags: ["earnings-statement", "platform"],
    today: "2026-10-09", applicant: { name }, employmentType: "FULL TIME PLATFORM WORKER",
    documents: files(["earnings-zoomride-sep.pdf"]),
    expect: { reader: { ...earningsExpect, documents: [{ index: 1, kind: "earnings_statement", holderName: name, issuer: "ZOOMRIDE" }] }, pipeline: { kind: "usable", incomeType: "NON_PANEL_PAYSLIP", m1: 3400, m2: 0, m3: 0 } },
  });
  cases.push({
    id: "earnings-statement-multi-cashout-panel",
    description: "The same earnings, paid out in four weekly cash-outs totalling 3,380 (within 10%). The cash-outs together confirm the earnings, so it is panel.",
    origin: ["9472b1f"],
    tags: ["earnings-statement", "bank", "panel", "multi-payout"],
    today: "2026-10-09", env: { TEST_RECOGNISED_BANKS: "HARBOURFRONT" }, applicant: { name }, employmentType: "FULL TIME PLATFORM WORKER",
    documents: files(["earnings-zoomride-sep.pdf", "bank-zoomride-payouts.pdf"]),
    expect: {
      reader: { ...earningsExpect, documents: [{ index: 1, kind: "earnings_statement", holderName: name }, { index: 2, kind: "bank_statement", holderName: name, issuer: "HARBOURFRONT" }] },
      pipeline: { kind: "usable", incomeType: "PANEL_PAYSLIP", m1: 3400, m2: 0, m3: 0 },
    },
  });
}

// 21. Statements cut on the 15th: only a month covered end to end counts.
{
  const holder = "LIM WEI JIE";
  render(
    bankStatementPeriods({
      bank: BANK, holder,
      periods: [
        { start: "2026-08-15", end: "2026-09-14", credits: [{ date: "2026-08-25", amount: 3000, category: "salary" }, { date: "2026-09-10", amount: 200, category: "transfer_from_others" }] },
        { start: "2026-09-15", end: "2026-10-14", credits: [{ date: "2026-09-25", amount: 3000, category: "salary" }, { date: "2026-10-03", amount: 300, category: "transfer_from_others" }] },
      ],
    }),
    path.join(FIXTURES, "bank-cut-mid-month.pdf"), "pdf",
  );
  cases.push({
    id: "bank-cut-mid-month",
    description: "Two statements cut on the 15th. September is covered end to end by the two together (3,200); August is only half covered and October is not over, so neither counts.",
    origin: ["de9b5d3", "7d89ee6"],
    tags: ["bank", "mid-month", "future-dated"],
    today: "2026-10-09", env: { TEST_RECOGNISED_BANKS: "HARBOURFRONT" }, applicant: { name: holder }, employmentType: "EMPLOYED",
    documents: files(["bank-cut-mid-month.pdf"]),
    expect: {
      reader: {
        readable: true,
        documents: [{ index: 1, kind: "bank_statement", holderName: holder, issuer: "HARBOURFRONT" }],
        statements: [{ start: "2026-08-15", end: "2026-09-14" }, { start: "2026-09-15", end: "2026-10-14" }],
      },
      pipeline: { kind: "usable", incomeType: "BANK_STATEMENT_OTHER_INCOME", m1: 3200, m2: 0, m3: 0 },
    },
  });
}

// 22. A month with nothing coming in is said so, not asked for again.
{
  const holder = "LIM WEI JIE";
  render(
    bankStatement({
      bank: BANK, holder,
      months: [
        { year: 2026, month: 7, credits: [credit(25, 3000, "salary")] },
        { year: 2026, month: 8, credits: [credit(28, 0.31, "interest")] },
        { year: 2026, month: 9, credits: [credit(25, 3000, "salary")] },
      ],
    }),
    path.join(FIXTURES, "bank-month-without-income.pdf"), "pdf",
  );
  cases.push({
    id: "bank-month-without-income",
    description: "August shows only interest. For an employed applicant that month has nothing coming in; it must say so, not ask for the same statement again.",
    origin: ["de9b5d3"],
    tags: ["bank", "ask", "empty-month"],
    today: "2026-10-09", env: { TEST_RECOGNISED_BANKS: "HARBOURFRONT" }, applicant: { name: holder }, employmentType: "EMPLOYED",
    documents: files(["bank-month-without-income.pdf"]),
    expect: { reader: { readable: true }, pipeline: { kind: "needs_review", reasonMatches: "money coming in" } },
  });
}

// 23. A letter from a platform that states what was paid out, which is how a freelancer often shows income.
{
  const holder = "LIM WEI JIE";
  render(platformLetter({ platform: "SAMPLE CARE PLATFORM PTE LTD", holder, month: "Sep 2026", amount: 2548.62 }), path.join(FIXTURES, "letter-platform-payout.pdf"), "pdf");
  cases.push({
    id: "letter-platform-payout",
    description: "A platform's letter stating one month's pay-out. It is treated as an earnings statement - a payslip, unconfirmed - and the other two months count as nothing.",
    origin: ["Homage letter question, 8 Oct 2026"],
    tags: ["earnings-statement", "letter"],
    today: "2026-10-09", applicant: { name: holder }, employmentType: "SELF EMPLOYED",
    documents: files(["letter-platform-payout.pdf"]),
    expect: {
      reader: { readable: true, documents: [{ index: 1, kind: "earnings_statement", holderName: holder, issuer: "SAMPLE CARE PLATFORM" }] },
      pipeline: { kind: "usable", incomeType: "NON_PANEL_PAYSLIP", m1: 2548.62, m2: 0, m3: 0 },
    },
  });
}

for (const c of cases) writeFileSync(path.join(CASES, `${c.id}.case.json`), `${JSON.stringify(c, null, 2)}\n`);
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${cases.length} cases and their documents`);
