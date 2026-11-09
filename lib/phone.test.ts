import { describe, it, expect } from "vitest";
import { toSgE164, sgMobileOrNull, isValidSgMobile } from "./phone";

describe("toSgE164", () => {
  it("prefixes a bare local number with +65", () => {
    expect(toSgE164("91234567")).toBe("+6591234567");
  });

  it("leaves an already-prefixed number unchanged", () => {
    expect(toSgE164("+6591234567")).toBe("+6591234567");
  });

  it("returns an empty string for null or undefined", () => {
    expect(toSgE164(null)).toBe("");
    expect(toSgE164(undefined)).toBe("");
  });

  it("returns an empty string for an empty string", () => {
    expect(toSgE164("")).toBe("");
  });
});

describe("sgMobileOrNull", () => {
  it("accepts the three shapes that actually arrive", () => {
    expect(sgMobileOrNull("91234567")).toBe("91234567");
    expect(sgMobileOrNull("6591234567")).toBe("91234567");
    expect(sgMobileOrNull("+6591234567")).toBe("91234567");
  });

  it("tolerates the spacing people and partners type", () => {
    expect(sgMobileOrNull("9123 4567")).toBe("91234567");
    expect(sgMobileOrNull("+65 9123-4567")).toBe("91234567");
  });

  it("accepts both mobile prefixes and rejects the others", () => {
    expect(sgMobileOrNull("81234567")).toBe("81234567");
    expect(sgMobileOrNull("61234567")).toBeNull(); // landline
    expect(sgMobileOrNull("31234567")).toBeNull(); // VoIP
  });

  it("rejects the wrong number of digits", () => {
    expect(sgMobileOrNull("9123456")).toBeNull();
    expect(sgMobileOrNull("912345678")).toBeNull();
  });

  // The two values that actually arrived on 8 Nov 2026.
  it("rejects the payloads seen in production", () => {
    expect(sgMobileOrNull("+6581230670' OR '1'='1")).toBeNull();
    expect(sgMobileOrNull("%")).toBeNull();
  });

  it("rejects other injection and wildcard shapes", () => {
    for (const bad of [
      "8123456%",
      "'; drop table applicants; --",
      "<script>alert(1)</script>",
      "81234567 OR 1=1",
      "_1234567",
      "+6581234567abc",
    ]) {
      expect(sgMobileOrNull(bad), bad).toBeNull();
    }
  });

  it("rejects empty and missing values", () => {
    expect(sgMobileOrNull("")).toBeNull();
    expect(sgMobileOrNull(null)).toBeNull();
    expect(sgMobileOrNull(undefined)).toBeNull();
  });

  it("never returns anything but eight digits", () => {
    for (const input of ["91234567", "+6591234567", "9123 4567", "%", "bad", ""]) {
      const out = sgMobileOrNull(input);
      if (out !== null) expect(out).toMatch(/^[89]\d{7}$/);
    }
  });
});

describe("isValidSgMobile", () => {
  it("agrees with sgMobileOrNull", () => {
    expect(isValidSgMobile("91234567")).toBe(true);
    expect(isValidSgMobile("%")).toBe(false);
    expect(isValidSgMobile(null)).toBe(false);
  });
});
