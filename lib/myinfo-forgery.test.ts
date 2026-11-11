import { describe, expect, it } from "vitest";

import { looksLikeForgedMyinfo } from "./myinfo-forgery";

describe("looksLikeForgedMyinfo", () => {
  it("passes a genuine v5 payload nested under person_info", () => {
    expect(
      looksLikeForgedMyinfo({
        person_info: {
          uinfin: { value: "S1234567D" },
          name: { value: "TAN W.H." },
          mobileno: { nbr: { value: "91234567" } },
        },
      }),
    ).toBe(false);
  });

  it("passes a genuine flat (v3) payload", () => {
    expect(looksLikeForgedMyinfo({ uinfin: "S1234567D", mobileno: { nbr: { value: "91234567" } } })).toBe(
      false,
    );
  });

  it("passes a real customer with NO phone number (completeness is not required)", () => {
    expect(looksLikeForgedMyinfo({ uinfin: "S1234567D" })).toBe(false);
  });

  it("passes a name containing an apostrophe (names are never screened)", () => {
    expect(looksLikeForgedMyinfo({ uinfin: "S1234567D", name: { value: "O'BRIEN" } })).toBe(false);
  });

  it("blocks a SQL-injection NRIC", () => {
    expect(looksLikeForgedMyinfo({ uinfin: "S1234567D' OR '1'='1" })).toBe(true);
  });

  it("blocks an injection phone number", () => {
    expect(
      looksLikeForgedMyinfo({ uinfin: "S1234567D", mobileno: { nbr: "+6581230670' OR '1'='1" } }),
    ).toBe(true);
  });

  it("blocks a '%' phone number", () => {
    expect(looksLikeForgedMyinfo({ uinfin: "S1234567D", mobileno: { nbr: "%" } })).toBe(true);
  });

  it("blocks a prototype-pollution key", () => {
    expect(looksLikeForgedMyinfo(JSON.parse('{"uinfin":"S1234567D","__proto__":{"isAdmin":true}}'))).toBe(
      true,
    );
  });

  it("ignores a non-object payload", () => {
    expect(looksLikeForgedMyinfo(null)).toBe(false);
    expect(looksLikeForgedMyinfo("x")).toBe(false);
  });
});
