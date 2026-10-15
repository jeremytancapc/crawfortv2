import { describe, expect, it } from "vitest";

import { buildMyInfoPatch, myinfoAscendPayload,
  myinfoPersonData } from "./myinfo";
import mockPayload from "./mock-singpass-payload.json";

const LEGACY = mockPayload.myinfo as Record<string, unknown>;

/**
 * The same person as FAPI 2.0 returns them: person data nested under
 * `person_info`, a bare-UUID `sub`, and an issuer ending in /fapi.
 */
const FAPI2 = {
  iss: "https://stg-id.singpass.gov.sg/fapi",
  sub: "881ad2ea-0128-4275-9220-dd7bc9f1060e",
  aud: "ZOy3c3EYVNXvk7kM48pOnfW2jQbMqrCp",
  iat: 1746678089,
  person_info: LEGACY,
};

describe("buildMyInfoPatch", () => {
  it("maps the legacy flat payload", () => {
    const patch = buildMyInfoPatch(LEGACY);

    expect(patch.nric).toBe("S7790721A");
    expect(patch.fullName).toBe("FELICIA TAN WEI LIN");
  });

  it("maps a FAPI 2.0 payload, where the person sits under person_info", () => {
    // Without unwrapping, every field reads undefined and the applicant gets
    // a blank application with nothing raising an error - the funnel carries
    // on with empty strings.
    const patch = buildMyInfoPatch(FAPI2);

    expect(patch.nric).toBe("S7790721A");
    expect(patch.fullName).toBe("FELICIA TAN WEI LIN");
  });

  it("reads income out of a FAPI 2.0 payload too", () => {
    // CPF and NOA decide whether Ascend answers PASS or PENDING, so losing
    // them turns every applicant into a payslip upload.
    const patch = buildMyInfoPatch(FAPI2);

    expect(patch.cpfContributions?.length).toBeGreaterThan(0);
    expect(patch.noaHistory?.length).toBeGreaterThan(0);
  });

  it("survives an unrecognised shape without throwing", () => {
    // authMethod is set unconditionally: reaching this mapper at all means
    // the applicant came through Singpass, whatever the payload turned out
    // to contain.
    expect(buildMyInfoPatch({ unexpected: true })).toEqual({ authMethod: "singpass" });
  });
});

describe("myinfoPersonData", () => {
  it("unwraps a FAPI 2.0 payload to the person", () => {
    expect(myinfoPersonData(FAPI2)).toBe(LEGACY);
  });

  it("returns a legacy payload unchanged", () => {
    expect(myinfoPersonData(LEGACY)).toBe(LEGACY);
  });

  it("drops the OIDC envelope, which is not part of the person", () => {
    // Ascend's /openApi/apply/credit was verified against the flat shape.
    // Forwarding the envelope would hand it sub, iss and aud where it looks
    // for uinfin.
    const person = myinfoPersonData(FAPI2);

    expect(person).not.toHaveProperty("person_info");
    expect(person).toHaveProperty("uinfin");
  });
});

describe("the payload Ascend receives", () => {
  // FAPI 2.0 nests the person under `person_info` and keeps the JWT claims
  // beside it. The legacy shape Ascend was built against is flat: the person's
  // fields at the top level, alongside iss, sub, aud and iat.
  const FAPI = {
    iss: "https://stg-id.singpass.gov.sg/fapi",
    sub: "29420934-1cd4-47c0-8296-509fd03582cf",
    aud: "ZOy3c3EYVNXvk7kM48pOnfW2jQbMqrCp",
    iat: 1789702308,
    person_info: {
      uinfin: { value: "S7790686Z" },
      name: { value: "TAN CHANG HUAT ERIC" },
      employment: { value: "HUNGRYCOMEHERE PTE LTD" },
    },
  };

  it("puts the person's fields at the top level", () => {
    const sent = myinfoAscendPayload(FAPI);

    expect(sent.uinfin).toEqual({ value: "S7790686Z" });
    expect(sent.name).toEqual({ value: "TAN CHANG HUAT ERIC" });
    expect(sent).not.toHaveProperty("person_info");
  });

  it("keeps sub, which is what Ascend identifies a user by", () => {
    // Established by experiment: a payload with a changed NRIC but the
    // original sub came back as the original user. Dropping it leaves Ascend
    // without the field it keys on.
    expect(myinfoAscendPayload(FAPI).sub).toBe("29420934-1cd4-47c0-8296-509fd03582cf");
  });

  it("keeps the other claims the legacy shape carried", () => {
    const sent = myinfoAscendPayload(FAPI);

    expect(sent.iss).toBe("https://stg-id.singpass.gov.sg/fapi");
    expect(sent.aud).toBe("ZOy3c3EYVNXvk7kM48pOnfW2jQbMqrCp");
    expect(sent.iat).toBe(1789702308);
  });

  it("leaves an already-flat payload alone", () => {
    // What the legacy Lambda produces: claims and person together, no nesting.
    const legacy = { iss: "x", sub: "u=5e510ddd", uinfin: { value: "S7790686Z" } };

    expect(myinfoAscendPayload(legacy)).toEqual(legacy);
  });

  it("never lets a claim overwrite one of the person's fields", () => {
    // The person is the point of the payload. If a claim ever collided with a
    // MyInfo field, losing the MyInfo one would be the worse outcome.
    const odd = { ...FAPI, name: "a claim called name" };

    expect(myinfoAscendPayload(odd).name).toEqual({ value: "TAN CHANG HUAT ERIC" });
  });
});
