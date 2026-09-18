import { describe, expect, it } from "vitest";

import { deriveBorrowerFields } from "./borrower-derive";

/** MyInfo's shape: almost everything is wrapped as {value}. */
const cpf = (months: string[], employer = "UOB BANK LTD") => ({
  history: months.map((m) => ({ month: { value: m }, employer: { value: employer } })),
});

describe("deriveBorrowerFields", () => {
  describe("employmentPeriod, from CPF history", () => {
    it("reads how long they have been with the current employer", () => {
      // 15 consecutive months at one employer is 1-2 years, and CPF says so
      // without anyone having to be asked.
      const months = Array.from({ length: 15 }, (_, i) =>
        `2025-${String(12 - (i % 12)).padStart(2, "0")}`);

      expect(deriveBorrowerFields({ cpfemployers: cpf(months) }).employmentPeriod)
        .toBe("1-2 YEARS");
    });

    it("counts only the current employer, not the whole history", () => {
      // Someone who changed jobs last month has been there one month, however
      // long the CPF record runs.
      const payload = {
        cpfemployers: {
          history: [
            { month: { value: "2026-08" }, employer: { value: "NEW CO PTE LTD" } },
            { month: { value: "2026-07" }, employer: { value: "OLD CO PTE LTD" } },
            { month: { value: "2026-06" }, employer: { value: "OLD CO PTE LTD" } },
          ],
        },
      };

      expect(deriveBorrowerFields(payload).employmentPeriod).toBe("1 MONTH");
    });

    it("falls back when CPF is unavailable, as it is for every pass holder", () => {
      const built = deriveBorrowerFields({ cpfemployers: { unavailable: true } });

      expect(built.employmentPeriod).toBe("JUST START WORKING, LESS THAN A MONTH");
    });
  });

  describe("wokingPosition, from occupation", () => {
    it("recognises a title that matches one of Ascend's", () => {
      expect(deriveBorrowerFields({ occupation: { value: "SUPERVISOR" } }).wokingPosition)
        .toBe("SUPERVISOR");
    });

    it("maps a manager to the manager option", () => {
      expect(deriveBorrowerFields({ occupation: { value: "ASSISTANT MANAGER" } }).wokingPosition)
        .toBe("MANAGER / ASSISTANT MANAGER");
    });

    it("maps a recognised profession to PROFESSIONAL", () => {
      expect(deriveBorrowerFields({ occupation: { value: "MANAGEMENT CONSULTANT" } }).wokingPosition)
        .toBe("PROFESSIONAL");
    });

    it("says OTHERS rather than guessing", () => {
      // A title we cannot place is honestly OTHERS. Guessing SENIOR MANAGER
      // because a word looked senior would feed a credit decision a fact
      // nobody established.
      expect(deriveBorrowerFields({ occupation: { value: "BOAT REPAIRER" } }).wokingPosition)
        .toBe("OTHERS");
      expect(deriveBorrowerFields({}).wokingPosition).toBe("OTHERS");
    });
  });

  describe("jobCategory", () => {
    it("is the documented catch-all, because MyInfo names no industry", () => {
      // MyInfo gives an employer's name, never its sector. Inferring an
      // industry from a company name would be a guess presented as a fact.
      expect(deriveBorrowerFields({ employment: { value: "IT CONSULTING LLP" } }).jobCategory)
        .toBe("ACTIVITIES NOT ADEQUATELY DEFINED");
    });
  });

  it("produces values Ascend accepts", async () => {
    const { buildBorrowerMyInfo } = await import("./borrower-info");
    const derived = deriveBorrowerFields({ occupation: { value: "SUPERVISOR" } });

    expect(() =>
      buildBorrowerMyInfo(
        { ...derived, employmentType: "EMPLOYED", bankruptcyDeclaration: "NOT BANKRUPTCY" },
        {},
      ),
    ).not.toThrow();
  });
});
