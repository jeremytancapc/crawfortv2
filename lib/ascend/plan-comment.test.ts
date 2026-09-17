import { describe, expect, it } from "vitest";

import { formatPlanComment } from "./plan-comment";

describe("formatPlanComment", () => {
  it("names the plan, the amount and the term", () => {
    expect(formatPlanComment({ planId: "SuperSaver", amount: 5000, tenure: 6 }))
      .toBe("Plan selected: SuperSaver | S$5,000 over 6 months");
  });

  it("says month, not months, for a one-month term", () => {
    expect(formatPlanComment({ planId: "Payday", amount: 800, tenure: 1 }))
      .toContain("over 1 month");
  });

  it("flags a custom offer, because it needs a person", () => {
    const comment = formatPlanComment({
      planId: "Custom", amount: 12000, tenure: 12, isCustomPlan: true,
    });
    expect(comment).toContain("CUSTOM OFFER - needs staff follow-up");
  });

  it("stands alone rather than assuming an earlier comment survived", () => {
    // Ascend has no endpoint that reads comments back, so whether a second
    // comment appends or overwrites is unconfirmed. Each carries everything.
    const comment = formatPlanComment({
      planId: "FlexiPay", amount: 3000, tenure: 12, monthlyInstalment: 291.67,
      additionalRequests: ["Call me first"],
    });
    expect(comment).toContain("FlexiPay");
    expect(comment).toContain("S$3,000");
    expect(comment).toContain("over 12 months");
    expect(comment).toContain("monthly S$292");
    expect(comment).toContain("requests: Call me first");
  });
});
