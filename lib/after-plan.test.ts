import { describe, expect, it } from "vitest";

import { pathAfterPlanChosen } from "./after-plan";

/**
 * Where a customer goes once they have chosen a plan. Every plan, Custom
 * included, goes to the accept page carrying the amount they picked, then on to
 * booking. Custom used to end on "Wait for our call", with nothing to book: of
 * the customers who chose it, none booked.
 */
describe("where a customer goes after choosing a plan", () => {
  it("takes a standard plan to accept, carrying the amount", () => {
    expect(pathAfterPlanChosen({ planId: "lowest_instalment", amount: 1700 })).toBe("/apply/accept?amount=1700");
    expect(pathAfterPlanChosen({ planId: "average", amount: 900 })).toBe("/apply/accept?amount=900");
    expect(pathAfterPlanChosen({ planId: "lowest_interest", amount: 500 })).toBe("/apply/accept?amount=500");
  });

  it("takes a custom plan the same way, with the amount the customer picked", () => {
    const path = pathAfterPlanChosen({ planId: "custom", amount: 18000 });

    expect(path).toBe("/apply/accept?amount=18000");
    expect(path).not.toContain("custom-received");
  });
});
