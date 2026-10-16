import { describe, expect, it } from "vitest";

import { ascendOrderReviewLink } from "./review-link";

describe("ascendOrderReviewLink", () => {
  it("is the link production AirConnect already holds for 869 pending leads", () => {
    // Read from AirConnect's production database on 2026-10-16: every one of
    // its verification links has exactly this shape.
    expect(ascendOrderReviewLink("1560591551355564032", "https://api-admin-ascend.crawfort.com")).toBe(
      "https://api-admin-ascend.crawfort.com/order/pending/notify?orderId=1560591551355564032",
    );
  });

  it("does not double the slash when the base address ends with one", () => {
    expect(ascendOrderReviewLink("1560591551355564032", "https://api-mms.newtime.top//")).toBe(
      "https://api-mms.newtime.top/order/pending/notify?orderId=1560591551355564032",
    );
  });

  it("reads the base address from ASCEND_BASE_URL when none is given", () => {
    const before = process.env.ASCEND_BASE_URL;
    process.env.ASCEND_BASE_URL = "https://api-admin-ascend.crawfort.com";
    try {
      expect(ascendOrderReviewLink("1560591551355564032")).toBe(
        "https://api-admin-ascend.crawfort.com/order/pending/notify?orderId=1560591551355564032",
      );
    } finally {
      if (before === undefined) delete process.env.ASCEND_BASE_URL;
      else process.env.ASCEND_BASE_URL = before;
    }
  });

  it("gives nothing when there is no base address, so no half-made link is ever sent", () => {
    expect(ascendOrderReviewLink("1560591551355564032", "")).toBeNull();
    expect(ascendOrderReviewLink("1560591551355564032", undefined)).toBeNull();
  });

  it("gives nothing for an order id that is not a plain number", () => {
    for (const bad of ["", "  ", "abc", "15605&x=1", "1560 5915", "../../x"]) {
      expect(ascendOrderReviewLink(bad, "https://api-admin-ascend.crawfort.com"), bad).toBeNull();
    }
  });
});
