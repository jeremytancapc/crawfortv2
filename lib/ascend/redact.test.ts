import { describe, expect, it } from "vitest";

import { redactAscendRequest } from "./redact";

describe("redactAscendRequest", () => {
  // The apply/credit request carries a whole MyInfo payload - NRIC, address,
  // CPF and NOA history. api_logs is read by support staff to work out why a
  // submission failed, which never requires seeing the applicant's income or
  // where they live.
  const SIGNED = {
    appId: "10001",
    timestamp: "1758000000000",
    nonce: "abc123",
    sign: "9F2C4E...",
    data: {
      desiredAmount: 5000,
      myinfo: {
        uinfin: "S1234567D",
        name: "TAN WEI MING",
        regadd: { block: "123", street: "BEDOK NORTH" },
        cpfcontributions: { history: [{ amount: 856 }, { amount: 856 }] },
        noahistory: { noas: [{ amount: 51000 }] },
      },
    },
  };

  it("keeps what identifies the call", () => {
    const redacted = redactAscendRequest(SIGNED);

    expect(redacted).toMatchObject({
      appId: "10001",
      timestamp: "1758000000000",
      nonce: "abc123",
    });
  });

  it("never carries a value out of the payload", () => {
    const serialised = JSON.stringify(redactAscendRequest(SIGNED));

    for (const secret of ["S1234567D", "TAN WEI MING", "BEDOK NORTH", "51000", "856"]) {
      expect(serialised).not.toContain(secret);
    }
  });

  it("says which fields were sent, so a missing one can be spotted", () => {
    const redacted = redactAscendRequest(SIGNED);

    expect(redacted.dataFields).toEqual(["desiredAmount", "myinfo"]);
    expect(redacted.myinfoFields).toEqual([
      "uinfin",
      "name",
      "regadd",
      "cpfcontributions",
      "noahistory",
    ]);
  });

  it("keeps the signature short - it identifies the call, it is not evidence", () => {
    const redacted = redactAscendRequest(SIGNED);

    expect(String(redacted.sign).length).toBeLessThanOrEqual(12);
  });

  it("copes with a request that carries no myinfo", () => {
    const redacted = redactAscendRequest({
      appId: "10001",
      timestamp: "1",
      nonce: "n",
      sign: "s",
      data: { userId: "123", orderId: "456" },
    });

    expect(redacted.dataFields).toEqual(["userId", "orderId"]);
    expect(redacted.myinfoFields).toBeUndefined();
  });
});

describe("borrowerMyInfo in the log", () => {
  const withBorrower = {
    appId: "10001", timestamp: "1", nonce: "n", sign: "s",
    data: {
      desiredAmount: 5000,
      myinfo: { uinfin: "S1234567D", name: "TAN WEI MING" },
      borrowerMyInfo: {
        employmentType: "EMPLOYED",
        employmentPeriod: "1 MONTH",
        wokingPosition: "OTHERS",
        jobCategory: "ACTIVITIES NOT ADEQUATELY DEFINED",
        bankruptcyDeclaration: "NOT BANKRUPTCY",
      },
    },
  };

  it("records it in full, so what was sent needs no reconstructing", () => {
    expect(redactAscendRequest(withBorrower).borrowerMyInfo).toEqual({
      employmentType: "EMPLOYED",
      employmentPeriod: "1 MONTH",
      wokingPosition: "OTHERS",
      jobCategory: "ACTIVITIES NOT ADEQUATELY DEFINED",
      bankruptcyDeclaration: "NOT BANKRUPTCY",
    });
  });

  it("still keeps the MyInfo payload to field names only", () => {
    const serialised = JSON.stringify(redactAscendRequest(withBorrower));

    expect(serialised).not.toContain("S1234567D");
    expect(serialised).not.toContain("TAN WEI MING");
  });

  it("drops the two borrower fields that are personal", () => {
    const built = redactAscendRequest({
      ...withBorrower,
      data: {
        ...withBorrower.data,
        borrowerMyInfo: {
          ...withBorrower.data.borrowerMyInfo,
          mailingAddress: "910 Tampines Street 91 #08-321",
          secondaryPhone: "97399245",
        },
      },
    });

    expect(built.borrowerMyInfo).not.toHaveProperty("mailingAddress");
    expect(built.borrowerMyInfo).not.toHaveProperty("secondaryPhone");
    expect(built.borrowerMyInfo).toHaveProperty("employmentType");
  });
});
