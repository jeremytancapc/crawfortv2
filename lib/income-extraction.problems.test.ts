import { describe, expect, it } from "vitest";

import { decide, type IncomeDocument } from "./income-extraction";

/**
 * What a refused customer is told about their files: which file, what is wrong
 * with it, and what to upload instead. One file's problem reads as one
 * sentence; several are counted and each said.
 */

const doc = (fileName: string): IncomeDocument => ({ fileName, mediaType: "image/png", bytes: Buffer.from("x") });
const OPTIONS = { today: new Date("2026-10-28T00:00:00+08:00"), applicant: { name: "TAN MEI" }, employmentType: "EMPLOYED" };

const report = (documents: Array<{ kind: string; holderName: string; issuer: string }>) => ({
  readable: true,
  note: "",
  documents: documents.map((d, i) => ({ index: i + 1, ...d })),
  periods: [],
  statements: [],
  credits: [],
});

const reasonOf = (files: string[], docs: Array<{ kind: string; holderName: string; issuer: string }>) => {
  const outcome = decide(files.map(doc), { reported: report(docs) as never }, OPTIONS);
  expect(outcome.kind).toBe("needs_review");
  return (outcome as { reason: string }).reason;
};

describe("what a refused customer is told about each file", () => {
  it("says a CPF Board page cannot be used and what to upload instead", () => {
    const reason = reasonOf(["cpf.png"], [{ kind: "other", holderName: "TAN MEI", issuer: "Central Provident Fund Board" }]);

    expect(reason).toContain("cpf.png");
    expect(reason).toContain("CPF");
    expect(reason).toMatch(/payslips? or bank statements?/);
  });

  it("says a banking-app screenshot shows neither the name nor the bank, and asks for the bank's PDF statement", () => {
    const reason = reasonOf(["app.png"], [{ kind: "bank_statement", holderName: "", issuer: "" }]);

    expect(reason).toContain("app.png");
    expect(reason).toMatch(/does not show/);
    expect(reason).toContain("PDF statement");
  });

  it("keeps the old sentence for a payslip with no name on it", () => {
    const reason = reasonOf(["slip.png"], [{ kind: "payslip", holderName: "", issuer: "Kimseng Food" }]);

    expect(reason).toContain(
      "We could not find your name on slip.png. Please upload documents that show your name as it appears in Singpass.",
    );
  });

  it("names every file that has a problem, counted, when there are several", () => {
    const reason = reasonOf(
      ["a.png", "b.png", "c.png"],
      [
        { kind: "bank_statement", holderName: "", issuer: "" },
        { kind: "other", holderName: "", issuer: "CPF Board" },
        { kind: "payslip", holderName: "LEE KOK WEI", issuer: "Kimseng Food" },
      ],
    );

    expect(reason).toMatch(/^3 of your files cannot be used\./);
    for (const name of ["a.png", "b.png", "c.png"]) expect(reason).toContain(name);
  });

  it("ends several screenshot problems with one instruction, not one per file", () => {
    const reason = reasonOf(
      ["a.png", "b.png"],
      [
        { kind: "bank_statement", holderName: "", issuer: "" },
        { kind: "other", holderName: "", issuer: "Central Provident Fund Board" },
      ],
    );

    expect(reason).toContain("a.png is a screenshot that does not show your name or your bank.");
    expect(reason).toContain("b.png is a CPF Board page, which we cannot use.");
    expect(reason.match(/download the PDF of your payslip or bank statement/g)).toHaveLength(1);
    expect(reason).toMatch(/instead of a screenshot\.$/);
  });
});
