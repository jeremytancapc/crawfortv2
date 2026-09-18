import { describe, expect, it, vi } from "vitest";

import { creditAfterIncome } from "./after-income";
import type { AscendCreditResult } from "./client";

const ORDER = "1550205686196785152";

function result(over: Partial<AscendCreditResult> = {}): AscendCreditResult {
  return {
    orderId: ORDER,
    userId: "1550194515653763072",
    newCustomer: true,
    risk: { riskStatus: "PENDING" },
    creditScore: {},
    ...over,
  } as AscendCreditResult;
}

describe("creditAfterIncome", () => {
  it("re-asks Ascend when the submission came back pending", async () => {
    // income/credit answers immediately; the decision can settle after it.
    const query = vi.fn().mockResolvedValue(
      result({ risk: { riskStatus: "PASS" }, creditScore: { creditLimit: 8000 } }),
    );

    const out = await creditAfterIncome(ORDER, result(), { query });

    expect(query).toHaveBeenCalledWith({ orderId: ORDER }, expect.anything());
    expect(out.risk.riskStatus).toBe("PASS");
  });

  it("does not re-ask when Ascend already decided", async () => {
    const query = vi.fn();
    const decided = result({ risk: { riskStatus: "REJECT" } });

    expect(await creditAfterIncome(ORDER, decided, { query })).toBe(decided);
    expect(query).not.toHaveBeenCalled();
  });

  it("keeps the pending answer when the re-ask fails", async () => {
    // A failed query must never be read as progress. Pending is the safe
    // answer: the applicant waits for a human rather than being shown an
    // offer nobody made.
    const query = vi.fn().mockRejectedValue(new Error("404 The Resource does not exist"));
    const submitted = result();

    const out = await creditAfterIncome(ORDER, submitted, { query });

    expect(out).toBe(submitted);
    expect(out.risk.riskStatus).toBe("PENDING");
  });

  it("keeps the pending answer when the re-ask is still pending", async () => {
    const query = vi.fn().mockResolvedValue(result());

    expect((await creditAfterIncome(ORDER, result(), { query })).risk.riskStatus).toBe("PENDING");
  });

  it("never turns a pending order into an offer without a credit limit", async () => {
    // A PASS naming no limit is not an approval, and must not become one just
    // because it arrived from the second call rather than the first.
    const query = vi.fn().mockResolvedValue(result({ risk: { riskStatus: "PASS" }, creditScore: {} }));

    const out = await creditAfterIncome(ORDER, result(), { query });

    expect(out.creditScore.creditLimit).toBeFalsy();
  });
});
