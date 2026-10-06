import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { extractIncome, type IncomeDocument } from "./income-extraction";

/**
 * extractIncome with the model replaced by what it reported. The reading is
 * the model's job; everything after it - whose documents they are, which
 * credits are income, which months count, the sums, the asks and the income
 * type Ascend is told - is ours, and is what these pin down.
 */
type Kind = "payslip" | "bank_statement" | "earnings_statement" | "other";
type Category =
  | "salary" | "platform_payout" | "transfer_from_others" | "cash_deposit" | "government_payout"
  | "own_account_transfer" | "interest" | "refund_or_reversal" | "loan_disbursement" | "other";

type Report = {
  readable?: boolean;
  note?: string;
  documents: Array<{ index: number; kind: Kind; holderName: string; issuer: string }>;
  periods?: Array<{ start: string; end: string; gross: number; net: number; employer: string; document?: number }>;
  statements?: Array<{ start: string; end: string }>;
  credits?: Array<{ date: string; amount: number; payer: string; category: Category }>;
};

function reporting(report: Report): Anthropic {
  const input = { readable: true, note: "", periods: [], statements: [], credits: [], ...report };
  return {
    messages: {
      create: async () => ({
        content: [{ type: "tool_use", id: "t", name: "report_income", input }],
      }),
    },
  } as unknown as Anthropic;
}

// 2 Oct 2026: the latest document has to be for September or August.
const TODAY = new Date("2026-10-02T00:00:00Z");
const APPLICANT = { name: "TAN CAKEN" };

const files = (n: number): IncomeDocument[] =>
  Array.from({ length: n }, (_, i) => ({
    fileName: `doc-${i + 1}.pdf`, mediaType: "application/pdf", bytes: Buffer.from("x"),
  }));

const read = (report: Report) =>
  extractIncome(files(report.documents.length), {
    client: reporting(report), today: TODAY, applicant: APPLICANT,
  });

const payslip = (index: number) => ({ index, kind: "payslip" as const, holderName: "TAN CAKEN", issuer: "Kimseng Food" });
const statement = (index: number, bank = "OCBC Bank") =>
  ({ index, kind: "bank_statement" as const, holderName: "TAN CAKEN", issuer: bank });

const SEP = { start: "2026-09-01", end: "2026-09-30", gross: 5200, net: 4160, employer: "Kimseng Food" };
const AUG = { start: "2026-08-01", end: "2026-08-31", gross: 5100, net: 4080, employer: "Kimseng Food" };
const JUL = { start: "2026-07-01", end: "2026-07-31", gross: 5000, net: 4000, employer: "Kimseng Food" };

const JUL_ST = { start: "2026-07-01", end: "2026-07-31" };
const AUG_ST = { start: "2026-08-01", end: "2026-08-31" };
const SEP_ST = { start: "2026-09-01", end: "2026-09-30" };
const salary = (date: string, amount: number) =>
  ({ date, amount, payer: "KIMSENG FOOD PTE LTD", category: "salary" as const });

