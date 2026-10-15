import { describe, expect, it } from "vitest";

import { buildMyInfoPatch } from "./myinfo";
import {
  applyMyinfoEdits,
  defaultCpfRows,
  defaultNoaRows,
  generateCpfRows,
  validateCpfRows,
  validateNoaRows,
  type CpfRow,
  type NoaRow,
} from "./myinfo-edit";

/**
 * The staging MyInfo editor writes CPF and NOA in the shape Singpass uses, so
 * what Ascend receives and what our own parser reads are the same thing. The
 * test that matters most is the round trip: write it, read it back with the
 * real parser, and get the same figures.
 */

const TODAY = new Date("2026-10-09T00:00:00Z");

const noaRows: NoaRow[] = [
  { yearOfAssessment: "2025", employmentIncome: 96000, tradeIncome: 12000, rentIncome: 0, interestIncome: 150 },
  { yearOfAssessment: "2024", employmentIncome: 84000, tradeIncome: 0, rentIncome: 6000, interestIncome: 0 },
];
const cpfRows: CpfRow[] = [
  { month: "2026-09", amount: 2516, employer: "ACME PTE LTD" },
  { month: "2026-08", amount: 2516, employer: "ACME PTE LTD" },
];

describe("applyMyinfoEdits - the raw record Ascend receives", () => {
  const base = {
    iss: "singpass",
    sub: "s=S123",
    person_info: {
      name: { value: "TAN CAKEN" },
      cpfcontributions: { source: "1", unavailable: true, classification: "C", lastupdated: "2026-10-08" },
      noahistory: { source: "1", unavailable: true, classification: "C", lastupdated: "2026-10-08" },
      employment: { value: "ACME PTE LTD" },
    },
  };

  it("replaces an 'unavailable' CPF with real contributions, inside person_info", () => {
    const { payload } = applyMyinfoEdits(base, { cpf: cpfRows }, TODAY);

    const person = payload.person_info as Record<string, any>;
    expect(person.cpfcontributions.unavailable).toBeUndefined();
    expect(person.cpfcontributions.history).toHaveLength(2);
    expect(person.cpfcontributions.history[0]).toEqual({
      month: { value: "2026-09" },
      date: { value: "2026-09-01" },
      amount: { value: 2516 },
      employer: { value: "ACME PTE LTD" },
    });
    expect(person.cpfcontributions).toMatchObject({ source: "1", classification: "C", lastupdated: "2026-10-09" });
  });

  it("leaves everything it was not asked to change exactly as it was", () => {
    const { payload } = applyMyinfoEdits(base, { cpf: cpfRows }, TODAY);

    const person = payload.person_info as Record<string, any>;
    expect(person.name).toEqual({ value: "TAN CAKEN" });
    expect(person.employment).toEqual({ value: "ACME PTE LTD" });
    expect(person.noahistory.unavailable).toBe(true);
    expect(payload.sub).toBe("s=S123");
  });

  it("does not modify the record it was given", () => {
    applyMyinfoEdits(base, { cpf: cpfRows, noa: noaRows }, TODAY);

    expect((base.person_info.cpfcontributions as any).unavailable).toBe(true);
  });

  it("works on the older flat shape too", () => {
    const flat = { name: { value: "X" }, cpfcontributions: { unavailable: true } };
    const { payload } = applyMyinfoEdits(flat, { cpf: cpfRows }, TODAY);

    expect((payload.cpfcontributions as any).history).toHaveLength(2);
  });
});

describe("round trip - what is written is what the parser reads back", () => {
  const base = { person_info: { name: { value: "TAN CAKEN" } } };

  it("reads back the same NOA", () => {
    const { payload, processed } = applyMyinfoEdits(base, { noa: noaRows }, TODAY);

    const parsed = buildMyInfoPatch(payload).noaHistory;
    expect(parsed).toEqual(processed.noaHistory);
    expect(parsed?.[0]).toMatchObject({
      yearOfAssessment: "2025",
      employmentIncome: 96000,
      tradeIncome: 12000,
      rentIncome: 0,
      interestIncome: 150,
      assessableIncome: 108150, // the sum of its parts
    });
  });

  it("reads back the same CPF", () => {
    const { payload, processed } = applyMyinfoEdits(base, { cpf: cpfRows }, TODAY);

    const parsed = buildMyInfoPatch(payload).cpfContributions;
    expect(parsed).toEqual(processed.cpfContributions);
    expect(parsed?.map((c) => [c.month, c.amount, c.paidOn])).toEqual([
      ["2026-09", 2516, "2026-09-01"],
      ["2026-08", 2516, "2026-08-01"],
    ]);
  });

  it("gives the monthly NOA figure our own record keeps, from the latest year's employment income", () => {
    const { monthlyIncomeNoa } = applyMyinfoEdits(base, { noa: noaRows }, TODAY);

    expect(monthlyIncomeNoa).toBe(8000); // 96,000 / 12
  });
});

describe("defaults and the CPF generator", () => {
  it("offers a starting NOA of the last two years", () => {
    expect(defaultNoaRows(TODAY).map((r) => r.yearOfAssessment)).toEqual(["2025", "2024"]);
  });

  it("offers a starting CPF of twelve months ending last month, most recent first", () => {
    const rows = defaultCpfRows(TODAY);

    expect(rows).toHaveLength(12);
    expect(rows[0].month).toBe("2026-09");
    expect(rows[11].month).toBe("2025-10");
  });

  it("generates the requested number of months back from the month given", () => {
    const rows = generateCpfRows({ latestMonth: "2026-02", months: 4, amount: 1800, employer: "X" });

    expect(rows.map((r) => r.month)).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
    expect(rows.every((r) => r.amount === 1800 && r.employer === "X")).toBe(true);
  });
});

describe("validation", () => {
  it("accepts good rows", () => {
    expect(validateCpfRows(cpfRows)).toEqual([]);
    expect(validateNoaRows(noaRows)).toEqual([]);
  });

  it("rejects a CPF month that is not YYYY-MM, or an amount that is not positive", () => {
    expect(validateCpfRows([{ month: "Sep 2026", amount: 100, employer: "" }]).length).toBeGreaterThan(0);
    expect(validateCpfRows([{ month: "2026-09", amount: 0, employer: "" }]).length).toBeGreaterThan(0);
    expect(validateCpfRows([{ month: "2026-13", amount: 100, employer: "" }]).length).toBeGreaterThan(0);
  });

  it("rejects the same CPF month twice", () => {
    const dup = [cpfRows[0], { ...cpfRows[0] }];
    expect(validateCpfRows(dup).join(" ")).toMatch(/twice|duplicate/i);
  });

  it("rejects a NOA year that is not four digits, or negative income, or the same year twice", () => {
    expect(validateNoaRows([{ ...noaRows[0], yearOfAssessment: "25" }]).length).toBeGreaterThan(0);
    expect(validateNoaRows([{ ...noaRows[0], employmentIncome: -1 }]).length).toBeGreaterThan(0);
    expect(validateNoaRows([noaRows[0], { ...noaRows[0] }]).join(" ")).toMatch(/twice|duplicate/i);
  });

  it("caps how many rows can be written", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ month: `2024-${String((i % 12) + 1).padStart(2, "0")}`, amount: 1, employer: "" }));
    expect(validateCpfRows(many.slice(0, 30)).join(" ")).toMatch(/at most/i);
  });
});
