import { describe, expect, it } from "vitest";

import { decideApplyOutcome, decideIdentityOutcome } from "./apply-outcome";
import type { AscendCreditResult } from "./ascend/client";

/** A PASS exactly as /openApi/apply/credit returned one on 2026-09-16. */
const PASSED: AscendCreditResult = {
  orderId: "1549849627749851136",
  userId: "1426270128715821056",
  newCustomer: false,
  risk: { riskStatus: "PASS" },
  creditScore: {
    creditLevel: "A",
    creditLimit: 8000,
    creditScore: 588.26,
    mlcbMaxLoanAmount: 45807.28,
  },
};

/** A PENDING exactly as it came back for an applicant with no CPF or NOA. */
const PENDING: AscendCreditResult = {
  orderId: "1550075358878703616",
  userId: "1426270128715821056",
  newCustomer: false,
  risk: { riskStatus: "PENDING", riskMsg: "There is no income, please submit income" },
  // Empty, not populated. This is the shape that made the old type a lie.
  creditScore: {},
};

describe("decideApplyOutcome", () => {
  it("sends a passed applicant to the approval page with Ascend's A-Card Limit", () => {
    const outcome = decideApplyOutcome(PASSED);

    expect(outcome.kind).toBe("approved");
    expect(outcome.destination).toBe("/apply/approval");
    // 8000, not the 5000 that was asked for: Ascend can offer more than the
    // Desired Amount, and the A-Card Limit is the authority (ADR-0001).
    expect(outcome).toMatchObject({ aCardLimit: 8000, maximumLoanQuantum: 45807.28 });
  });

  it("sends a pending applicant to upload payslips, carrying Ascend's reason", () => {
    const outcome = decideApplyOutcome(PENDING);

    expect(outcome.kind).toBe("needs_income");
    expect(outcome.destination).toBe("/apply/verify-income");
    expect(outcome).toMatchObject({ reason: "There is no income, please submit income" });
  });

  it("offers no amount on pending, because Ascend has not decided one", () => {
    const outcome = decideApplyOutcome(PENDING);

    // creditScore is {} on PENDING, so any amount here would be invented.
    expect(outcome).not.toHaveProperty("aCardLimit");
  });

  it("sends a rejected applicant to the credit review queue, never to an offer", () => {
    const outcome = decideApplyOutcome({
      ...PASSED,
      risk: { riskStatus: "REJECT", riskMsg: "Outstanding balance exceeds limit" },
      creditScore: {},
    });

    expect(outcome.kind).toBe("declined");
    expect(outcome.destination).toBe("/apply/pending");
    expect(outcome).toMatchObject({ reason: "Outstanding balance exceeds limit" });
  });

  it("declines rather than approves when Ascend passes but names no limit", () => {
    // Defensive: a PASS with an empty creditScore has no A-Card Limit, and
    // falling back to 0 would render an offer of $0 as though it were real.
    const outcome = decideApplyOutcome({ ...PASSED, creditScore: {} });

    expect(outcome.kind).toBe("declined");
  });
});

describe("decideIdentityOutcome", () => {
  it("routes a returning borrower out of the web funnel", () => {
    const outcome = decideIdentityOutcome({
      userId: "1426270128715821056",
      newCustomer: false,
      hasMyinfo: true,
    });

    // ADR-0001: a Reloan Customer is sent to the mobile app, and no credit
    // pull is spent on someone who was always going to be redirected.
    expect(outcome).toMatchObject({ kind: "reloan", destination: "/apply/reloan" });
  });

  it("sends the whole MyInfo object when Ascend has none on file", () => {
    const outcome = decideIdentityOutcome({
      userId: "1550075519520546816",
      newCustomer: true,
      hasMyinfo: false,
    });

    // Passing userId alone here returns `600: The user has not authorized
    // myinfo`, which we saw against the live test environment.
    expect(outcome).toMatchObject({ kind: "continue", creditCallUses: "myinfo" });
  });

  it("sends only the userId once Ascend already holds MyInfo", () => {
    const outcome = decideIdentityOutcome({
      userId: "1426270128715821056",
      newCustomer: true,
      hasMyinfo: true,
    });

    // Saves sending an 8.6 KB payload Ascend already has.
    expect(outcome).toMatchObject({ kind: "continue", creditCallUses: "userId" });
  });
});
