import { describe, expect, it } from "vitest";

import { improveLimitTips } from "./income-tips";

describe("improveLimitTips", () => {
  it("asks for a bank statement when only payslips were read", () => {
    const tips = improveLimitTips("NON_PANEL_PAYSLIP");
    expect(tips).toHaveLength(1);
    expect(tips[0].body).toContain("bank statement");
    expect(tips[0].body).toContain("can increase");
  });

  it("does not ask for a bank statement they already uploaded", () => {
    const tips = improveLimitTips("NON_PANEL_PAYSLIP", [
      "NON_PANEL_PAYSLIP",
      "BANK_STATEMENT_OTHER_INCOME",
    ]);
    expect(tips).toHaveLength(1);
    expect(tips[0].title).toContain("match your pay");
    expect(tips[0].body).not.toMatch(/^Add a bank statement/);
  });

  it("asks for payslips when only a bank statement was read", () => {
    const tips = improveLimitTips("BANK_STATEMENT_OTHER_INCOME");
    expect(tips[0].body).toContain("payslip");
  });

  it("has nothing to add once the payslips are confirmed by the bank", () => {
    expect(improveLimitTips("PANEL_PAYSLIP")).toEqual([]);
  });

  it("never promises a limit", () => {
    const cases: Array<[string, string[]]> = [
      ["NON_PANEL_PAYSLIP", []],
      ["NON_PANEL_PAYSLIP", ["BANK_STATEMENT_OTHER_INCOME"]],
      ["BANK_STATEMENT_OTHER_INCOME", []],
    ];
    for (const [type, fileTypes] of cases) {
      for (const tip of improveLimitTips(type, fileTypes)) {
        expect(tip.body).not.toMatch(/\bwill\b/i);
      }
    }
  });
});