describe("extractIncome - payslips", () => {
  it("submits payslips alone as non-panel, on their gross pay", async () => {
    const outcome = await read({
      documents: [payslip(1), payslip(2), payslip(3)],
      periods: [SEP, AUG, JUL],
    });

    expect(outcome).toMatchObject({
      kind: "usable",
      m1: 5200, m2: 5100, m3: 5000,
      incomeType: "NON_PANEL_PAYSLIP",
      fileTypes: ["NON_PANEL_PAYSLIP", "NON_PANEL_PAYSLIP", "NON_PANEL_PAYSLIP"],
      advice: null,
    });
  });

  it("goes ahead on one September payslip, counting the months with no payslip as S$0", async () => {
    const outcome = await read({ documents: [payslip(1)], periods: [SEP] });

    // Not 5200 for all three: we do not know what they earned in July and
    // August, so we do not put a figure there.
    expect(outcome).toMatchObject({ kind: "usable", m1: 5200, m2: 0, m3: 0 });
    if (outcome.kind !== "usable") return;
    expect(outcome.missing).toEqual(["2026-07", "2026-08"]);
    expect(outcome.advice).toContain("July and August 2026");
    expect(outcome.advice).toContain("S$0");
  });

  it("accepts a payslip for the current month, as well as last month or the one before", async () => {
    // Today is 2 Oct 2026: October, September and August are all recent enough.
    const OCT = { start: "2026-10-01", end: "2026-10-31", gross: 5300, net: 4240, employer: "Kimseng Food" };
    const outcome = await read({ documents: [payslip(1)], periods: [OCT] });

    expect(outcome).toMatchObject({ kind: "usable", m1: 5300, m2: 0, m3: 0 });
  });

  it("asks for September or August when the latest payslip is older", async () => {
    const outcome = await read({
      documents: [payslip(1)],
      periods: [{ ...JUL, start: "2026-06-01", end: "2026-06-30" }],
    });

    expect(outcome).toMatchObject({
      kind: "needs_review",
      reason: "Please upload your latest payslip - for September or August 2026.",
    });
  });

  it("does not let a payslip for a later month into the figures", async () => {
    const outcome = await read({
      documents: [payslip(1), payslip(2)],
      periods: [{ ...SEP, start: "2026-11-01", end: "2026-11-30", gross: 9000 }, SEP],
    });

    expect(outcome).toMatchObject({ kind: "usable", m1: 5200 });
  });
});

describe("extractIncome - payslips seen arriving in the bank are panel payslips", () => {
  it("is panel when every payslip's take-home pay is credited on the statement", async () => {
    const outcome = await read({
      documents: [payslip(1), payslip(2), payslip(3), statement(4)],
      periods: [SEP, AUG, JUL],
      statements: [JUL_ST, AUG_ST, SEP_ST],
      credits: [salary("2026-07-31", 4000), salary("2026-08-31", 4080), salary("2026-09-30", 4160)],
    });

    expect(outcome).toMatchObject({
      kind: "usable",
      // The payslip's gross, not the bank's net: income is before CPF.
      m1: 5200, m2: 5100, m3: 5000,
      incomeType: "PANEL_PAYSLIP",
      fileTypes: ["PANEL_PAYSLIP", "PANEL_PAYSLIP", "PANEL_PAYSLIP", "BANK_STATEMENT_OTHER_INCOME"],
    });
  });

  it("finds pay credited early the next month", async () => {
    const outcome = await read({
      documents: [payslip(1), statement(2)],
      periods: [AUG],
      statements: [AUG_ST, SEP_ST],
      credits: [salary("2026-09-03", 4080)],
    });

    expect(outcome).toMatchObject({ incomeType: "PANEL_PAYSLIP" });
  });

  it("stays non-panel when one month's pay is not on the statement", async () => {
    const outcome = await read({
      documents: [payslip(1), payslip(2), payslip(3), statement(4)],
      periods: [SEP, AUG, JUL],
      statements: [JUL_ST, AUG_ST, SEP_ST],
      credits: [salary("2026-07-31", 4000), salary("2026-09-30", 4160)],
    });

    expect(outcome).toMatchObject({ kind: "usable", incomeType: "NON_PANEL_PAYSLIP" });
  });
});

