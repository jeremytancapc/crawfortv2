import { describe, expect, it } from "vitest";

import { gradePipeline, gradeReader, percentile } from "./grade";

/**
 * The grader is code, so it is tested like code. These pin the rules that
 * decide whether a run of the document reader passed: what is critical, what
 * is only a warning, and the properties that came out of real failures.
 */

const reported = (over: Record<string, unknown> = {}) => ({
  readable: true,
  note: "",
  documents: [{ index: 1, kind: "payslip", holderName: "TAN CAKEN", issuer: "KIMSENG FOOD PTE LTD" }],
  periods: [{ start: "2026-09-01", end: "2026-09-30", gross: 5200, net: 4160, employer: "Kimseng Food", document: 1 }],
  statements: [],
  credits: [],
  ...over,
});

describe("gradeReader - documents", () => {
  const expected = { documents: [{ index: 1, kind: "payslip", holderName: "TAN CAKEN", issuer: "KIMSENG" }] };

  it("passes when kind, name and issuer are right", () => {
    expect(gradeReader(expected, reported()).critical).toEqual([]);
  });

  it("fails a wrong kind", () => {
    const r = reported({ documents: [{ index: 1, kind: "bank_statement", holderName: "TAN CAKEN", issuer: "KIMSENG" }] });
    expect(gradeReader(expected, r).critical.join(" ")).toMatch(/kind/);
  });

  it("matches the issuer without regard to case or extra words", () => {
    const r = reported({ documents: [{ index: 1, kind: "payslip", holderName: "TAN CAKEN", issuer: "kimseng food pte ltd" }] });
    expect(gradeReader(expected, r).critical).toEqual([]);
  });

  it("fails a holder name with an employee number in it - the failure that flaked one run in four", () => {
    const r = reported({ documents: [{ index: 1, kind: "payslip", holderName: "TAN CAKEN (100257)", issuer: "KIMSENG" }] });
    const grade = gradeReader(expected, r);

    expect(grade.critical.join(" ")).toMatch(/digit/);
  });

  it("fails a name that is simply different", () => {
    const r = reported({ documents: [{ index: 1, kind: "payslip", holderName: "LIM WEI JIE", issuer: "KIMSENG" }] });
    expect(gradeReader(expected, r).critical.join(" ")).toMatch(/holderName/);
  });

  it("fails a missing document", () => {
    expect(gradeReader(expected, reported({ documents: [] })).critical.join(" ")).toMatch(/document 1/);
  });
});

describe("gradeReader - periods", () => {
  const expected = { periods: [{ start: "2026-09-01", end: "2026-09-30", gross: 5200, net: 4160 }] };

  it("passes the right period and amounts", () => {
    expect(gradeReader(expected, reported()).critical).toEqual([]);
  });

  it("tolerates a cent", () => {
    const r = reported({ periods: [{ start: "2026-09-01", end: "2026-09-30", gross: 5200.01, net: 4160, employer: "", document: 1 }] });
    expect(gradeReader(expected, r).critical).toEqual([]);
  });

  it("fails gross taken from the year-to-date column", () => {
    const r = reported({ periods: [{ start: "2026-09-01", end: "2026-09-30", gross: 49991.4, net: 4160, employer: "", document: 1 }] });
    expect(gradeReader(expected, r).critical.join(" ")).toMatch(/gross/);
  });

  it("fails a period that was not found", () => {
    expect(gradeReader(expected, reported({ periods: [] })).critical.join(" ")).toMatch(/2026-09-01/);
  });
});

describe("gradeReader - bank credits", () => {
  const credits = [
    { date: "2026-08-14", amount: 3082.73, category: "transfer_from_others" },
    { date: "2026-09-30", amount: 0.62, category: "interest" },
  ];
  const expected = { credits };
  const base = { documents: [], periods: [] };

  it("passes when every credit is found with its category", () => {
    expect(gradeReader(expected, reported({ ...base, credits })).critical).toEqual([]);
  });

  it("fails a credit that counts as income and was not reported", () => {
    const r = reported({ ...base, credits: [credits[1]] });
    expect(gradeReader(expected, r, { employmentType: "EMPLOYED" }).critical.join(" ")).toMatch(/3082.73/);
  });

  it("only warns about a missing credit that would not have counted", () => {
    const r = reported({ ...base, credits: [credits[0]] });
    const grade = gradeReader(expected, r, { employmentType: "EMPLOYED" });

    expect(grade.critical).toEqual([]);
    expect(grade.warnings.join(" ")).toMatch(/0.62/);
  });

  it("only warns about a label that changes nothing - transfer vs cash both count", () => {
    const r = reported({ ...base, credits: [{ ...credits[0], category: "cash_deposit" }, credits[1]] });
    const grade = gradeReader(expected, r, { employmentType: "EMPLOYED" });

    expect(grade.critical).toEqual([]);
    expect(grade.warnings.join(" ")).toMatch(/category/);
  });

  it("fails a label that changes the total - interest read as a transfer", () => {
    const r = reported({ ...base, credits: [credits[0], { ...credits[1], category: "transfer_from_others" }] });
    expect(gradeReader(expected, r, { employmentType: "EMPLOYED" }).critical.join(" ")).toMatch(/counted/);
  });

  it("judges what counts by the applicant's status: CPF only for the unemployed", () => {
    // For someone unemployed with income only CPF LIFE counts, so mislabelling
    // a transfer as cash changes nothing - neither counts.
    const r = reported({ ...base, credits: [{ ...credits[0], category: "cash_deposit" }, credits[1]] });
    const grade = gradeReader(expected, r, { employmentType: "UNEMPLOYED WITH INCOME" });

    expect(grade.critical).toEqual([]);
  });

  it("warns about credits that were not expected", () => {
    const r = reported({ ...base, credits: [...credits, { date: "2026-09-02", amount: 10, category: "other" }] });
    expect(gradeReader(expected, r).warnings.join(" ")).toMatch(/not expected/);
  });
});

