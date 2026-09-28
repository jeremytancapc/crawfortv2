import { describe, expect, it } from "vitest";

import { assembleMonths, nextUploadAsk, uploadWindowLabel, type PayPeriod } from "./income-periods";

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
  // Pinned so "the last three months" is August, September and October 2025,
  // which is the window these cases are written against.
  const NOV = new Date("2025-11-15T00:00:00Z");
  const OCT = monthly("2025-10-01", "2025-10-31", 3200);
  const SEP = monthly("2025-09-01", "2025-09-30", 3100);
  const AUG = monthly("2025-08-01", "2025-08-31", 3000);

  it("asks for nothing when three consecutive months are covered", () => {
    expect(nextUploadAsk(assembleMonths([OCT, SEP, AUG]), { today: NOV })).toBeNull();
  });

  it("names the month still needed when two of three are in", () => {
    const ask = nextUploadAsk(assembleMonths([OCT, SEP]), { today: NOV });

    expect(ask).toBe("We have September and October 2025. Please add your August 2025 payslip.");
  });

  it("names the gap rather than asking for everything again", () => {
    const ask = nextUploadAsk(assembleMonths([OCT, AUG]), { today: NOV });

    expect(ask).toContain("September 2025");
  });

  it("asks for the missing half of a month, not another payslip", () => {
    // What a customer paid twice a month gets today is "upload 3 payslips",
    // which is what they just did. Naming the half they are missing is the
    // difference between finishing and dropping off.
    const ask = nextUploadAsk(assembleMonths([monthly("2025-08-16", "2025-08-31", 1408)]), {
      today: NOV,
    });

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

    expect(nextUploadAsk(weekly, { monthlyOnly: true, today: NOV })).toContain("monthly payslip");
    // The same documents are fine once weekly pay is accepted.
    expect(nextUploadAsk(weekly, { monthlyOnly: false, today: NOV })).not.toContain(
      "monthly payslip",
    );
  });
});

describe("nextUploadAsk anchors on today, not on what was uploaded", () => {
  // Reference date 17 Sep 2026, so the screen asks for June, July and August.
  const REF = new Date("2026-09-17T00:00:00Z");
  const slip = (start: string, end: string, gross: number): PayPeriod => ({
    employer: "Kimseng Food", start, end, gross,
  });

  it("does not walk backwards out of the window", () => {
    // The reported bug: one May payslip produced "please add your April 2026
    // payslip". April is further from the months actually wanted, and the
    // upload screen had already asked for June, July and August.
    const ask = nextUploadAsk(assembleMonths([slip("2026-05-01", "2026-05-31", 1680)]), {
      monthlyOnly: true,
      today: REF,
    });

    expect(ask).not.toContain("April");
    expect(ask).toContain("June");
    expect(ask).toContain("July");
    expect(ask).toContain("August");
  });

  it("asks only for the months still missing from the window", () => {
    const ask = nextUploadAsk(
      assembleMonths([
        slip("2026-08-01", "2026-08-31", 1690),
        slip("2026-07-01", "2026-07-31", 1670),
      ]),
      { monthlyOnly: true, today: REF },
    );

    expect(ask).toBe("We have July and August 2026. Please add your June 2026 payslip.");
  });

  it("is satisfied by exactly the three months the screen asked for", () => {
    const ask = nextUploadAsk(
      assembleMonths([
        slip("2026-08-01", "2026-08-31", 1690),
        slip("2026-07-01", "2026-07-31", 1670),
        slip("2026-06-01", "2026-06-30", 1700),
      ]),
      { monthlyOnly: true, today: REF },
    );

    expect(ask).toBeNull();
  });

  it("ignores an older month that happens to sit next to a wanted one", () => {
    // May is complete, but it is not one of the three being asked for, so it
    // must not count towards them or drag the ask backwards.
    const ask = nextUploadAsk(
      assembleMonths([
        slip("2026-05-01", "2026-05-31", 1680),
        slip("2026-06-01", "2026-06-30", 1700),
        slip("2026-07-01", "2026-07-31", 1670),
      ]),
      { monthlyOnly: true, today: REF },
    );

    expect(ask).toBe("We have June and July 2026. Please add your August 2026 payslip.");
  });

  it("still names a half-month gap inside the window", () => {
    const ask = nextUploadAsk(assembleMonths([slip("2026-08-16", "2026-08-31", 800)]), {
      monthlyOnly: true,
      today: REF,
    });

    expect(ask).toContain("1 to 15 August 2026");
  });
});

describe("nextUploadAsk accepts the latest three months, not only the three before this one", () => {
  // 28 Sep 2026: the screen names June, July and August, but an applicant
  // paid at the end of the month already holds September's payslip, and the
  // three most recent months they have are July, August and September.
  const TODAY = new Date("2026-09-28T00:00:00Z");
  const slip = (start: string, end: string, gross: number): PayPeriod => ({
    employer: "Kimseng Food", start, end, gross,
  });
  const JUN = slip("2026-06-01", "2026-06-30", 4800);
  const JUL = slip("2026-07-01", "2026-07-31", 4800);
  const AUG = slip("2026-08-01", "2026-08-31", 4900);
  const SEP = slip("2026-09-01", "2026-09-30", 4900);

  it("is satisfied by September, August and July", () => {
    expect(nextUploadAsk(assembleMonths([SEP, AUG, JUL]), { monthlyOnly: true, today: TODAY })).toBeNull();
  });

  it("is still satisfied by June, July and August", () => {
    expect(nextUploadAsk(assembleMonths([JUN, JUL, AUG]), { monthlyOnly: true, today: TODAY })).toBeNull();
  });

  it("asks for July, not June and July, when September and August are in", () => {
    const ask = nextUploadAsk(assembleMonths([SEP, AUG]), { monthlyOnly: true, today: TODAY });

    expect(ask).toBe("We have August and September 2026. Please add your July 2026 payslip.");
  });

  it("names the months the screen asked for when nothing leans either way", () => {
    const ask = nextUploadAsk(assembleMonths([AUG, JUL]), { monthlyOnly: true, today: TODAY });

    expect(ask).toBe("We have July and August 2026. Please add your June 2026 payslip.");
  });

  it("never takes a month after this one", () => {
    const OCT = slip("2026-10-01", "2026-10-31", 4900);
    const ask = nextUploadAsk(assembleMonths([OCT, SEP, AUG]), { monthlyOnly: true, today: TODAY });

    expect(ask).toBe("We have August and September 2026. Please add your July 2026 payslip.");
  });
});

describe("uploadWindowLabel names both sets of months the rule accepts", () => {
  it("offers the three before this month, or the three ending with it", () => {
    expect(uploadWindowLabel(new Date("2026-09-28T00:00:00Z"))).toEqual({
      long: "June to August, or July to September",
      short: "Jun–Aug or Jul–Sep",
    });
  });

  it("crosses the year without losing a month", () => {
    expect(uploadWindowLabel(new Date("2027-01-05T00:00:00Z")).long).toBe(
      "October to December, or November to January",
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
    expect(nextUploadAsk(assembly, { monthlyOnly: true, today: TODAY })).toBeNull();
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
    expect(nextUploadAsk(assembly, { monthlyOnly: true, today: TODAY })).toBeNull();
  });

  it("joins a mid-month job change into one full month", () => {
    const assembly = assembleMonths([
      dayJob("2026-08-01", "2026-08-15", 1600),
      nightJob("2026-08-16", "2026-08-31", 1900),
    ]);

    expect(assembly.months).toMatchObject([{ month: "2026-08", amount: 3500 }]);
  });
});