describe("extractIncome - bank statements alone count everything coming in", () => {
  it("counts salary, PayNow from people, cash and CPF LIFE; not interest, refunds, own transfers or loans", async () => {
    const month = (m: string) => [
      salary(`${m}-25`, 3000),
      { date: `${m}-03`, amount: 200, payer: "TAN WEI LING", category: "transfer_from_others" as const },
      { date: `${m}-10`, amount: 400, payer: "", category: "cash_deposit" as const },
      { date: `${m}-15`, amount: 300, payer: "CPF BOARD", category: "government_payout" as const },
      { date: `${m}-28`, amount: 0.42, payer: "", category: "interest" as const },
      { date: `${m}-18`, amount: 36.9, payer: "SHOPEE", category: "refund_or_reversal" as const },
      { date: `${m}-08`, amount: 1500, payer: "TAN CAKEN", category: "own_account_transfer" as const },
      { date: `${m}-20`, amount: 5000, payer: "ABC CREDIT", category: "loan_disbursement" as const },
    ];
    const outcome = await read({
      documents: [statement(1), statement(2), statement(3)],
      statements: [JUL_ST, AUG_ST, SEP_ST],
      credits: [...month("2026-07"), ...month("2026-08"), ...month("2026-09")],
    });

    expect(outcome).toMatchObject({
      kind: "usable",
      m1: 3900, m2: 3900, m3: 3900,
      incomeType: "BANK_STATEMENT_OTHER_INCOME",
      fileTypes: ["BANK_STATEMENT_OTHER_INCOME", "BANK_STATEMENT_OTHER_INCOME", "BANK_STATEMENT_OTHER_INCOME"],
    });
  });

  it("counts a credit once when the same statement is uploaded twice", async () => {
    const outcome = await read({
      documents: [statement(1), statement(2)],
      statements: [SEP_ST, SEP_ST],
      credits: [salary("2026-09-25", 3800), salary("2026-09-25", 3800)],
    });

    expect(outcome).toMatchObject({ kind: "usable", m1: 3800 });
  });

  it("joins statements cut mid-month into the calendar month they cover", async () => {
    const outcome = await read({
      documents: [statement(1), statement(2)],
      statements: [{ start: "2026-08-15", end: "2026-09-14" }, { start: "2026-09-15", end: "2026-10-14" }],
      credits: [salary("2026-09-01", 4000), salary("2026-09-20", 200)],
    });

    expect(outcome).toMatchObject({ kind: "usable", m1: 4200 });
    if (outcome.kind === "usable") expect(outcome.months.map((m) => m.month)).toEqual(["2026-09"]);
  });

  it("says which month shows nothing coming in rather than asking for its statement again", async () => {
    const outcome = await read({
      documents: [statement(1), statement(2)],
      statements: [AUG_ST, SEP_ST],
      credits: [salary("2026-08-25", 3800)],
    });

    expect(outcome.kind).toBe("needs_review");
    if (outcome.kind !== "needs_review") return;
    expect(outcome.reason).toContain("September 2026");
  });

  it("asks for a missing month by its bank statement, without stopping", async () => {
    const outcome = await read({
      documents: [statement(1), statement(2)],
      statements: [AUG_ST, SEP_ST],
      credits: [salary("2026-08-25", 3800), salary("2026-09-25", 3800)],
    });

    expect(outcome.kind).toBe("usable");
    if (outcome.kind !== "usable") return;
    expect(outcome.advice).toContain("July 2026");
    expect(outcome.advice).toContain("S$0");
  });
});

