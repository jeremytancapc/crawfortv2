import { describe, it, expect } from "vitest";
import { toSgE164 } from "./phone";

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
