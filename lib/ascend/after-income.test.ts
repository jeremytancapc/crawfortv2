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

describe("creditAfterIncome - a PASS whose limit has not arrived yet", () => {
  // Observed 2026-10-09 (order 1558084373801472000): income/credit answered
  // PASS with creditScore {}, and query/credit moments later carried
  // creditLimit 700, level D. Reading the first answer as final sent an
  // approved applicant to the pending page.
  const passNoLimit = () => result({ risk: { riskStatus: "PASS" }, creditScore: {} });
  const passWithLimit = () =>
    result({ risk: { riskStatus: "PASS" }, creditScore: { creditLimit: 700, creditLevel: "D" } });
  const noWait = () => Promise.resolve();

  it("asks again, and returns the limit once it is there", async () => {
    const query = vi.fn().mockResolvedValue(passWithLimit());

    const out = await creditAfterIncome(ORDER, passNoLimit(), { query, wait: noWait });

    expect(query).toHaveBeenCalledTimes(1);
    expect(out.creditScore.creditLimit).toBe(700);
  });

  it("keeps asking while the limit is still missing", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(passNoLimit())
      .mockResolvedValueOnce(passNoLimit())
      .mockResolvedValueOnce(passWithLimit());

    const out = await creditAfterIncome(ORDER, passNoLimit(), { query, wait: noWait });

    expect(query).toHaveBeenCalledTimes(3);
    expect(out.creditScore.creditLimit).toBe(700);
  });

  it("gives up after a few tries and returns the PASS as it stands", async () => {
    const query = vi.fn().mockResolvedValue(passNoLimit());

    const out = await creditAfterIncome(ORDER, passNoLimit(), { query, wait: noWait });

    expect(query.mock.calls.length).toBeLessThanOrEqual(5);
    expect(out.risk.riskStatus).toBe("PASS");
    expect(out.creditScore.creditLimit).toBeFalsy();
  });

  it("waits between tries rather than asking back to back", async () => {
    const waits: number[] = [];
    const query = vi.fn().mockResolvedValue(passNoLimit());

    await creditAfterIncome(ORDER, passNoLimit(), {
      query,
      wait: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });

    expect(waits.length).toBeGreaterThan(0);
    expect(waits.every((ms) => ms >= 1000)).toBe(true);
  });

  it("does not ask when the PASS already carries its limit", async () => {
    const query = vi.fn();

    const out = await creditAfterIncome(ORDER, passWithLimit(), { query, wait: noWait });

    expect(query).not.toHaveBeenCalled();
    expect(out.creditScore.creditLimit).toBe(700);
  });

  it("keeps the PASS it has when a later ask fails", async () => {
    const query = vi.fn().mockRejectedValue(new Error("timeout"));
    const submitted = passNoLimit();

    const out = await creditAfterIncome(ORDER, submitted, { query, wait: noWait });

    expect(out).toBe(submitted);
  });

  it("does not turn a REJECT into anything else", async () => {
    const query = vi.fn();
    const rejected = result({ risk: { riskStatus: "REJECT" } });

    expect(await creditAfterIncome(ORDER, rejected, { query, wait: noWait })).toBe(rejected);
    expect(query).not.toHaveBeenCalled();
  });
});
