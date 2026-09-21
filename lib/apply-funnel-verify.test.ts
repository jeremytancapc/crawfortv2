import { describe, expect, it } from "vitest";

import {
  getFunnelRedirectUrl,
  resolveApplyFunnelStage,
  type ApplyFunnelContext,
} from "./apply-funnel";

/**
 * The income step moved to after submit, reached only when Ascend answered
 * PENDING. The funnel lock was switched off before that happened, so the
 * stage machine never learned about it - and turning the lock back on without
 * this would redirect a pending applicant off the very page they were sent to.
 */
const LEAD = "431db450-5695-4bc5-9556-cfcd4168c73c";

function ctx(over: Partial<ApplyFunnelContext> = {}): ApplyFunnelContext {
  return {
    pathname: "/apply/verify-income",
    session: { leadId: LEAD, amount: 5000, tenure: 12 },
    hasApplyGate: true,
    hasReviewGate: true,
    hasIncomeGate: true,
    approvalOffer: null,
    hasBookingConfirm: false,
    queryLeadId: null,
    ...over,
  };
}

describe("the income step as a funnel stage", () => {
  it("puts an applicant asked for income on the income page", () => {
    expect(resolveApplyFunnelStage(ctx())).toBe("verify");
  });

  it("lets them stay there", () => {
    expect(getFunnelRedirectUrl(ctx())).toBeNull();
  });

  it("keeps them there if they wander to the pending page", () => {
    // Ascend asked for income; pending is not where that is resolved.
    expect(getFunnelRedirectUrl(ctx({ pathname: "/apply/pending" }))).toBe(
      "/apply/verify-income",
    );
  });

  it("sends them back if they try to reopen the review page", () => {
    // The classic back-button case: review has already been submitted.
    expect(getFunnelRedirectUrl(ctx({ pathname: "/apply/review" }))).toBe(
      "/apply/verify-income",
    );
  });

  it("keeps the /v2 applicant inside /v2", () => {
    expect(getFunnelRedirectUrl(ctx({ pathname: "/v2/apply/review" }))).toBe(
      "/v2/apply/verify-income",
    );
  });

  it("does not claim the stage once income has been accepted", () => {
    // The gate is cleared on submission, so the applicant moves on normally.
    expect(resolveApplyFunnelStage(ctx({ hasIncomeGate: false }))).not.toBe("verify");
  });

  it("does not strand someone with no application at all", () => {
    const stage = resolveApplyFunnelStage(
      ctx({ session: null, hasIncomeGate: false, hasApplyGate: false, hasReviewGate: false }),
    );

    expect(stage).toBe("landing");
  });

  it("never sends an approved applicant to the income page", () => {
    const approved = ctx({
      pathname: "/apply/approval",
      hasIncomeGate: true,
      approvalOffer: { leadId: LEAD, approvedLoanAmount: 8000 } as never,
    });

    expect(resolveApplyFunnelStage(approved)).not.toBe("verify");
  });
});

describe("a draft lead is not a submission", () => {
  // `activate` writes leadId into the session as soon as MyInfo returns, so an
  // applicant has one before they have submitted anything. The stage machine
  // predates that and read any leadId as post-submit, which sent people
  // straight from MyInfo to the pending page - never reaching review, never
  // being assessed. Applicant fba5e630 on staging: in_progress, no order, no
  // Ascend call at all.
  const draft = (over: Partial<ApplyFunnelContext> = {}): ApplyFunnelContext => ({
    pathname: "/apply/review",
    // What activate leaves behind: MyInfo merged, and a draft leadId.
    session: {
      leadId: LEAD,
      amount: 5000,
      tenure: 12,
      authMethod: "singpass",
      nric: "S1234567D",
      fullName: "TAN WEI MING",
    },
    hasApplyGate: true,
    hasReviewGate: false,
    hasIncomeGate: false,
    approvalOffer: null,
    hasBookingConfirm: false,
    queryLeadId: null,
    ...over,
  });

  it("sends a freshly identified applicant to review, not to pending", () => {
    expect(resolveApplyFunnelStage(draft())).toBe("review");
  });

  it("leaves them on the review page", () => {
    expect(getFunnelRedirectUrl(draft())).toBeNull();
  });

  it("still sends them to pending once they have actually submitted", () => {
    expect(resolveApplyFunnelStage(draft({ hasReviewGate: true, pathname: "/apply/pending" }))).toBe(
      "pending",
    );
  });

  it("never evicts anyone from the income page while they have an application", () => {
    // Belt and braces for the cookie: a session that predates the income gate,
    // a cleared cookie or a second device must not push someone off the one
    // screen that can move them forward.
    expect(
      getFunnelRedirectUrl(draft({ pathname: "/apply/verify-income", hasIncomeGate: false })),
    ).toBeNull();
  });
});

describe("the staging bad-case screens", () => {
  // Written while the funnel lock was a no-op, so re-enabling it made all
  // three unreachable. They render nothing about the applicant and are dead
  // ends by design, so the lock has nothing to protect and lets them be.
  const visitor = (pathname: string): ApplyFunnelContext => ({
    pathname,
    session: null,
    hasApplyGate: false,
    hasReviewGate: false,
    hasIncomeGate: false,
    approvalOffer: null,
    hasBookingConfirm: false,
    queryLeadId: null,
  });

  it.each([
    "/apply/pending-review",
    "/apply/rejected",
    "/apply/existing-customer",
  ])("lets a visitor reach %s", (path) => {
    expect(getFunnelRedirectUrl(visitor(path))).toBeNull();
  });

  it("keeps the /v2 applicant inside /v2", () => {
    expect(getFunnelRedirectUrl(visitor("/v2/apply/rejected"))).toBeNull();
  });

  it("still guards the real funnel pages", () => {
    // The allowance is for these three screens, not a hole in the lock.
    expect(getFunnelRedirectUrl(visitor("/apply/approval"))).not.toBeNull();
    expect(getFunnelRedirectUrl(visitor("/apply/review"))).not.toBeNull();
  });
});
