import { describe, expect, it } from "vitest";

import { findingsFrom, type Snapshot } from "./findings";

const QUIET: Snapshot = {
  windowMinutes: 10,
  probes: { siteOk: true, lambdaOk: true, ascendCredentialsOk: true, healthProblems: [] },
  counts: {
    newApplicants: 0,
    submittedWithoutOrder: 0,
    ascendSkipped: 0,
    ascendFailures: 0,
    airconnectFailures: 0,
    passWithoutLimit: 0,
    singpassRedirects: 0,
    singpassCallbacks: 0,
    readerFailures: 0,
    approvedWithoutLimit: 0,
  },
  applicants: [],
};

const snapshot = (
  probes: Partial<Snapshot["probes"]> = {},
  counts: Partial<Snapshot["counts"]> = {},
  applicants: Snapshot["applicants"] = [],
): Snapshot => ({
  ...QUIET,
  probes: { ...QUIET.probes, ...probes },
  counts: { ...QUIET.counts, ...counts },
  applicants,
});

const person = (stage: string, minutesIdle: number, over: Partial<NonNullable<Snapshot["applicants"]>[number]> = {}) => ({
  ref: "CFH5-AAAA1111",
  stage,
  minutesIdle,
  mobileLast4: "7988",
  issue: null,
  ...over,
});

const levels = (s: Snapshot) => findingsFrom(s).map((f) => `${f.level}:${f.code}`);

