import { describe, expect, it } from "vitest";

import { decideAfterIncome,
  decideApplyOutcome, decideIdentityOutcome, decideSubmission } from "./apply-outcome";
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

  it("carries the userId forward, because everything after needs it", () => {
    // /openApi/users is the only call that returns it, and both the credit
    // pull and every document upload are addressed by it. Dropping it here is
    // why ascend_user_id was null on the one Order that did get created.
    const outcome = decideIdentityOutcome({
      userId: "1550075519520546816",
      newCustomer: true,
      hasMyinfo: false,
    });

    expect(outcome).toMatchObject({ kind: "continue", userId: "1550075519520546816" });
  });

  it("carries the userId on a reloan too, so the redirect is still recorded", () => {
    const outcome = decideIdentityOutcome({
      userId: "1426270128715821056",
      newCustomer: false,
      hasMyinfo: true,
    });

    expect(outcome).toMatchObject({ kind: "reloan", userId: "1426270128715821056" });
  });

  it("sends the MyInfo payload even when Ascend says it already holds it", () => {
    // Observed on staging 2026-09-17: /openApi/users answered hasMyinfo true,
    // so the credit call carried userId alone - and /openApi/apply/credit
    // returned `500: System error`. The two calls either side of it, both
    // carrying the full payload, succeeded. Sending it costs a larger request
    // and nothing else; not sending it costs the applicant their application.
    const outcome = decideIdentityOutcome({
      userId: "1426270128715821056",
      newCustomer: true,
      hasMyinfo: true,
    });

    expect(outcome).toMatchObject({ kind: "continue", creditCallUses: "myinfo" });
  });

  it.skip("sends only the userId once Ascend already holds MyInfo", () => {
    const outcome = decideIdentityOutcome({
      userId: "1426270128715821056",
      newCustomer: true,
      hasMyinfo: true,
    });

    // Saves sending an 8.6 KB payload Ascend already has.
    expect(outcome).toMatchObject({ kind: "continue", creditCallUses: "userId" });
  });
});

describe("decideSubmission", () => {
  it("offers Ascend's A-Card Limit, not the local engine's number", () => {
    const decision = decideSubmission({ ascend: PASSED });

    expect(decision).toMatchObject({ kind: "approved", aCardLimit: 8000 });
  });

  it("lets Ascend reject a Singpass applicant", () => {
    // The clamp this replaces forced every Singpass applicant to approval
    // with a $500 floor, so the Singpass path could not decline anyone. With
    // Ascend authoritative that clamp would override a genuine REJECT.
    const decision = decideSubmission({
      ascend: { ...PASSED, risk: { riskStatus: "REJECT", riskMsg: "Too much outstanding" }, creditScore: {} },
    });

    expect(decision).toMatchObject({ kind: "declined", destination: "/apply/pending" });
  });

  it("shows a failure state when Ascend gave no answer, never an offer", () => {
    // ADR-0001: the other external calls never block, but this one must.
    // Without Ascend there is no amount to show.
    const decision = decideSubmission({ ascend: null });

    expect(decision.kind).toBe("unavailable");
    expect(decision).not.toHaveProperty("aCardLimit");
  });
});

describe("decideAfterIncome", () => {
  // PENDING means two different things depending on which call answered it.
  // From apply/credit it means "no income on file, send me some", and the
  // applicant belongs on the upload page. From income/credit it means the
  // income has been taken and a human is looking - sending them back to the
  // upload page loops them onto documents they just submitted, which is what
  // happened on staging on 2026-09-18.
  const pending = {
    orderId: "1550205686196785152",
    userId: "1550194515653763072",
    newCustomer: true,
    risk: { riskStatus: "PENDING" as const },
    creditScore: {},
  };

  it("does not send an applicant back to upload what they just uploaded", () => {
    const outcome = decideAfterIncome(pending);

    expect(outcome.destination).not.toBe("/apply/verify-income");
  });

  it("puts them in the review queue instead", () => {
    expect(decideAfterIncome(pending)).toMatchObject({
      kind: "in_review",
      destination: "/apply/pending",
    });
  });

  it("still approves when Ascend approves", () => {
    const outcome = decideAfterIncome({
      ...pending,
      risk: { riskStatus: "PASS" as const },
      creditScore: { creditLimit: 8000, mlcbMaxLoanAmount: 12000 },
    });

    expect(outcome).toMatchObject({
      kind: "approved",
      destination: "/apply/approval",
      aCardLimit: 8000,
    });
  });

  it("still declines when Ascend rejects", () => {
    const outcome = decideAfterIncome({
      ...pending,
      risk: { riskStatus: "REJECT" as const, riskMsg: "Income below threshold" },
    });

    expect(outcome).toMatchObject({ kind: "declined", destination: "/apply/pending" });
  });
});
