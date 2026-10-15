import { describe, expect, it } from "vitest";

import { grossUpSalary } from "./income-cpf";

const TODAY = new Date(2026, 9, 6);
const citizen = (dob: string) => ({ dob, paysCpf: true });

describe("grossUpSalary", () => {
  it("puts back the 20% a young employee's CPF takes: 3,040 is 3,800", () => {
    expect(grossUpSalary(3040, citizen("1990-05-01"), TODAY)).toBe(3800);
  });

  it("uses the lower rate of an older employee", () => {
    // 58: 15%. 3,400 / 0.85 = 4,000.
    expect(grossUpSalary(3400, citizen("1968-01-01"), TODAY)).toBe(4000);
    // 72: 5%. 3,800 / 0.95 = 4,000.
    expect(grossUpSalary(3800, citizen("1954-01-01"), TODAY)).toBe(4000);
  });

  it("stops at the wage ceiling, where CPF stops growing", () => {
    // Pay of 10,000 under 55: CPF is 20% of 8,000 = 1,600, so 8,400 arrives.
    expect(grossUpSalary(8400, citizen("1990-05-01"), TODAY)).toBe(10000);
  });

  it("leaves the deposit alone when there is no CPF to put back", () => {
    expect(grossUpSalary(3040, { dob: "1990-05-01", paysCpf: false }, TODAY)).toBe(3040);
    expect(grossUpSalary(3040, undefined, TODAY)).toBe(3040);
    expect(grossUpSalary(3040, citizen(""), TODAY)).toBe(3040);
  });
});