describe("gradeReader - statements and the note", () => {
  it("fails statement dates that differ from what is printed", () => {
    const expected = { statements: [{ start: "2026-08-01", end: "2026-10-31" }] };
    const r = reported({ statements: [{ start: "2026-08-01", end: "2026-10-12" }] });

    expect(gradeReader(expected, r).critical.join(" ")).toMatch(/statement/);
  });

  it("fails an applicant-facing note that is markup, not a sentence", () => {
    const r = reported({ readable: false, note: '<parameter name="months">[1,2]' });
    expect(gradeReader({ readable: false }, r).critical.join(" ")).toMatch(/note/);
  });

  it("only warns about a junk note on a document that was read - it is never shown", () => {
    // The note reaches an applicant only when a document could not be read. A
    // stray ";" beside a good reading is thrown away by applicantSafeNote.
    const grade = gradeReader({ readable: true }, reported({ readable: true, note: ";" }));

    expect(grade.critical).toEqual([]);
    expect(grade.warnings.join(" ")).toMatch(/note/);
  });

  it("passes a plain-sentence note", () => {
    const r = reported({ readable: false, note: "The image is too blurry to read." });
    expect(gradeReader({ readable: false }, r).critical).toEqual([]);
  });

  it("fails when a document that should be readable was not", () => {
    expect(gradeReader({ readable: true }, reported({ readable: false })).critical.join(" ")).toMatch(/readable/);
  });
});

describe("gradePipeline", () => {
  const usable = { kind: "usable", incomeType: "NON_PANEL_PAYSLIP", m1: 5200, m2: 5100, m3: 5000 };

  it("passes the right kind, type and figures", () => {
    expect(gradePipeline({ kind: "usable", incomeType: "NON_PANEL_PAYSLIP", m1: 5200, m2: 5100, m3: 5000 }, usable)).toEqual({
      critical: [],
      warnings: [],
    });
  });

  it("fails a wrong income type", () => {
    expect(gradePipeline({ kind: "usable", incomeType: "PANEL_PAYSLIP" }, usable).critical.join(" ")).toMatch(/incomeType/);
  });

  it("fails a wrong figure", () => {
    expect(gradePipeline({ kind: "usable", m1: 5300 }, usable).critical.join(" ")).toMatch(/m1/);
  });

  it("fails when it was refused and should have been read", () => {
    expect(gradePipeline({ kind: "usable" }, { kind: "needs_review", reason: "x" }).critical.join(" ")).toMatch(/kind/);
  });

  it("accepts any of several kinds when a refusal can arrive by more than one route", () => {
    // A letter that is no income document is refused either as unreadable (the
    // model says so in its own words) or as needing review (our wording). The
    // behaviour wanted is the refusal, not which of the two produced it.
    const expected = { kind: ["needs_review", "unreadable"], reasonMatches: "statement" };

    expect(gradePipeline(expected, { kind: "unreadable", reason: "Please send bank statements." }).critical).toEqual([]);
    expect(gradePipeline(expected, { kind: "needs_review", reason: "Not a statement." }).critical).toEqual([]);
    expect(gradePipeline(expected, { kind: "usable" }).critical.join(" ")).toMatch(/kind/);
  });

  it("checks the reason a refusal gives", () => {
    const refused = { kind: "needs_review", reason: "doc.pdf appears to belong to someone else" };

    expect(gradePipeline({ kind: "needs_review", reasonMatches: "belong to someone else" }, refused).critical).toEqual([]);
    expect(gradePipeline({ kind: "needs_review", reasonMatches: "Singapore bank" }, refused).critical.join(" ")).toMatch(/reason/);
  });
});

describe("percentile", () => {
  it("takes the value at that rank, nearest-rank", () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([5, 1, 3, 2, 4], 95)).toBe(5);
    expect(percentile([], 95)).toBe(0);
  });
});
