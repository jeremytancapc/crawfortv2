import { describe, expect, it } from "vitest";

import { describeMyinfoPayload, MYINFO_FIELDS_CONSUMED } from "./myinfo-diagnostics";
import mockPayload from "./mock-singpass-payload.json";

const LEGACY = mockPayload.myinfo as Record<string, unknown>;
const FAPI2 = {
  iss: "https://stg-id.singpass.gov.sg/fapi",
  sub: "881ad2ea-0128-4275-9220-dd7bc9f1060e",
  person_info: LEGACY,
};

describe("describeMyinfoPayload", () => {
  it("names the shape it received", () => {
    expect(describeMyinfoPayload(FAPI2).shape).toBe("fapi2");
    expect(describeMyinfoPayload(LEGACY).shape).toBe("legacy");
    expect(describeMyinfoPayload({ nothing: "useful" }).shape).toBe("unknown");
  });

  it("reports nothing missing for a complete payload", () => {
    expect(describeMyinfoPayload(FAPI2).missing).toEqual([]);
    expect(describeMyinfoPayload(FAPI2).usable).toBe(true);
  });

  it("names which expected fields were absent", () => {
    const { cpfcontributions: _cpf, noahistory: _noa, ...rest } = LEGACY;
    const partial = describeMyinfoPayload(rest);

    // The two that decide PASS versus PENDING. Losing them turns every
    // applicant into a payslip upload, which is worth a distinct signal.
    expect(partial.missing).toContain("cpfcontributions");
    expect(partial.missing).toContain("noahistory");
  });

  it("flags a payload that maps to nothing at all", () => {
    // The shape change that caused this: a FAPI 2.0 envelope read as if it
    // were legacy yields no fields, no error, and a blank application.
    const broken = describeMyinfoPayload({ person_info: { unexpected: true } });

    expect(broken.usable).toBe(false);
    expect(broken.present).toEqual([]);
  });

  it("carries no personal data, only field names", () => {
    const described = describeMyinfoPayload(FAPI2);
    const serialised = JSON.stringify(described);

    // This goes into a diagnostics row support can read. The NRIC, the name
    // and the address must not travel with it.
    expect(serialised).not.toContain("S7790721A");
    expect(serialised).not.toContain("FELICIA");
    expect(serialised).not.toContain("JURONG");
  });

  it("knows which fields the funnel actually consumes", () => {
    expect(MYINFO_FIELDS_CONSUMED).toContain("uinfin");
    expect(MYINFO_FIELDS_CONSUMED).toHaveLength(10);
  });
});
