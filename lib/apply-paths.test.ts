import { describe, expect, it } from "vitest";

import {
  applyPath,
  parseApplyVariant,
  stripVariantPrefix,
  variantFromPathname,
} from "./apply-paths";

describe("apply-paths", () => {
  it("detects the v2 variant from the URL", () => {
    expect(variantFromPathname("/v2")).toBe("v2");
    expect(variantFromPathname("/v2/")).toBe("v2");
    expect(variantFromPathname("/v2/apply/review")).toBe("v2");
    expect(variantFromPathname("/")).toBe("default");
    expect(variantFromPathname("/apply/review")).toBe("default");
    expect(variantFromPathname("/foreigner")).toBe("default");
  });

  it("strips the variant prefix for funnel matching", () => {
    expect(stripVariantPrefix("/v2")).toBe("/");
    expect(stripVariantPrefix("/v2/apply/review")).toBe("/apply/review");
    expect(stripVariantPrefix("/v2/apply/pending")).toBe("/apply/pending");
    expect(stripVariantPrefix("/apply/review")).toBe("/apply/review");
  });

  it("prefixes canonical paths for v2 and leaves default unchanged", () => {
    expect(applyPath("default", "/")).toBe("/");
    expect(applyPath("default", "/apply/review")).toBe("/apply/review");
    expect(applyPath("v2", "/")).toBe("/v2");
    expect(applyPath("v2", "/apply/review")).toBe("/v2/apply/review");
    expect(applyPath("v2", "/apply/choose-plan?amount=5000")).toBe(
      "/v2/apply/choose-plan?amount=5000",
    );
    expect(applyPath("v2", "/apply/pending?leadId=abc")).toBe(
      "/v2/apply/pending?leadId=abc",
    );
  });

  it("parses the variant cookie", () => {
    expect(parseApplyVariant("v2")).toBe("v2");
    expect(parseApplyVariant("default")).toBe("default");
    expect(parseApplyVariant(undefined)).toBe("default");
  });
});
