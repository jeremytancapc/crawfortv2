import { describe, expect, it } from "vitest";

import {
  applicantSafeNote,
  monthParts,
  reviewExtraction,
  type ExtractedMonth,
} from "./income-extraction";

const THREE: ExtractedMonth[] = [
  { month: "2026-08", amount: 4280, employer: "Grab Holdings Limited" },
  { month: "2026-07", amount: 4150, employer: "Grab Holdings Limited" },
  { month: "2026-06", amount: 4200, employer: "Grab Holdings Limited" },
];

describe("reviewExtraction", () => {
  const WINDOW = ["2026-06", "2026-07", "2026-08"];

  it("accepts three consistent months", () => {
    const result = reviewExtraction(THREE, WINDOW);

    expect(result).toMatchObject({ kind: "usable", m1: 4280, m2: 4150, m3: 4200, filled: [] });
  });

  it("orders by month, so m1 is the most recent whatever order they arrived in", () => {
    const shuffled = [THREE[2], THREE[0], THREE[1]];
    const result = reviewExtraction(shuffled, WINDOW);

    expect(result).toMatchObject({ m1: 4280, m2: 4150, m3: 4200 });
  });

  it("goes ahead on one month, sending it as the income for the months not read", () => {
    // The applicant is told we went with the one payslip. Ascend averages
    // m1-m3, so a zero for each unread month would cut their income to a
    // third of what the payslip says - the figure they were shown.
    const result = reviewExtraction([THREE[0]], WINDOW);

    expect(result).toMatchObject({
      kind: "usable", m1: 4280, m2: 4280, m3: 4280, filled: ["2026-06", "2026-07"],
    });
    if (result.kind === "usable") expect(result.months).toHaveLength(1);
  });

  it("fills a missing month with the average of the ones read", () => {
    const result = reviewExtraction([THREE[0], THREE[2]], WINDOW);

    expect(result).toMatchObject({ m1: 4280, m2: 4240, m3: 4200, filled: ["2026-07"] });
  });

  it("refuses nothing read at all", () => {
    expect(reviewExtraction([], WINDOW).kind).toBe("needs_review");
  });

  it("refuses a zero or negative amount", () => {
    const result = reviewExtraction([{ ...THREE[0], amount: 0 }, THREE[1], THREE[2]], WINDOW);

    expect(result.kind).toBe("needs_review");
  });

  it("flags a month that dwarfs the others", () => {
    // The classic payslip misread: year-to-date taken for one month's pay.
    // 4280 and 4150 alongside 51000 is not a pay rise.
    const result = reviewExtraction([{ ...THREE[0], amount: 51000 }, THREE[1], THREE[2]], WINDOW);

    expect(result.kind).toBe("needs_review");
    expect(result).toMatchObject({ reason: expect.stringContaining("year-to-date") });
  });

  it("allows a normal variation, like a month with overtime", () => {
    const result = reviewExtraction([{ ...THREE[0], amount: 5600 }, THREE[1], THREE[2]], WINDOW);

    expect(result.kind).toBe("usable");
  });

  it("ignores a month outside the window", () => {
    const result = reviewExtraction(
      [...THREE, { month: "2026-05", amount: 99000, employer: null }],
      WINDOW,
    );

    expect(result).toMatchObject({ kind: "usable", m1: 4280, m2: 4150, m3: 4200 });
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

describe("applicantSafeNote", () => {
  // Both strings below came back from the live API on 2026-09-17, reading
  // scanned payslips. The model emitted its own tool-call syntax into the
  // free-text note instead of a sentence. Two of eighteen real documents did
  // it, and on the `unreadable` path that note becomes the reason shown to
  // the applicant - so it cannot reach a screen.
  const LEAKED_SYNTAX =
    '</antml：parameter>\n<parameter name="months">' +
    '[{"month": "2025-09", "amount": 11877.20, "employer": "NTUC MY FIRST SKOOL LTD"}]';

  it("drops a note that is the model's own tool-call syntax", () => {
    expect(applicantSafeNote(LEAKED_SYNTAX)).toBeNull();
  });

  it("drops a note carrying a raw JSON payload", () => {
    expect(
      applicantSafeNote('[{"month": "2025-11", "amount": 4386.00, "employer": "CARLSBERG"}]'),
    ).toBeNull();
  });

  it("keeps a real sentence untouched", () => {
    const real =
      "Single payslip for October 2025; gross taken as Basic Salary S$20,000. " +
      'The S$4,435.80 "Exp Reim" line is an expense reimbursement and was excluded.';

    expect(applicantSafeNote(real)).toBe(real);
  });

  it("keeps a sentence that merely mentions a tag-like word", () => {
    const real = "Gross is the <b>Total Earning</b> figure, not the YTD column.";

    expect(applicantSafeNote(real)).toBe("Gross is the Total Earning figure, not the YTD column.");
  });

  it("treats blank and whitespace as no note", () => {
    expect(applicantSafeNote("")).toBeNull();
    expect(applicantSafeNote("   \n  ")).toBeNull();
  });
});
