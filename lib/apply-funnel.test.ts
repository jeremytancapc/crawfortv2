import { describe, expect, it } from "vitest";

import { resolveApplyFunnelStage, type ApplyFunnelContext } from "./apply-funnel";

const baseCtx: ApplyFunnelContext = {
  pathname: "/apply/approval",
  session: { leadId: "lead-1", authMethod: "singpass", amount: 5000, nric: "S1234567A", fullName: "Test" },
  hasApplyGate: true,
  hasReviewGate: false,
  hasIncomeGate: false,
  approvalOffer: null,
  hasBookingConfirm: false,
  queryLeadId: null,
};

describe("resolveApplyFunnelStage", () => {
  it("resolves approved once the offer cookie carries a real amount", () => {
    // /api/apply/income used to clear income_gate on every outcome without
    // setting review_gate or the approval offer for "approved" - so an
    // applicant Ascend just approved via income had nothing marking them as
    // ever having submitted, and this resolved to "review" instead,
    // bouncing them away from their own offer. Fixed in /api/apply/income.
    const ctx: ApplyFunnelContext = {
      ...baseCtx,
      approvalOffer: {
        leadId: "lead-1",
        approvedLoanAmount: 3500,
        verifiedMonthlyIncome: 4000,
        incomeSource: "noa",
        amount: 3500,
      },
    };

    expect(resolveApplyFunnelStage(ctx)).toBe("approval");
  });

  it("falls back to review when nothing marks the applicant as having submitted", () => {
    // The bug, reproduced directly: leadId is present, but none of
    // hasReviewGate / hasIncomeGate / approvalOffer / hasBookingConfirm are
    // set, so hasSubmitted() is false and a leadId alone is not enough.
    expect(resolveApplyFunnelStage(baseCtx)).toBe("review");
  });

  it("resolves verify while the income gate is set, regardless of approval state", () => {
    const ctx: ApplyFunnelContext = { ...baseCtx, hasIncomeGate: true };
    expect(resolveApplyFunnelStage(ctx)).toBe("verify");
  });
});
