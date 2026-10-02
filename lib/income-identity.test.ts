import { describe, expect, it } from "vitest";

import { isRecognisedSgBank, nameBelongsTo } from "./income-identity";

describe("nameBelongsTo - is the name on a document the applicant's", () => {
  const applicant = "TAN CAKEN";

  it("matches the Singpass name as printed", () => {
    expect(nameBelongsTo("TAN CAKEN", applicant)).toBe(true);
  });

  it("ignores order, case and punctuation - payrolls print names their own way", () => {
    expect(nameBelongsTo("Caken Tan", applicant)).toBe(true);
    expect(nameBelongsTo("TAN, CAKEN", applicant)).toBe(true);
  });

  it("ignores a title", () => {
    expect(nameBelongsTo("MR TAN CAKEN", applicant)).toBe(true);
  });

  it("accepts a shortened name that is still at least two of theirs", () => {
    expect(nameBelongsTo("MUHAMMAD ALI", "MUHAMMAD ALI BIN ABDULLAH")).toBe(true);
    expect(nameBelongsTo("FELICIA TAN", "FELICIA TAN WEI LIN")).toBe(true);
  });

  it("accepts initials for the parts it shortens", () => {
    expect(nameBelongsTo("TAN W L FELICIA", "FELICIA TAN WEI LIN")).toBe(true);
  });

  it("accepts a document that adds an alias the applicant also uses", () => {
    expect(nameBelongsTo("TAN CAKEN (CHEN KAJUN)", applicant, ["CHEN KAJUN"])).toBe(true);
  });

  it("refuses someone else", () => {
    expect(nameBelongsTo("LIM WEI JIE", applicant)).toBe(false);
  });

  it("refuses a name that shares only a surname", () => {
    expect(nameBelongsTo("TAN AH KOW", applicant)).toBe(false);
    expect(nameBelongsTo("TAN", applicant)).toBe(false);
  });

  it("refuses a document with no name on it", () => {
    expect(nameBelongsTo("", applicant)).toBe(false);
  });

  it("matches a joint account when the applicant is one of the holders", () => {
    expect(nameBelongsTo("LIM WEI JIE & TAN CAKEN", applicant)).toBe(true);
    expect(nameBelongsTo("LIM WEI JIE AND ONG MEI LING", applicant)).toBe(false);
  });
});

describe("isRecognisedSgBank", () => {
  it("knows the banks Singapore salaries are paid into", () => {
    for (const bank of ["DBS Bank Ltd", "POSB", "OCBC", "UOB", "Standard Chartered Bank (Singapore) Limited",
      "HSBC", "Citibank Singapore", "Maybank Singapore", "Trust Bank", "GXS Bank", "MariBank"]) {
      expect(isRecognisedSgBank(bank)).toBe(true);
    }
  });

  it("refuses a bank it does not know, or none", () => {
    expect(isRecognisedSgBank("MERLION BANK")).toBe(false);
    expect(isRecognisedSgBank("")).toBe(false);
  });
});
