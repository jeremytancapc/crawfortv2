import { describe, expect, it } from "vitest";

import { improveLimitTips } from "./income-tips";

describe("improveLimitTips", () => {
  it("asks for a bank statement when only payslips were read", () => {
    const tips = improveLimitTips("NON_PANEL_PAYSLIP");
    expect(tips).toHaveLength(1);
    expect(tips[0].body).toContain("bank statement");
    expect(tips[0].body).toContain("can increase");
  });

  it("asks for payslips when only a bank statement was read", () => {
    const tips = improveLimitTips("BANK_STATEMENT_OTHER_INCOME");
    expect(tips[0].body).toContain("payslip");
  });

  it("has nothing to add once the payslips are confirmed by the bank", () => {
    expect(improveLimitTips("PANEL_PAYSLIP")).toEqual([]);
  });

  it("never promises a limit", () => {
    for (const type of ["NON_PANEL_PAYSLIP", "BANK_STATEMENT_OTHER_INCOME"]) {
      for (const tip of improveLimitTips(type)) {
        expect(tip.body).not.toMatch(/\bwill\b/i);
      }
    }
  });
});
