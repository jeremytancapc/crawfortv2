import { describe, expect, it } from "vitest";

import { buildMyInfoPatch } from "./myinfo";
import {
  applyMyinfoEdits,
  defaultCpfRows,
  defaultNoaRows,
  generateCpfRows,
  validateCpfRows,
  validateNoaRows,
  completeNric,
  nricCheckLetter,
  validateNric,
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

/**
 * Editing the ID number. A tester who needs a fresh applicant - above all
 * against an Ascend environment that has never seen the persona - should not
 * have to find another Singpass test account. Ascend identifies a person by
 * the `sub` claim, not by `uinfin` (lib/myinfo.ts), so changing only the NRIC
 * would hand Ascend the original person back. The two change together.
 */
describe("editing the ID number", () => {
  const person = {
    iss: "singpass",
    sub: "6f0c1d3e-1111-4a2b-9c3d-aaaaaaaaaaaa",
    person_info: {
      name: { value: "TAN CAKEN" },
      uinfin: { value: "S1234567A" },
    },
  };

  it("writes the new NRIC where our own parser reads it back", () => {
    const { payload } = applyMyinfoEdits(person, { nric: "s7654321b" }, TODAY);

    expect(buildMyInfoPatch(payload).nric).toBe("S7654321B");
  });

  it("gives Ascend a different person, because it identifies them by sub", () => {
    const { payload } = applyMyinfoEdits(person, { nric: "S7654321B" }, TODAY);

    expect(payload.sub).not.toBe(person.sub);
    expect(typeof payload.sub).toBe("string");
  });

  it("gives the same person every time the same NRIC is typed", () => {
    const a = applyMyinfoEdits(person, { nric: "S7654321B" }, TODAY).payload.sub;
    const b = applyMyinfoEdits(person, { nric: "S7654321B" }, TODAY).payload.sub;
    const other = applyMyinfoEdits(person, { nric: "S7654322C" }, TODAY).payload.sub;

    expect(a).toBe(b);
    expect(other).not.toBe(a);
  });

  it("changes nothing else about the person", () => {
    const { payload } = applyMyinfoEdits(person, { nric: "S7654321B" }, TODAY);
    const edited = payload.person_info as { name: unknown };

    expect(edited.name).toEqual({ value: "TAN CAKEN" });
    expect(payload.iss).toBe("singpass");
  });

  it("leaves the NRIC and sub alone when it is not asked to change them", () => {
    const { payload } = applyMyinfoEdits(person, { cpf: [] }, TODAY);

    expect(payload.sub).toBe(person.sub);
    expect((payload.person_info as { uinfin: unknown }).uinfin).toEqual({ value: "S1234567A" });
  });

  it("works on the older flat shape, where uinfin and sub sit at the top", () => {
    const flat = { sub: "s=S123", uinfin: { value: "S1234567A" }, name: { value: "TAN CAKEN" } };
    const { payload } = applyMyinfoEdits(flat, { nric: "S7654321B" }, TODAY);

    expect(buildMyInfoPatch(payload).nric).toBe("S7654321B");
    expect(payload.sub).not.toBe("s=S123");
  });

  it("does not modify the record it was given", () => {
    const before = structuredClone(person);
    applyMyinfoEdits(person, { nric: "S7654321B" }, TODAY);

    expect(person).toEqual(before);
  });
});

/**
 * Ascend pulls the applicant's credit bureau report, and the bureau refuses an
 * ID number whose check letter is wrong ("B2B0007 ID number does not pass
 * Modulus 11 check"). The editor therefore never takes the check letter from
 * the tester: it works it out. Weights 2,7,6,5,4,3,2 over the seven digits;
 * T and G add 4; the remainder mod 11 picks the letter from a table that
 * differs for S/T and F/G.
 */
describe("the NRIC check letter", () => {
  it("is the one a real S number carries - S1234567D is the standard valid example", () => {
    expect(nricCheckLetter("S", "1234567")).toBe("D");
  });

  // Not worked out from our own formula: these are the first seven NRICs ever
  // issued (S0000001I, the first, to Yusof bin Ishak), published on Wikipedia.
  // A check that agrees with real issued numbers, not just with itself.
  it("agrees with the first seven NRICs ever issued", () => {
    const issued = ["S0000001I", "S0000002G", "S0000003E", "S0000004C", "S0000005A", "S0000006Z", "S0000007H"];

    for (const nric of issued) {
      expect(nricCheckLetter(nric[0], nric.slice(1, 8)), nric).toBe(nric[8]);
      expect(validateNric(nric), nric).toEqual([]);
    }
  });

  it("follows the Modulus 11 sum, so S1112223 ends in Z and not the A that was refused", () => {
    expect(nricCheckLetter("S", "1112223")).toBe("Z");
  });

  it("uses the other letter table for F and G, and adds 4 for T and G", () => {
    expect(nricCheckLetter("F", "1234567")).toBe("N");
    expect(nricCheckLetter("T", "1234567")).toBe("J");
    expect(nricCheckLetter("G", "1234567")).toBe("X");
  });

  it("completes the seven digits into a whole ID number", () => {
    expect(completeNric("S", "1112223")).toBe("S1112223Z");
    expect(completeNric("t", "1234567")).toBe("T1234567J");
  });

  it("refuses digits that are not seven, and prefixes it cannot work out", () => {
    expect(completeNric("S", "123456")).toBeNull();
    expect(completeNric("S", "12345678")).toBeNull();
    expect(completeNric("S", "12345AB")).toBeNull();
    expect(completeNric("M", "1234567")).toBeNull();
    expect(completeNric("X", "1234567")).toBeNull();
  });
});

describe("validateNric", () => {
  it("accepts ID numbers whose check letter is right, in either case", () => {
    expect(validateNric("S1234567D")).toEqual([]);
    expect(validateNric(" s1112223z ")).toEqual([]);
    expect(validateNric("T1234567J")).toEqual([]);
    expect(validateNric("F1234567N")).toEqual([]);
    expect(validateNric("G1234567X")).toEqual([]);
  });

  it("rejects the number that failed at Ascend, and says which letter it should end in", () => {
    const errors = validateNric("S1112223A");

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/check letter/);
    expect(errors[0]).toMatch(/Z/);
  });

  it("rejects anything that is not an ID number at all, with a message that says what is expected", () => {
    for (const bad of ["", "S123456A", "1234567A", "S12345678", "SABCDEFGA", "S1234567"]) {
      const errors = validateNric(bad);
      expect(errors, bad).toHaveLength(1);
      expect(errors[0]).toMatch(/NRIC|FIN/);
    }
  });
});
