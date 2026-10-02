import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { ascendIncomeType, extractIncome, type IncomeDocument } from "./income-extraction";

/**
 * extractIncome with the model replaced by what it reported. The reading is
 * the model's job; everything after it - which months count, the sums, the
 * asks, which Ascend income type - is ours, and is what these pin down.
 */
type Report = {
  documentType: "payslip" | "bank_statement" | "earnings_statement" | "mixed" | "other";
  readable?: boolean;
  note?: string;
  periods?: Array<{ start: string; end: string; gross: number; employer: string }>;
  statements?: Array<{ start: string; end: string }>;
  credits?: Array<{ date: string; amount: number; payer: string }>;
  documents?: Array<{ index: number; holderName: string; issuer: string }>;
};

function reporting(report: Report): Anthropic {
  const input = {
    readable: true,
    note: "",
    periods: [],
    statements: [],
    credits: [],
    documents: [],
    ...report,
  };
  return {
    messages: {
      create: async () => ({
        content: [{ type: "tool_use", id: "t", name: "report_income", input }],
      }),
    },
  } as unknown as Anthropic;
}

const DOC: IncomeDocument = { fileName: "x.pdf", mediaType: "application/pdf", bytes: Buffer.from("x") };
const TODAY = new Date("2026-09-28T00:00:00Z");

const read = (report: Report) => extractIncome([DOC], { client: reporting(report), today: TODAY });

describe("extractIncome - payslips", () => {
  it("underwrites on September, August and July at the end of September", async () => {
    const outcome = await read({
      documentType: "payslip",
      periods: [
        { start: "2026-09-01", end: "2026-09-30", gross: 5200, employer: "Kimseng Food" },
        { start: "2026-08-01", end: "2026-08-31", gross: 5100, employer: "Kimseng Food" },
        { start: "2026-07-01", end: "2026-07-31", gross: 5000, employer: "Kimseng Food" },
      ],
    });

    expect(outcome.kind).toBe("usable");
    if (outcome.kind !== "usable") return;
    expect([outcome.m1, outcome.m2, outcome.m3]).toEqual([5200, 5100, 5000]);
    expect(outcome.source).toBe("payslip");
  });

  it("does not let a payslip for next month into the figures", async () => {
    const outcome = await read({
      documentType: "payslip",
      periods: [
        { start: "2026-10-01", end: "2026-10-31", gross: 9000, employer: "Kimseng Food" },
        { start: "2026-09-01", end: "2026-09-30", gross: 5200, employer: "Kimseng Food" },
        { start: "2026-08-01", end: "2026-08-31", gross: 5100, employer: "Kimseng Food" },
        { start: "2026-07-01", end: "2026-07-31", gross: 5000, employer: "Kimseng Food" },
      ],
    });

    expect(outcome.kind).toBe("usable");
    if (outcome.kind !== "usable") return;
    expect(outcome.months.map((m) => m.month)).toEqual(["2026-09", "2026-08", "2026-07"]);
  });
});

