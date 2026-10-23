import { describe, expect, it } from "vitest";

import { pathAfterPlanChosen } from "./after-plan";

/**
 * Where a customer goes once they have chosen a plan. A custom plan used to end
 * on "Wait for our call", with nothing to book: of the customers who chose
 * Custom, none booked. Custom now goes straight to booking, and staff still see
 * the request in the note saved with it.
 *
 * Straight to booking, not through accept: the accept page prints the chosen
 * amount and what the customer will repay, and a custom amount can be well above
 * what Ascend approved (a request for $18,000 against a $2,500 limit). That would
 * read as an approval of an amount Ascend never gave.
 */
describe("where a customer goes after choosing a plan", () => {
  it("takes a standard plan to accept, carrying the amount", () => {
    expect(pathAfterPlanChosen({ planId: "lowest_instalment", amount: 1700 })).toBe("/apply/accept?amount=1700");
    expect(pathAfterPlanChosen({ planId: "average", amount: 900 })).toBe("/apply/accept?amount=900");
    expect(pathAfterPlanChosen({ planId: "lowest_interest", amount: 500 })).toBe("/apply/accept?amount=500");
  });

  it("takes a custom plan straight to booking, not to the wait-for-our-call page", () => {
    const path = pathAfterPlanChosen({ planId: "custom", amount: 18000 });

    expect(path).toBe("/apply/book");
    expect(path).not.toContain("custom-received");
  });

  it("does not carry a custom amount into the address", () => {
    expect(pathAfterPlanChosen({ planId: "custom", amount: 18000 })).not.toContain("18000");
  });
});
