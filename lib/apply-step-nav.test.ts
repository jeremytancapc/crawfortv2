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
  it("treats verify-income as a branch off review, like pending", () => {
    // Reached from submit when Ascend says PENDING, and rejoining the funnel
    // at approval once the payslip figures have been re-scored.
    expect(neighborApplySteps("verify")).toEqual({ prev: "review", next: "approval" });
  });
});
