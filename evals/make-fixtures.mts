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
}) {
  const last = lastDay(a.year, a.month);
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
<div class=l>Pay Period</div><div class=v>01 ${MONTH[a.month]} ${a.year} to ${last} ${MONTH[a.month]} ${a.year}</div>
<div class=box>${rows}</div>
<div class="box grid" style="row-gap:4px">
<div><div class=l>Nett Wages</div><div class=v style="margin-bottom:8px">${money(nett)} / ${money(a.ytdNett)}</div></div>
<div><div class=l>Gross Wages</div><div class=v style="margin-bottom:8px">${money(gross)} / ${money(a.ytdGross)}</div></div></div>
<div class=foot><span>Salary Credited To</span><span>BANK</span></div>
<div class=foot><span>Bank account</span><span>${a.bank ?? "HARBOURFRONT BANK - 0000000000"}</span></div>
<div class=note>${SAMPLE}</div></div></body></html>`;
  return { html, gross, nett, start: iso(a.year, a.month, 1), end: iso(a.year, a.month, last) };
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

for (const c of cases) writeFileSync(path.join(CASES, `${c.id}.case.json`), `${JSON.stringify(c, null, 2)}\n`);
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${cases.length} cases and their documents`);
