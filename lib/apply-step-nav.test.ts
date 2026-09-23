import { describe, expect, it } from "vitest";

import { applyStepOrder, neighborApplySteps } from "./apply-step-nav";

describe("applyStepOrder", () => {
  it("does not put verify-income on the linear path", () => {
    // Ascend only asks for income when it returns PENDING, and an applicant
    // whose CPF or NOA data satisfies it never sees this step at all.
    expect(applyStepOrder()).not.toContain("verify");
  });

  it("goes straight from Singpass to review", () => {
    const order = applyStepOrder();
    expect(order[order.indexOf("singpass") + 1]).toBe("review");
  });
});

describe("neighborApplySteps", () => {
  it("gives verify-income nothing to go back to", () => {
    // Reached only after submit. The funnel's one-way gate never lets this
    // step navigate back to review, so a "prev: review" here was a dead
    // button - clicking it sent the browser to /apply/review, the server
    // guard caught it there and bounced it straight back, unexplained.
    expect(neighborApplySteps("verify")).toEqual({ prev: null, next: "approval" });
  });

  it("gives pending the same - nothing to go back to either", () => {
    // Same gate, same reasoning: pending is also only ever reached post-
    // submit, so it gets the same treatment as verify-income above.
    expect(neighborApplySteps("pending")).toEqual({ prev: null, next: "approval" });
  });
});