describe("findingsFrom", () => {
  it("says nothing when all is well and nobody has applied", () => {
    expect(findingsFrom(QUIET)).toEqual([]);
  });

  it("only notes who applied when all is well", () => {
    expect(levels(snapshot({}, { newApplicants: 2 }))).toEqual(["info:new_applicants"]);
  });

  it.each([
    ["the site is down", { siteOk: false }, "urgent:site_down"],
    ["the Singpass Lambda is down", { lambdaOk: false }, "urgent:singpass_lambda_down"],
    ["Ascend refuses our credentials", { ascendCredentialsOk: false }, "urgent:ascend_credentials"],
  ])("is urgent when %s", (_name, probes, expected) => {
    expect(levels(snapshot(probes))).toContain(expected);
  });

  it("is urgent when the live site reports a wrong setting, and names it", () => {
    const found = findingsFrom(snapshot({ healthProblems: ["ascend", "cron"] }));

    expect(found).toEqual([expect.objectContaining({ level: "urgent", code: "config_problems" })]);
    expect(found[0]!.message).toContain("ascend");
    expect(found[0]!.message).toContain("cron");
  });

  it("only mentions, and does not warn, when the live site could not be asked about its settings", () => {
    expect(levels(snapshot({ healthProblems: null }))).toEqual(["info:health_unavailable"]);
  });

  it("is urgent the moment an applicant was sent to Ascend's skip path (the fault of 16 Oct)", () => {
    expect(levels(snapshot({}, { ascendSkipped: 1 }))).toContain("urgent:ascend_skipped");
  });

  it("is urgent when someone submitted and Ascend never made them an order", () => {
    expect(levels(snapshot({}, { submittedWithoutOrder: 1 }))).toContain("urgent:applicants_without_order");
  });

  it.each([
    ["an Ascend call fails", { ascendFailures: 1 }, "urgent:ascend_errors"],
    ["a lead or appointment fails to reach AirConnect", { airconnectFailures: 1 }, "urgent:airconnect_failures"],
    ["an approved applicant has no limit", { approvedWithoutLimit: 1 }, "urgent:approved_without_limit"],
  ])("is urgent when %s", (_name, counts, expected) => {
    expect(levels(snapshot({}, counts))).toContain(expected);
  });

  it("is urgent when people go to Singpass and none come back", () => {
    expect(levels(snapshot({}, { singpassRedirects: 3, singpassCallbacks: 0 }))).toContain("urgent:singpass_not_completing");
  });

  it("is not alarmed by one or two people who simply gave up at Singpass", () => {
    expect(levels(snapshot({}, { singpassRedirects: 2, singpassCallbacks: 0 }))).toEqual([]);
  });

  it("warns when most Singpass attempts do not come back, but some do", () => {
    expect(levels(snapshot({}, { singpassRedirects: 8, singpassCallbacks: 2 }))).toEqual(["warn:singpass_dropping"]);
  });

  it("is quiet when most Singpass attempts complete", () => {
    expect(levels(snapshot({}, { singpassRedirects: 8, singpassCallbacks: 7 }))).toEqual([]);
  });

  it("warns, not urgent, for a PASS that arrived without a limit: the app asks again by itself", () => {
    expect(levels(snapshot({}, { passWithoutLimit: 1 }))).toEqual(["warn:pass_without_limit"]);
  });

  it("warns when the document reader keeps failing", () => {
    expect(levels(snapshot({}, { readerFailures: 3 }))).toEqual(["warn:reader_failures"]);
    expect(levels(snapshot({}, { readerFailures: 2 }))).toEqual([]);
  });

  it("puts urgent findings first", () => {
    const order = levels(snapshot({ siteOk: false }, { newApplicants: 4, passWithoutLimit: 1 }));

    expect(order[0]).toBe("urgent:site_down");
    expect(order.at(-1)).toBe("info:new_applicants");
  });

  describe("applicants who are stuck", () => {
    it("says so once, in the window in which they become stuck", () => {
      // logged in with Singpass and never submitted: stuck after 20 minutes. The window is 10 minutes.
      expect(levels(snapshot({}, {}, [person("logged_in_not_submitted", 24)]))).toEqual(["warn:stuck_logged_in_not_submitted"]);
    });

    it("does not say it again once they have been stuck for longer than the window", () => {
      expect(levels(snapshot({}, {}, [person("logged_in_not_submitted", 31)]))).toEqual([]);
    });

    it("does not say it before they have been idle long enough: they may still be typing", () => {
      expect(levels(snapshot({}, {}, [person("logged_in_not_submitted", 12)]))).toEqual([]);
    });

    it("names who, so staff can follow them up, with only the last four digits of the number", () => {
      const [finding] = findingsFrom(snapshot({}, {}, [person("plan_chosen_not_booked", 62, { ref: "CFH5-BBBB2222", mobileLast4: "1234" })]));

      expect(finding!.message).toContain("CFH5-BBBB2222");
      expect(finding!.message).toContain("1234");
      expect(finding!.message).toContain("plan");
    });

    it("includes the reason a document was refused, since that is why they stopped", () => {
      const [finding] = findingsFrom(
        snapshot({}, {}, [person("uploading_income_not_submitted", 33, { issue: "We could not find your name on payslip.pdf." })]),
      );

      expect(finding!.message).toContain("could not find your name");
    });

    it("groups people stuck at the same step into one finding", () => {
      const found = findingsFrom(
        snapshot({}, {}, [
          person("needs_income_not_started", 32, { ref: "CFH5-AAAA1111" }),
          person("needs_income_not_started", 35, { ref: "CFH5-BBBB2222" }),
        ]),
      );

      expect(found).toHaveLength(1);
      expect(found[0]!.message).toContain("2 applicant(s)");
      expect(found[0]!.message).toContain("CFH5-AAAA1111");
      expect(found[0]!.message).toContain("CFH5-BBBB2222");
    });

    it("waits longer before calling a review a delay: staff need time", () => {
      expect(levels(snapshot({}, {}, [person("waiting_for_staff_review", 60)]))).toEqual([]);
      expect(levels(snapshot({}, {}, [person("waiting_for_staff_review", 245)]))).toEqual(["warn:stuck_waiting_for_staff_review"]);
    });

    it("ignores people who finished, who were sent to the app on purpose, or who never logged in", () => {
      for (const stage of ["booked", "declined_offer", "existing_customer_redirected", "started_not_logged_in", "rejected_by_ascend"]) {
        expect(levels(snapshot({}, {}, [person(stage, 24)])), stage).toEqual([]);
      }
    });

    it("does not double up the faults the counts already report as urgent", () => {
      expect(levels(snapshot({}, { submittedWithoutOrder: 1, approvedWithoutLimit: 1 }, [person("submitted_no_ascend_order", 3), person("approved_without_limit", 3)]))).toEqual([
        "urgent:applicants_without_order",
        "urgent:approved_without_limit",
      ]);
    });

    it("warns that the stuck check could not run, rather than saying all is well, when the reporting views are missing", () => {
      expect(levels(snapshot({}, {}, null))).toEqual(["warn:stuck_check_unavailable"]);
    });
  });
});
