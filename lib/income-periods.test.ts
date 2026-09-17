import { describe, expect, it } from "vitest";

import { assembleMonths, nextUploadAsk, type PayPeriod } from "./income-periods";

/** A whole calendar month, the shape a monthly payslip produces. */
function monthly(start: string, end: string, gross: number): PayPeriod {
  return { employer: "Elite Logistics", start, end, gross };
}

describe("assembleMonths", () => {
  it("passes a whole-month period through exactly", () => {
    const { months } = assembleMonths([monthly("2025-10-01", "2025-10-31", 3078)]);

    expect(months).toEqual([
      { month: "2025-10", amount: 3078, employer: "Elite Logistics", exact: true, periods: 1 },
    ]);
  });

  it("sums two half-month periods into one month", () => {
    // The casual-labour case: paid 1st-15th and 16th-end. Neither half is a
    // month's income; together they are, exactly.
    const { months } = assembleMonths([
      monthly("2025-08-01", "2025-08-15", 2690),
      monthly("2025-08-16", "2025-08-31", 1408),
    ]);

    expect(months).toEqual([
      { month: "2025-08", amount: 4098, employer: "Elite Logistics", exact: true, periods: 2 },
    ]);
  });

  it("apportions weekly periods that straddle the month boundary", () => {
    // $600 a week. The first week gives October 5 of its 7 days, the last
    // gives 5 of 7. October is covered 31/31 and is not exact.
    const { months } = assembleMonths([
      monthly("2025-09-29", "2025-10-05", 600),
      monthly("2025-10-06", "2025-10-12", 600),
      monthly("2025-10-13", "2025-10-19", 600),
      monthly("2025-10-20", "2025-10-26", 600),
      monthly("2025-10-27", "2025-11-02", 600),
    ]);

    const october = months.find((m) => m.month === "2025-10");
    expect(october).toMatchObject({ exact: false, periods: 5 });
    // 600*5/7 + 600 + 600 + 600 + 600*5/7
    expect(october!.amount).toBeCloseTo(2657.14, 2);
  });

  it("will not report a month with a gap in it", () => {
    // Only the second half of August was uploaded. Reporting 1408 as August
    // would halve a real person's income.
    const { months, incomplete } = assembleMonths([monthly("2025-08-16", "2025-08-31", 1408)]);

    expect(months).toEqual([]);
    expect(incomplete).toEqual([
      {
        month: "2025-08",
        daysCovered: 16,
        daysInMonth: 31,
        missing: [{ from: "2025-08-01", to: "2025-08-15" }],
      },
    ]);
  });

  it("will not report a month whose periods overlap", () => {
    // Overlap means a day's pay counted twice, which inflates income - the
    // direction that costs the applicant money they cannot repay.
    const { months, overlapping } = assembleMonths([
      monthly("2025-10-01", "2025-10-20", 2000),
      monthly("2025-10-15", "2025-10-31", 1800),
    ]);

    expect(months).toEqual([]);
    expect(overlapping).toEqual(["2025-10"]);
  });

  it("refuses a two-day period on its own", () => {
    // The MINISO payslip: 29-30 Sep only, $182.73. A real document, but not
    // a month of income.
    const { months, incomplete } = assembleMonths([monthly("2025-09-29", "2025-09-30", 182.73)]);

    expect(months).toEqual([]);
    expect(incomplete[0]).toMatchObject({ month: "2025-09", daysCovered: 2 });
  });

  it("returns months most recent first", () => {
    const { months } = assembleMonths([
      monthly("2025-08-01", "2025-08-31", 3000),
      monthly("2025-10-01", "2025-10-31", 3200),
      monthly("2025-09-01", "2025-09-30", 3100),
    ]);

    expect(months.map((m) => m.month)).toEqual(["2025-10", "2025-09", "2025-08"]);
  });

  it("ignores a period whose dates make no sense", () => {
    // "31/11/2025" appeared on a real payslip. A period that ends before it
    // starts is a misread, not income.
    const { months } = assembleMonths([
      monthly("2025-10-31", "2025-10-01", 3290.6),
      monthly("2025-09-01", "2025-09-30", 3100),
    ]);

    expect(months.map((m) => m.month)).toEqual(["2025-09"]);
  });
});

describe("missing ranges", () => {
  it("says which days of a part-covered month are absent", () => {
    // The casual-labour payslip: only 16-31 Aug uploaded.
    const { incomplete } = assembleMonths([monthly("2025-08-16", "2025-08-31", 1408)]);

    expect(incomplete[0].missing).toEqual([{ from: "2025-08-01", to: "2025-08-15" }]);
  });

  it("reports a gap in the middle as its own range", () => {
    const { incomplete } = assembleMonths([
      monthly("2025-08-01", "2025-08-10", 900),
      monthly("2025-08-21", "2025-08-31", 1000),
    ]);

    expect(incomplete[0].missing).toEqual([{ from: "2025-08-11", to: "2025-08-20" }]);
  });
});

describe("nextUploadAsk", () => {
  const OCT = monthly("2025-10-01", "2025-10-31", 3200);
  const SEP = monthly("2025-09-01", "2025-09-30", 3100);
  const AUG = monthly("2025-08-01", "2025-08-31", 3000);

  it("asks for nothing when three consecutive months are covered", () => {
    expect(nextUploadAsk(assembleMonths([OCT, SEP, AUG]))).toBeNull();
  });

  it("names the month still needed when two of three are in", () => {
    const ask = nextUploadAsk(assembleMonths([OCT, SEP]));

    expect(ask).toBe("We have September and October 2025. Please add your August 2025 payslip.");
  });

  it("names the gap rather than asking for everything again", () => {
    const ask = nextUploadAsk(assembleMonths([OCT, AUG]));

    expect(ask).toContain("September 2025");
  });

  it("asks for the missing half of a month, not another payslip", () => {
    // What a customer paid twice a month gets today is "upload 3 payslips",
    // which is what they just did. Naming the half they are missing is the
    // difference between finishing and dropping off.
    const ask = nextUploadAsk(assembleMonths([monthly("2025-08-16", "2025-08-31", 1408)]));

    expect(ask).toContain("1 to 15 August 2025");
  });

  it("asks for a monthly payslip when only monthly figures are accepted", () => {
    // Four weekly payslips cover October exactly, but the figure is
    // apportioned - it appears on no payslip. Under a monthly-only policy
    // that is not something to underwrite against.
    const weekly = assembleMonths([
      monthly("2025-09-29", "2025-10-05", 600),
      monthly("2025-10-06", "2025-10-12", 600),
      monthly("2025-10-13", "2025-10-19", 600),
      monthly("2025-10-20", "2025-10-26", 600),
      monthly("2025-10-27", "2025-11-02", 600),
    ]);

    expect(nextUploadAsk(weekly, { monthlyOnly: true })).toContain("monthly payslip");
    // The same documents are fine once weekly pay is accepted.
    expect(nextUploadAsk(weekly, { monthlyOnly: false })).not.toContain("monthly payslip");
  });
});
