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
};

const snapshot = (probes: Partial<Snapshot["probes"]> = {}, counts: Partial<Snapshot["counts"]> = {}): Snapshot => ({
  ...QUIET,
  probes: { ...QUIET.probes, ...probes },
  counts: { ...QUIET.counts, ...counts },
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

  it("does not guess when the live site could not be asked", () => {
    expect(levels(snapshot({ healthProblems: null }))).toEqual(["warn:health_unavailable"]);
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
});
