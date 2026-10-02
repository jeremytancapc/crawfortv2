import { describe, expect, it } from "vitest";

import { assembleMonths, planIncomeMonths, uploadWindowLabel, type PayPeriod } from "./income-periods";

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

describe("planIncomeMonths - the latest payslip, and the two months before it", () => {
  // 2 Oct 2026: the latest payslip has to be for September or August.
  const TODAY = new Date("2026-10-02T00:00:00Z");
  const slip = (start: string, end: string, gross: number): PayPeriod => ({
    employer: "Kimseng Food", start, end, gross,
  });
  const MAY = slip("2026-05-01", "2026-05-31", 4800);
  const JUN = slip("2026-06-01", "2026-06-30", 4800);
  const JUL = slip("2026-07-01", "2026-07-31", 4800);
  const AUG = slip("2026-08-01", "2026-08-31", 4900);
  const SEP = slip("2026-09-01", "2026-09-30", 4900);
  const plan = (periods: PayPeriod[]) =>
    planIncomeMonths(assembleMonths(periods), { monthlyOnly: true, today: TODAY });

  it("is ready with September and the two months before it, and asks for nothing more", () => {
    expect(plan([SEP, AUG, JUL])).toEqual({
      kind: "ready",
      window: ["2026-07", "2026-08", "2026-09"],
      held: ["2026-09", "2026-08", "2026-07"],
      missing: [],
      advice: null,
    });
  });

  it("is ready with August as the latest - a September payslip is not necessary", () => {
    expect(plan([AUG, JUL, JUN])).toMatchObject({
      kind: "ready",
      window: ["2026-06", "2026-07", "2026-08"],
      missing: [],
    });
  });

  it("goes ahead on one payslip, and says which months would confirm it", () => {
    expect(plan([SEP])).toEqual({
      kind: "ready",
      window: ["2026-07", "2026-08", "2026-09"],
      held: ["2026-09"],
      missing: ["2026-07", "2026-08"],
      advice:
        "We'll go with your September 2026 payslip. Adding your July and August 2026 payslips " +
        "helps us confirm your income.",
    });
  });

  it("anchors on the most recent payslip it can take", () => {
    expect(plan([SEP, JUL])).toMatchObject({
      held: ["2026-09", "2026-07"],
      missing: ["2026-08"],
    });
  });

  it("asks for September or August when the latest payslip is older than that", () => {
    expect(plan([JUL, JUN, MAY])).toEqual({
      kind: "ask",
      ask: "Please upload your latest payslip - for September or August 2026.",
    });
  });

  it("asks for September or August when nothing was read", () => {
    expect(plan([])).toMatchObject({ kind: "ask" });
  });

  it("leaves months older than the window out", () => {
    expect(plan([SEP, AUG, JUL, JUN])).toMatchObject({
      held: ["2026-09", "2026-08", "2026-07"],
    });
  });

  it("never takes a month after this one", () => {
    const NOV = slip("2026-11-01", "2026-11-30", 9000);
    expect(plan([NOV, SEP])).toMatchObject({ window: ["2026-07", "2026-08", "2026-09"] });
  });

  it("asks for the rest of a half-covered latest month instead of falling back a month", () => {
    const halfSep = slip("2026-09-16", "2026-09-30", 2450);
    expect(plan([halfSep, AUG, JUL])).toEqual({
      kind: "ask",
      ask: "We have part of September 2026. Please add the payslip covering 1 to 15 September 2026.",
    });
  });

  it("asks for the monthly payslip when the latest month came from weekly ones", () => {
    const weekly = [
      slip("2026-09-01", "2026-09-07", 1100),
      slip("2026-09-08", "2026-09-14", 1100),
      slip("2026-09-15", "2026-09-21", 1100),
      slip("2026-09-22", "2026-09-28", 1100),
      slip("2026-09-29", "2026-10-05", 1100),
    ];
    const result = planIncomeMonths(assembleMonths(weekly), { monthlyOnly: true, today: TODAY });

    expect(result.kind).toBe("ask");
    if (result.kind === "ask") expect(result.ask).toContain("monthly payslip");
  });

  it("refuses a latest month whose payslips overlap", () => {
    const result = plan([SEP, slip("2026-09-01", "2026-09-30", 4900)]);

    expect(result.kind).toBe("ask");
    if (result.kind === "ask") expect(result.ask).toContain("cover some of the same days");
  });

  it("names the document by its kind", () => {
    const result = planIncomeMonths(assembleMonths([]), {
      monthlyOnly: true, today: TODAY, source: "bank_statement",
    });

    expect(result).toEqual({
      kind: "ask",
      ask: "Please upload your latest bank statement - for September or August 2026.",
    });
  });
});

