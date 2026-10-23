import { describe, expect, it } from "vitest";

import { isOfferTenure } from "./offer-plans";

/**
 * A custom plan only lets the customer pick how many months to repay over; the
 * amount stays the one they already entered. The months are held to the same
 * 1 to 12 the standard plans sit inside (3, 6 and 12).
 */
describe("isOfferTenure", () => {
  it("accepts a whole number of months from 1 to 12", () => {
    for (const months of [1, 2, 3, 6, 11, 12]) expect(isOfferTenure(months)).toBe(true);
  });

  it("refuses zero, negative, over 12, fractions and non-numbers", () => {
    for (const months of [0, -1, 13, 24, 2.5, Number.NaN, "6", null, undefined]) {
      expect(isOfferTenure(months)).toBe(false);
    }
  });
});
