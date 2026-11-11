import { describe, expect, it } from "vitest";

import { redactAirconnectBody } from "./redact";

describe("redactAirconnectBody", () => {
  it("masks name and mobile but keeps non-PII fields and keys", () => {
    const out = redactAirconnectBody({
      customerName: "TAN CAKEN",
      phoneNumber: "+6591234567",
      appName: "cfh5",
      creditLimit: 8000,
    });
    expect(out.customerName).toBe("[redacted]");
    expect(out.phoneNumber).toBe("[redacted]");
    expect(out.appName).toBe("cfh5");
    expect(out.creditLimit).toBe(8000);
  });

  it("leaves empty/missing PII values untouched (nothing to mask)", () => {
    const out = redactAirconnectBody({ customerName: "", phoneNumber: null });
    expect(out.customerName).toBe("");
    expect(out.phoneNumber).toBeNull();
  });
});
