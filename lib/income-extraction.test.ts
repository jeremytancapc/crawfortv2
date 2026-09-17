import { describe, expect, it } from "vitest";

import { monthParts, reviewExtraction, type ExtractedMonth } from "./income-extraction";

const THREE: ExtractedMonth[] = [
  { month: "2026-08", amount: 4280, employer: "Grab Holdings Limited" },
  { month: "2026-07", amount: 4150, employer: "Grab Holdings Limited" },
  { month: "2026-06", amount: 4200, employer: "Grab Holdings Limited" },
];

describe("reviewExtraction", () => {
  it("accepts three consistent months", () => {
    const result = reviewExtraction(THREE);

    expect(result.kind).toBe("usable");
    expect(result).toMatchObject({ m1: 4280, m2: 4150, m3: 4200 });
  });

  it("orders by month, so m1 is the most recent whatever order they arrived in", () => {
    const shuffled = [THREE[2], THREE[0], THREE[1]];
    const result = reviewExtraction(shuffled);

    expect(result).toMatchObject({ m1: 4280, m2: 4150, m3: 4200 });
  });

  it("refuses fewer than three months rather than padding", () => {
    // Ascend wants m1, m2 and m3. Inventing the third from an average would
    // put a number nobody read into a credit decision.
    const result = reviewExtraction(THREE.slice(0, 2));

    expect(result.kind).toBe("needs_review");
    expect(result).toMatchObject({ reason: expect.stringContaining("3 months") });
  });

  it("refuses a zero or negative amount", () => {
    const result = reviewExtraction([{ ...THREE[0], amount: 0 }, THREE[1], THREE[2]]);

    expect(result.kind).toBe("needs_review");
  });

  it("flags a month that dwarfs the others", () => {
    // The classic payslip misread: year-to-date taken for one month's pay.
    // 4280 and 4150 alongside 51000 is not a pay rise.
    const result = reviewExtraction([{ ...THREE[0], amount: 51000 }, THREE[1], THREE[2]]);

    expect(result.kind).toBe("needs_review");
    expect(result).toMatchObject({ reason: expect.stringContaining("year-to-date") });
  });

  it("allows a normal variation, like a month with overtime", () => {
    const result = reviewExtraction([{ ...THREE[0], amount: 5600 }, THREE[1], THREE[2]]);

    expect(result.kind).toBe("usable");
  });

  it("flags months that are not consecutive", () => {
    // A gap means a payslip is missing, and Ascend is told m1/m2/m3 are the
    // three months before this one.
    const result = reviewExtraction([
      { month: "2026-08", amount: 4280, employer: null },
      { month: "2026-05", amount: 4150, employer: null },
      { month: "2026-04", amount: 4200, employer: null },
    ]);

    expect(result.kind).toBe("needs_review");
    expect(result).toMatchObject({ reason: expect.stringContaining("consecutive") });
  });
});

describe("monthParts", () => {
  it("splits an ISO month into the parts the results screen renders", () => {
    expect(monthParts("2026-08")).toEqual({
      label: "August 2026",
      month: "August",
      year: "2026",
    });
  });

  it("handles January without an off-by-one", () => {
    // "2026-01" is January. Month numbers are 1-based here and 0-based in
    // Date, which is exactly where this goes wrong.
    expect(monthParts("2026-01").month).toBe("January");
  });

  it("falls back to the raw value rather than rendering Invalid Date", () => {
    expect(monthParts("not-a-month")).toEqual({
      label: "not-a-month",
      month: "not-a-month",
      year: "",
    });
  });
});
