import { describe, expect, it } from "vitest";

import { shapeProblems, summariseShapeLog } from "./shape";

/**
 * Ascend changed how it answers without telling anyone: from 8 Oct a PASS from
 * income/credit came back with an empty creditScore, and the first we knew was
 * testers on the pending page. These pin what its replies are known to look
 * like - the shapes below are real ones from staging - so the next change shows
 * up as a logged problem the day it starts, not as a customer complaint.
 */

const SCORE = { creditLevel: "D", creditLimit: 700, creditScore: 585.9, mlcbMaxLoanAmount: 18617.68 };
const reply = (over: Record<string, unknown> = {}) => ({
  risk: { riskStatus: "PASS" },
  creditScore: SCORE,
  orderId: "1558084373801472000",
  userId: "1550194515653763072",
  newCustomer: true,
  ...over,
});
const income = "/openApi/income/credit";
const codes = (path: string, data: unknown) => shapeProblems(path, data).map((p) => p.code);

describe("replies that are normal - no problem", () => {
  it("a PASS carrying its whole score", () => {
    expect(codes(income, reply())).toEqual([]);
  });

  it("a PENDING with no score yet, and the hasIncome flag query/credit adds", () => {
    expect(codes("/openApi/query/credit", reply({ risk: { riskStatus: "PENDING", riskMsg: "There is no income" }, creditScore: {}, hasIncome: false }))).toEqual([]);
  });

  it("a REJECT, even one that still carries a score", () => {
    expect(codes(income, reply({ risk: { riskStatus: "REJECT" } }))).toEqual([]);
    expect(codes(income, reply({ risk: { riskStatus: "REJECT" }, creditScore: {} }))).toEqual([]);
  });

  it("an endpoint it does not know is left alone", () => {
    expect(codes("/openApi/order/comments", { anything: 1 })).toEqual([]);
  });
});

describe("a PASS that is missing something - worth watching", () => {
  it("with an empty creditScore: the change of 8 Oct", () => {
    const found = shapeProblems(income, reply({ creditScore: {} }));

    expect(found.map((p) => p.code)).toEqual(["pass_without_limit"]);
    expect(found[0].severity).toBe("watch");
  });

  it("with a limit but no MLCB maximum: seen on 12 Oct, and the bureau ceiling is then unknown", () => {
    const { mlcbMaxLoanAmount: _unused, ...withoutMlcb } = SCORE;
    void _unused;

    const found = shapeProblems(income, reply({ creditScore: withoutMlcb }));

    expect(found.map((p) => p.code)).toEqual(["pass_without_mlcb_max"]);
    expect(found[0].severity).toBe("watch");
  });

  it("with a zero limit", () => {
    expect(codes(income, reply({ creditScore: { ...SCORE, creditLimit: 0 } }))).toEqual(["pass_without_limit"]);
  });
});

describe("something we have never seen - an alert", () => {
  it("a status that is not PASS, PENDING or REJECT", () => {
    const found = shapeProblems(income, reply({ risk: { riskStatus: "REVIEW" } }));

    expect(found.map((p) => p.code)).toEqual(["unknown_risk_status"]);
    expect(found[0].severity).toBe("alert");
    expect(found[0].detail).toContain("REVIEW");
  });

  it("no risk at all", () => {
    expect(codes(income, reply({ risk: undefined }))).toContain("missing_risk");
  });

  it("no order id", () => {
    expect(codes(income, reply({ orderId: undefined }))).toContain("missing_order_id");
  });

  it("a new field at the top, in risk, or in the score", () => {
    expect(codes(income, reply({ riskStep: 1 }))).toEqual(["unexpected_fields"]);
    expect(codes(income, reply({ risk: { riskStatus: "PASS", stage: "ELIGIBILITY" } }))).toEqual(["unexpected_fields"]);
    expect(codes(income, reply({ creditScore: { ...SCORE, tier: "gold" } }))).toEqual(["unexpected_fields"]);
  });

  it("names the new field so it can be looked up", () => {
    expect(shapeProblems(income, reply({ riskStep: 1 }))[0].detail).toContain("riskStep");
  });

  it("not an object at all", () => {
    expect(codes(income, "ok")).toEqual(["not_an_object"]);
    expect(codes(income, null)).toEqual(["not_an_object"]);
  });
});

describe("summariseShapeLog - the daily report", () => {
  const rows = [
    { codes: "pass_without_limit", n: 12 },
    { codes: "pass_without_mlcb_max", n: 2 },
  ];

  it("is quiet when only the known things to watch appeared", () => {
    const summary = summariseShapeLog(rows);

    expect(summary.alert).toBe(false);
    expect(summary.counts).toEqual({ pass_without_limit: 12, pass_without_mlcb_max: 2 });
  });

  it("raises an alert when anything else appeared", () => {
    expect(summariseShapeLog([...rows, { codes: "unexpected_fields", n: 1 }]).alert).toBe(true);
    expect(summariseShapeLog([{ codes: "unknown_risk_status,pass_without_limit", n: 3 }]).counts).toEqual({
      unknown_risk_status: 3,
      pass_without_limit: 3,
    });
  });

  it("says nothing when nothing was logged", () => {
    expect(summariseShapeLog([])).toEqual({ alert: false, counts: {} });
  });
});