describe("extractIncome - platform earnings statements are treated as payslips", () => {
  const grab = (index: number) =>
    ({ index, kind: "earnings_statement" as const, holderName: "TAN CAKEN", issuer: "Grab" });
  const GRAB_SEP = { ...SEP, gross: 3400, net: 3400, employer: "Grab" };

  it("is non-panel on its own", async () => {
    const outcome = await read({ documents: [grab(1)], periods: [GRAB_SEP] });

    expect(outcome).toMatchObject({
      kind: "usable",
      incomeType: "NON_PANEL_PAYSLIP",
      fileTypes: ["NON_PANEL_PAYSLIP"],
    });
  });

  it("is panel when a bank statement shows the earnings arriving", async () => {
    const outcome = await read({
      documents: [grab(1), statement(2)],
      periods: [GRAB_SEP],
      statements: [SEP_ST, { start: "2026-10-01", end: "2026-10-01" }],
      credits: [{ date: "2026-10-01", amount: 3400, payer: "GRAB", category: "platform_payout" }],
    });

    expect(outcome).toMatchObject({
      incomeType: "PANEL_PAYSLIP",
      fileTypes: ["PANEL_PAYSLIP", "BANK_STATEMENT_OTHER_INCOME"],
    });
  });

  describe("paid out in several cash-outs", () => {
    const payout = (date: string, amount: number, payer = "GRAB HOLDINGS") =>
      ({ date, amount, payer, category: "platform_payout" as const });
    const withPayouts = (credits: Array<ReturnType<typeof payout>>) =>
      read({
        documents: [grab(1), statement(2), statement(3)],
        periods: [{ ...GRAB_SEP, document: 1 }],
        statements: [SEP_ST, { start: "2026-10-01", end: "2026-10-31" }],
        credits,
      });

    it("is panel when the platform's payouts add up to the month's earnings", async () => {
      const outcome = await withPayouts([
        payout("2026-09-07", 800), payout("2026-09-14", 850), payout("2026-09-21", 820),
        payout("2026-09-28", 790), payout("2026-10-03", 150),
      ]);

      expect(outcome).toMatchObject({ incomeType: "PANEL_PAYSLIP" });
    });

    it("stays non-panel when the payouts fall well short of the earnings", async () => {
      const outcome = await withPayouts([payout("2026-09-07", 800), payout("2026-09-14", 850)]);

      expect(outcome).toMatchObject({ incomeType: "NON_PANEL_PAYSLIP" });
    });

    it("does not count money from anyone but the platform", async () => {
      const outcome = await withPayouts([
        payout("2026-09-07", 800), payout("2026-09-14", 850),
        payout("2026-09-20", 1750, "TAN WEI LING"),
      ]);

      expect(outcome).toMatchObject({ incomeType: "NON_PANEL_PAYSLIP" });
    });

    it("does not count payouts from well after the period", async () => {
      const outcome = await withPayouts([
        payout("2026-09-07", 800), payout("2026-09-14", 850), payout("2026-10-20", 1750),
      ]);

      expect(outcome).toMatchObject({ incomeType: "NON_PANEL_PAYSLIP" });
    });
  });

  it("adds a Grab statement to a payslip for the same month, like a second job", async () => {
    const outcome = await read({
      documents: [payslip(1), grab(2)],
      periods: [SEP, GRAB_SEP],
    });

    expect(outcome).toMatchObject({ kind: "usable", m1: 8600, incomeType: "NON_PANEL_PAYSLIP" });
  });
});

describe("extractIncome - what can be uploaded together", () => {
  it("names a file that is not an income document", async () => {
    const outcome = await read({
      documents: [payslip(1), { index: 2, kind: "other", holderName: "TAN CAKEN", issuer: "" }],
      periods: [SEP],
    });

    expect(outcome.kind).toBe("needs_review");
    if (outcome.kind !== "needs_review") return;
    expect(outcome.reason).toContain("doc-2.pdf");
  });
});

describe("extractIncome - the documents are the applicant's own", () => {
  it("accepts documents in the applicant's name however it is written", async () => {
    const outcome = await read({
      documents: [
        { ...payslip(1), holderName: "TAN CAKEN" },
        { ...payslip(2), holderName: "Caken Tan" },
        { ...payslip(3), holderName: "MR TAN CAKEN" },
      ],
      periods: [SEP, AUG, JUL],
    });

    expect(outcome.kind).toBe("usable");
  });

  it("refuses a payslip in someone else's name, and says which file", async () => {
    const outcome = await read({
      documents: [payslip(1), { ...payslip(2), holderName: "LIM WEI JIE" }],
      periods: [SEP, AUG],
    });

    expect(outcome).toMatchObject({ kind: "needs_review", months: [] });
    if (outcome.kind !== "needs_review") return;
    expect(outcome.reason).toContain("doc-2.pdf");
    expect(outcome.reason).toContain("Singpass");
  });

  it("refuses a document the reader gave no name for", async () => {
    const outcome = await extractIncome(files(2), {
      client: reporting({ documents: [payslip(1)], periods: [SEP] }),
      today: TODAY,
      applicant: APPLICANT,
    });

    expect(outcome.kind).toBe("needs_review");
    if (outcome.kind !== "needs_review") return;
    expect(outcome.reason).toContain("doc-2.pdf");
  });

  it("refuses a bank statement from a bank it does not recognise", async () => {
    const outcome = await read({
      documents: [statement(1, "MERLION BANK")],
      statements: [SEP_ST],
      credits: [salary("2026-09-25", 3800)],
    });

    expect(outcome.kind).toBe("needs_review");
    if (outcome.kind !== "needs_review") return;
    expect(outcome.reason).toMatch(/Singapore bank/);
  });
});

