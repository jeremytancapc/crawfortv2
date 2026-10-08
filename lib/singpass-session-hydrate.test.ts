import { describe, expect, it } from "vitest";

import { hydrateSingpassReviewSession } from "./singpass-session-hydrate";
import type { CpfContribution, NoaRecord } from "./loan-form";

/**
 * The review page shows the applicant their own Myinfo. It must show exactly
 * what Singpass returned - no fixture, no filled-in rows, and no assumption
 * that a missing field "should" hold anything.
 *
 * These pass the already-loaded records in, so the test never touches cookies
 * or the database - it pins the one rule that matters: hydrate returns the
 * real records untouched and fabricates nothing.
 */

const noa: NoaRecord = {
  yearOfAssessment: "2025",
  type: "ORIGINAL",
  taxClearance: "N",
  assessableIncome: 350000,
  employmentIncome: 350000,
  tradeIncome: 0,
  rentIncome: 0,
  interestIncome: 0,
};

const cpf: CpfContribution = {
  month: "2026-09",
  amount: 2000,
  employer: "ACME PTE LTD",
  paidOn: "2026-09-01",
};

describe("hydrateSingpassReviewSession shows only what Singpass returned", () => {
  it("keeps real CPF and NOA exactly as retrieved", async () => {
    const data = { cpfContributions: [cpf], noaHistory: [noa], dob: "1990-01-01" };
    const result = await hydrateSingpassReviewSession(data, { data, fromStore: true });

    expect(result?.cpfContributions).toEqual([cpf]);
    expect(result?.noaHistory).toEqual([noa]);
  });

  it("leaves CPF empty for a foreigner who has NOA but no CPF - never fabricates it", async () => {
    const data = { cpfContributions: [], noaHistory: [noa], dob: "1990-01-01" };
    const result = await hydrateSingpassReviewSession(data, { data, fromStore: true });

    expect(result?.cpfContributions).toEqual([]);
    // The real NOA survives rather than being replaced by a fixture.
    expect(result?.noaHistory).toEqual([noa]);
  });

  it("leaves NOA empty when only CPF was retrieved", async () => {
    const data = { cpfContributions: [cpf], noaHistory: [], dob: "1990-01-01" };
    const result = await hydrateSingpassReviewSession(data, { data, fromStore: true });

    expect(result?.noaHistory).toEqual([]);
    expect(result?.cpfContributions).toEqual([cpf]);
  });

  it("fabricates nothing when neither was retrieved", async () => {
    const data = { cpfContributions: [], noaHistory: [], dob: "" };
    const result = await hydrateSingpassReviewSession(data, { data, fromStore: false });

    expect(result?.cpfContributions).toEqual([]);
    expect(result?.noaHistory).toEqual([]);
  });
});
