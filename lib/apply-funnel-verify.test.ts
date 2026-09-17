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