describe("uploadWindowLabel names the months the latest document can be for", () => {
  it("names last month and the one before it", () => {
    expect(uploadWindowLabel(new Date("2026-10-02T00:00:00Z"))).toEqual({
      long: "September or August, and the 2 months before it",
      short: "latest: Sep or Aug",
    });
  });

  it("crosses the year without losing a month", () => {
    expect(uploadWindowLabel(new Date("2027-01-05T00:00:00Z")).long).toBe(
      "December or November, and the 2 months before it",
    );
  });
});

describe("assembleMonths with more than one employer", () => {
  const TODAY = new Date("2026-09-28T00:00:00Z");
  const at = (employer: string) => (start: string, end: string, gross: number): PayPeriod => ({
    employer, start, end, gross,
  });
  const dayJob = at("SUNRISE LOGISTICS PTE LTD");
  const nightJob = at("KOPI CORNER PTE LTD");

  it("adds two jobs' payslips for the same month together", () => {
    const assembly = assembleMonths([
      dayJob("2026-08-01", "2026-08-31", 3200),
      nightJob("2026-08-01", "2026-08-31", 1100),
    ]);

    expect(assembly.overlapping).toEqual([]);
    expect(assembly.months).toMatchObject([
      { month: "2026-08", amount: 4300, exact: true, periods: 2 },
    ]);
    expect(assembly.months[0].employer).toBe("SUNRISE LOGISTICS PTE LTD + KOPI CORNER PTE LTD");
  });

  it("still refuses the same employer's payslip twice", () => {
    const assembly = assembleMonths([
      dayJob("2026-08-01", "2026-08-31", 3200),
      at("Sunrise Logistics Pte. Ltd.")("2026-08-01", "2026-08-31", 3200),
    ]);

    expect(assembly.overlapping).toEqual(["2026-08"]);
    expect(assembly.months).toEqual([]);
  });

  it("counts a second job that started partway through the window from when it started", () => {
    const assembly = assembleMonths([
      dayJob("2026-06-01", "2026-06-30", 3200),
      dayJob("2026-07-01", "2026-07-31", 3200),
      dayJob("2026-08-01", "2026-08-31", 3200),
      nightJob("2026-08-01", "2026-08-31", 1100),
    ]);

    expect(assembly.months.map((m) => [m.month, m.amount])).toEqual([
      ["2026-08", 4300],
      ["2026-07", 3200],
      ["2026-06", 3200],
    ]);
    expect(planIncomeMonths(assembly, { monthlyOnly: true, today: TODAY })).toMatchObject({
      kind: "ready",
      missing: [],
    });
  });

  it("treats the same dates and the same pay under two spellings as one payslip twice", () => {
    // Two jobs paying to the cent for the same days is not a thing that
    // happens; one payslip whose employer was read two ways is.
    const assembly = assembleMonths([
      dayJob("2026-08-01", "2026-08-31", 3200),
      at("SUNRISE GROUP")("2026-08-01", "2026-08-31", 3200),
    ]);

    expect(assembly.overlapping).toEqual(["2026-08"]);
  });

  it("counts a second job that started mid-month, since it has no payslip for the days before", () => {
    const assembly = assembleMonths([
      dayJob("2026-06-01", "2026-06-30", 3200),
      dayJob("2026-07-01", "2026-07-31", 3200),
      dayJob("2026-08-01", "2026-08-31", 3200),
      nightJob("2026-08-16", "2026-08-31", 550),
    ]);

    expect(assembly.months[0]).toMatchObject({ month: "2026-08", amount: 3750 });
    expect(planIncomeMonths(assembly, { monthlyOnly: true, today: TODAY })).toMatchObject({
      kind: "ready",
      missing: [],
    });
  });

  it("joins a mid-month job change into one full month", () => {
    const assembly = assembleMonths([
      dayJob("2026-08-01", "2026-08-15", 1600),
      nightJob("2026-08-16", "2026-08-31", 1900),
    ]);

    expect(assembly.months).toMatchObject([{ month: "2026-08", amount: 3500 }]);
  });
});
