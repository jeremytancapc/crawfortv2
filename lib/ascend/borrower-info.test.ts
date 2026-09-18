import { describe, expect, it } from "vitest";

import {
  BANKRUPTCY_OPTIONS,
  EMPLOYMENT_PERIOD_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  JOB_CATEGORY_OPTIONS,
  WORKING_POSITION_OPTIONS,
  ascendBankruptcy,
  buildBorrowerMyInfo,
} from "./borrower-info";

const ANSWERS = {
  employmentType: "EMPLOYED",
  employmentPeriod: "1-2 YEARS",
  wokingPosition: "SUPERVISOR",
  jobCategory: "AGRICULTURE AND FISHING",
  bankruptcyDeclaration: "NOT BANKRUPTCY",
} as const;

describe("borrowerMyInfo", () => {
  it("carries the five answers Ascend requires", () => {
    expect(buildBorrowerMyInfo(ANSWERS, {})).toMatchObject(ANSWERS);
  });

  it("spells the position field the way Ascend does", () => {
    // Their spec says `wokingPosition`, missing the r. Correcting it here
    // would send a field they do not read, and the mandatory one would be
    // absent - which is the sort of thing that fails silently.
    const built = buildBorrowerMyInfo(ANSWERS, {});

    expect(Object.keys(built)).toContain("wokingPosition");
    expect(Object.keys(built)).not.toContain("workingPosition");
  });

  it("reformats the pass expiry date from MyInfo to dd/MM/yyyy", () => {
    const built = buildBorrowerMyInfo(ANSWERS, { passExpiryDate: "2030-04-04" });

    expect(built.passExpiryDate).toBe("04/04/2030");
  });

  it("leaves out an optional field rather than sending an empty one", () => {
    const built = buildBorrowerMyInfo(ANSWERS, { passExpiryDate: "", officeNumber: "" });

    expect(built).not.toHaveProperty("passExpiryDate");
    expect(built).not.toHaveProperty("officeNumber");
  });

  it("passes through what is offered", () => {
    const built = buildBorrowerMyInfo(ANSWERS, {
      officeNumber: "62255555",
      secondaryPhone: "91234567",
      mailingAddress: "288A Jurong East Street 21 #08-367 S601288",
    });

    expect(built).toMatchObject({
      officeNumber: "62255555",
      secondaryPhone: "91234567",
      mailingAddress: "288A Jurong East Street 21 #08-367 S601288",
    });
  });

  it("refuses an answer that is not one of Ascend's values", () => {
    // These are closed lists. A value off the list is rejected by Ascend, and
    // finding that out at submit - after Singpass, after the credit pull - is
    // the worst moment to find it.
    expect(() =>
      buildBorrowerMyInfo({ ...ANSWERS, employmentType: "FULL TIME" as never }, {}),
    ).toThrow(/employmentType/);
  });

  it("offers every option Ascend documents", () => {
    expect(EMPLOYMENT_TYPE_OPTIONS).toHaveLength(7);
    expect(EMPLOYMENT_PERIOD_OPTIONS).toHaveLength(14);
    expect(WORKING_POSITION_OPTIONS).toHaveLength(9);
    expect(JOB_CATEGORY_OPTIONS).toHaveLength(22);
    expect(BANKRUPTCY_OPTIONS).toHaveLength(6);
  });

  it("puts the commonest answers first, not alphabetically", () => {
    // A borrower applying online is overwhelmingly an employee who is not a
    // bankrupt; making them scroll past six other states first is a cost paid
    // by everyone to spell a rare case slightly faster.
    expect(EMPLOYMENT_TYPE_OPTIONS[0]).toBe("EMPLOYED");
    expect(BANKRUPTCY_OPTIONS[0]).toBe("NOT BANKRUPTCY");
  });
});

describe("mapping our bankruptcy answer to Ascend's", () => {
  it("maps a clean declaration straight across", () => {
    expect(ascendBankruptcy("clear")).toBe("NOT BANKRUPTCY");
  });

  it("maps an undischarged bankrupt straight across", () => {
    expect(ascendBankruptcy("active")).toBe("Bankrupted");
  });

  it("takes the most cautious reading of a discharge we did not date", () => {
    // Our form asks one question - discharged under five years ago - and
    // Ascend splits that into three bands. Without the date we cannot say
    // which, and the shortest is the only one that cannot understate how
    // recent it was. A lender may lend on a cautious reading; it should never
    // lend on an optimistic one.
    expect(ascendBankruptcy("discharged_lt5")).toBe("Bankruptcy Discharge < 1 year");
  });

  it("refuses to invent an answer when none was given", () => {
    // Declaring "not bankrupt" for someone who declared nothing would put a
    // statement in their application that they never made.
    expect(() => ascendBankruptcy(null)).toThrow(/declaration/i);
    expect(() => ascendBankruptcy("")).toThrow(/declaration/i);
  });

  it("produces a value Ascend accepts", () => {
    for (const ours of ["clear", "discharged_lt5", "active"] as const) {
      expect(BANKRUPTCY_OPTIONS).toContain(ascendBankruptcy(ours));
    }
  });
});
