import { describe, expect, it } from "vitest";

import { incomeResultFrom } from "./income-result";

describe("incomeResultFrom", () => {
  it("reports the months that were read", () => {
    const result = incomeResultFrom({
      status: "usable",
      months: [
        { month: "2025-10", amount: 3800, employer: "MEP Enviro" },
        { month: "2025-09", amount: 3750, employer: "MEP Enviro" },
        { month: "2025-08", amount: 3700, employer: "MEP Enviro" },
      ],
    });

    expect(result.kind).toBe("read");
    if (result.kind !== "read") return;
    expect(result.months.map((m) => m.amount)).toEqual([3800, 3750, 3700]);
    expect(result.months[0]).toMatchObject({ month: "October", year: "2025" });
    expect(result.average).toBe(3750);
  });

  it("carries the ask through when a payslip is missing", () => {
    const result = incomeResultFrom({
      status: "needs_review",
      months: [{ month: "2025-10", amount: 3800, employer: "MEP Enviro" }],
      reason: "We have October 2025. Please add your September 2025 payslip.",
    });

    expect(result).toEqual({
      kind: "not_read",
      ask: "We have October 2025. Please add your September 2025 payslip.",
    });
  });

  it("carries the ask through when nothing was a payslip", () => {
    const result = incomeResultFrom({
      status: "unreadable",
      months: [],
      reason: "The only document provided is a bank letter, not a payslip.",
    });

    expect(result).toMatchObject({ kind: "not_read" });
  });

  it("never treats an empty read as success", () => {
    // Defensive: a "usable" with no months must not fall through to a screen
    // that then shows nothing as though it were read.
    const result = incomeResultFrom({ status: "usable", months: [] });

    expect(result.kind).toBe("not_read");
  });

  it("explains itself when the request failed outright", () => {
    const result = incomeResultFrom({ error: "We could not read those documents just now." });

    expect(result).toMatchObject({
      kind: "not_read",
      ask: "We could not read those documents just now.",
    });
  });

  it("falls back to a sentence rather than a status code", () => {
    // Whatever goes wrong, an applicant must never be shown "unreadable".
    const result = incomeResultFrom({ status: "needs_review", months: [] });

    expect(result.kind).toBe("not_read");
    if (result.kind !== "not_read") return;
    expect(result.ask).toMatch(/payslip/i);
    expect(result.ask).not.toMatch(/needs_review|unreadable/);
  });
});