describe("earnings statements that show no name", () => {
  const unnamed = (index: number) => ({
    index, kind: "earnings_statement" as const, holderName: "", issuer: "foodpanda",
  });
  const JUN = { start: "2026-08-01", end: "2026-08-31", gross: 626.47, net: 548.79, employer: "foodpanda" };

  it("is let through, and recorded as accepted without a name", async () => {
    const outcome = await read({ documents: [unnamed(1)], periods: [{ ...JUN, document: 1 }] });
    expect(outcome.kind).toBe("usable");
    if (outcome.kind === "usable") expect(outcome.nameNotShown).toEqual(["doc-1.pdf"]);
  });

  it("is still refused when it names someone else", async () => {
    const outcome = await read({
      documents: [{ ...unnamed(1), holderName: "LIM AH BENG" }],
      periods: [{ ...JUN, document: 1 }],
    });
    expect(outcome.kind).toBe("needs_review");
    if (outcome.kind !== "usable") expect(outcome.reason).toContain("LIM AH BENG");
  });

  it("does not extend to a payslip, which always carries a name", async () => {
    const outcome = await read({
      documents: [{ index: 1, kind: "payslip", holderName: "", issuer: "Kimseng Food" }],
      periods: [{ ...AUG, document: 1 }],
    });
    expect(outcome.kind).toBe("needs_review");
  });

  it("does not extend to a bank statement", async () => {
    const outcome = await read({
      documents: [{ index: 1, kind: "bank_statement", holderName: "", issuer: "OCBC Bank" }],
      statements: [AUG_ST],
      credits: [{ date: "2026-08-25", amount: 5000, payer: "Kimseng Food", category: "salary" }],
    });
    expect(outcome.kind).toBe("needs_review");
  });
});


describe("files that fed none of the months", () => {
  const MAR = { start: "2026-03-01", end: "2026-03-31", gross: 3800, net: 3040, employer: "Kimseng Food" };

  it("reports a March payslip sent in October as ignored, and keeps the rest", async () => {
    const outcome = await read({
      documents: [payslip(1), payslip(2), payslip(3)],
      periods: [
        { ...MAR, document: 1 },
        { ...AUG, document: 2 },
        { ...SEP, document: 3 },
      ],
    });
    expect(outcome.kind).toBe("usable");
    if (outcome.kind === "usable") expect(outcome.ignoredIndices).toEqual([0]);
  });

  it("calls nothing unused when every file feeds a month", async () => {
    const outcome = await read({
      documents: [payslip(1), payslip(2)],
      periods: [{ ...AUG, document: 1 }, { ...SEP, document: 2 }],
    });
    if (outcome.kind === "usable") expect(outcome.ignoredIndices).toEqual([]);
  });

  it("drops nothing when the reader did not say which file a period came from", async () => {
    const outcome = await read({
      documents: [payslip(1), payslip(2), payslip(3)],
      periods: [MAR, AUG, SEP],
    });
    if (outcome.kind === "usable") expect(outcome.ignoredIndices).toEqual([]);
  });
});