describe("extractIncome - bank statements", () => {
  const JUN = { start: "2026-06-01", end: "2026-06-30" };
  const JUL = { start: "2026-07-01", end: "2026-07-31" };
  const AUG = { start: "2026-08-01", end: "2026-08-31" };

  it("sums each month's income credits into that month", async () => {
    const outcome = await read({
      documentType: "bank_statement",
      statements: [JUN, JUL, AUG],
      credits: [
        { date: "2026-06-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
        { date: "2026-07-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
        // Paid twice a month in August - both halves are August's income.
        { date: "2026-08-10", amount: 1950, payer: "SUNRISE LOGISTICS PTE LTD" },
        { date: "2026-08-25", amount: 1950, payer: "SUNRISE LOGISTICS PTE LTD" },
      ],
    });

    expect(outcome.kind).toBe("usable");
    if (outcome.kind !== "usable") return;
    expect([outcome.m1, outcome.m2, outcome.m3]).toEqual([3900, 3800, 3800]);
    expect(outcome.months[0].employer).toBe("SUNRISE LOGISTICS PTE LTD");
    expect(outcome.source).toBe("bank_statement");
  });

  it("counts a credit once when the same statement is uploaded twice", async () => {
    const credit = { date: "2026-08-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" };
    const outcome = await read({
      documentType: "bank_statement",
      statements: [JUN, JUL, AUG, AUG],
      credits: [
        { date: "2026-06-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
        { date: "2026-07-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
        credit,
        credit,
      ],
    });

    expect(outcome.kind).toBe("usable");
    if (outcome.kind !== "usable") return;
    expect(outcome.m1).toBe(3800);
  });

  it("joins statements cut mid-month into the calendar month they cover", async () => {
    const outcome = await read({
      documentType: "bank_statement",
      statements: [
        { start: "2026-05-15", end: "2026-06-14" },
        { start: "2026-06-15", end: "2026-07-14" },
        { start: "2026-07-15", end: "2026-08-14" },
        { start: "2026-08-15", end: "2026-09-14" },
      ],
      credits: [
        { date: "2026-06-01", amount: 4000, payer: "ACME PTE LTD" },
        { date: "2026-07-01", amount: 4000, payer: "ACME PTE LTD" },
        { date: "2026-08-01", amount: 4100, payer: "ACME PTE LTD" },
      ],
    });

    expect(outcome.kind).toBe("usable");
    if (outcome.kind !== "usable") return;
    expect(outcome.months.map((m) => m.month)).toEqual(["2026-08", "2026-07", "2026-06"]);
  });

  it("says which month shows no income rather than asking for its statement again", async () => {
    const outcome = await read({
      documentType: "bank_statement",
      statements: [JUN, JUL, AUG],
      credits: [
        { date: "2026-06-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
        { date: "2026-08-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
      ],
    });

    expect(outcome.kind).toBe("needs_review");
    if (outcome.kind !== "needs_review") return;
    expect(outcome.reason).toContain("July 2026");
    expect(outcome.reason).not.toContain("Please add your July 2026 bank statement");
  });

  it("asks for a missing month by its bank statement, not its payslip", async () => {
    const outcome = await read({
      documentType: "bank_statement",
      statements: [JUL, AUG],
      credits: [
        { date: "2026-07-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
        { date: "2026-08-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
      ],
    });

    expect(outcome.kind).toBe("needs_review");
    if (outcome.kind !== "needs_review") return;
    expect(outcome.reason).toBe(
      "We have July and August 2026. Please add your June 2026 bank statement.",
    );
  });
});

describe("extractIncome - platform earnings statements", () => {
  it("reads them like payslips and submits them as income statements", async () => {
    const outcome = await read({
      documentType: "earnings_statement",
      periods: [
        { start: "2026-08-01", end: "2026-08-31", gross: 4400, employer: "Grab" },
        { start: "2026-07-01", end: "2026-07-31", gross: 4100, employer: "Grab" },
        { start: "2026-06-01", end: "2026-06-30", gross: 4300, employer: "Grab" },
      ],
    });

    expect(outcome.kind).toBe("usable");
    expect(outcome.source).toBe("earnings_statement");
    expect(ascendIncomeType(outcome.source)).toBe("INCOME_STATEMENT");
  });
});

describe("extractIncome - one kind of document per application", () => {
  it("asks for one kind when payslips and bank statements are mixed", async () => {
    const outcome = await read({ documentType: "mixed" });

    expect(outcome.kind).toBe("needs_review");
    if (outcome.kind !== "needs_review") return;
    expect(outcome.reason).toMatch(/one kind/i);
  });
});

describe("ascendIncomeType", () => {
  it("names each document the way Ascend's income/credit expects", () => {
    expect(ascendIncomeType("payslip")).toBe("PANEL_PAYSLIP");
    expect(ascendIncomeType("bank_statement")).toBe("BANK_STATEMENT_OTHER_INCOME");
    expect(ascendIncomeType("earnings_statement")).toBe("INCOME_STATEMENT");
  });
});

describe("extractIncome - the documents are the applicant's own", () => {
  const applicant = { name: "TAN CAKEN" };
  const PAYSLIPS = [
    { start: "2026-08-01", end: "2026-08-31", gross: 5100, employer: "Kimseng Food" },
    { start: "2026-07-01", end: "2026-07-31", gross: 5000, employer: "Kimseng Food" },
    { start: "2026-06-01", end: "2026-06-30", gross: 5000, employer: "Kimseng Food" },
  ];
  const docs = (n: number): IncomeDocument[] =>
    Array.from({ length: n }, (_, i) => ({
      fileName: `slip-${i + 1}.pdf`, mediaType: "application/pdf", bytes: Buffer.from("x"),
    }));
  const named = (names: string[], issuer = "Kimseng Food") =>
    names.map((holderName, i) => ({ index: i + 1, holderName, issuer }));

  const readAs = (report: Report, n = 3) =>
    extractIncome(docs(n), { client: reporting(report), today: TODAY, applicant });

  it("accepts payslips in the applicant's name", async () => {
    const outcome = await readAs({
      documentType: "payslip",
      periods: PAYSLIPS,
      documents: named(["TAN CAKEN", "Caken Tan", "MR TAN CAKEN"]),
    });

    expect(outcome.kind).toBe("usable");
  });

  it("refuses a payslip in someone else's name, and says which file", async () => {
    const outcome = await readAs({
      documentType: "payslip",
      periods: PAYSLIPS,
      documents: named(["TAN CAKEN", "LIM WEI JIE", "TAN CAKEN"]),
    });

    expect(outcome.kind).toBe("needs_review");
    if (outcome.kind !== "needs_review") return;
    expect(outcome.reason).toContain("slip-2.pdf");
    expect(outcome.reason).toContain("Singpass");
    expect(outcome.months).toEqual([]);
  });

  it("refuses a document that shows no name at all", async () => {
    const outcome = await readAs({
      documentType: "payslip",
      periods: PAYSLIPS,
      documents: named(["TAN CAKEN", "TAN CAKEN"]),
    });

    expect(outcome.kind).toBe("needs_review");
    if (outcome.kind !== "needs_review") return;
    expect(outcome.reason).toContain("slip-3.pdf");
  });

  it("refuses a bank statement from a bank it does not recognise", async () => {
    const outcome = await readAs(
      {
        documentType: "bank_statement",
        statements: [
          { start: "2026-06-01", end: "2026-06-30" },
          { start: "2026-07-01", end: "2026-07-31" },
          { start: "2026-08-01", end: "2026-08-31" },
        ],
        credits: [
          { date: "2026-06-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
          { date: "2026-07-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
          { date: "2026-08-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
        ],
        documents: named(["TAN CAKEN", "TAN CAKEN", "TAN CAKEN"], "MERLION BANK"),
      },
    );

    expect(outcome.kind).toBe("needs_review");
    if (outcome.kind !== "needs_review") return;
    expect(outcome.reason).toMatch(/bank/i);
  });

  it("accepts the same statements from a Singapore bank", async () => {
    const outcome = await readAs({
      documentType: "bank_statement",
      statements: [
        { start: "2026-06-01", end: "2026-06-30" },
        { start: "2026-07-01", end: "2026-07-31" },
        { start: "2026-08-01", end: "2026-08-31" },
      ],
      credits: [
        { date: "2026-06-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
        { date: "2026-07-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
        { date: "2026-08-25", amount: 3800, payer: "SUNRISE LOGISTICS PTE LTD" },
      ],
      documents: named(["TAN CAKEN", "TAN CAKEN", "TAN CAKEN"], "OCBC Bank"),
    });

    expect(outcome.kind).toBe("usable");
  });
});
