import { describe, expect, it } from "vitest";

import { ascendConfig, ascendMissingInProduction } from "./config";

const COMPLETE = {
  ASCEND_ENABLED: "true",
  ASCEND_BASE_URL: "https://api-admin-ascend.crawfort.com/",
  ASCEND_APP_ID: "10001",
  ASCEND_APP_SECRET: "a-secret",
} as unknown as NodeJS.ProcessEnv;

const env = (over: Record<string, string | undefined>) => ({ ...COMPLETE, ...over }) as NodeJS.ProcessEnv;

describe("ascendConfig", () => {
  it("is the settings, trimmed, when all four are present and switched on", () => {
    expect(ascendConfig(COMPLETE)).toEqual({
      baseUrl: "https://api-admin-ascend.crawfort.com",
      appId: "10001",
      secret: "a-secret",
    });
  });

  it("is off unless ASCEND_ENABLED is exactly true", () => {
    for (const value of [undefined, "", "false", "TRUE", "true ", "1"]) {
      expect(ascendConfig(env({ ASCEND_ENABLED: value })), String(value)).toBeNull();
    }
  });

  it("is off when any one of the three settings is missing - the secret too", () => {
    for (const name of ["ASCEND_BASE_URL", "ASCEND_APP_ID", "ASCEND_APP_SECRET"]) {
      expect(ascendConfig(env({ [name]: undefined })), name).toBeNull();
      expect(ascendConfig(env({ [name]: "   " })), `${name} blank`).toBeNull();
    }
  });
});

describe("ascendMissingInProduction", () => {
  it("is true on production when Ascend is not fully set up: nobody may be sent to 'under review' unchecked", () => {
    expect(ascendMissingInProduction(env({ VERCEL_ENV: "production", ASCEND_APP_SECRET: undefined }))).toBe(true);
    expect(ascendMissingInProduction(env({ VERCEL_ENV: "production", ASCEND_ENABLED: "false" }))).toBe(true);
  });

  it("is false on production when Ascend is set up", () => {
    expect(ascendMissingInProduction(env({ VERCEL_ENV: "production" }))).toBe(false);
  });

  it("is false everywhere else, so staging, previews and a laptop still run without Ascend", () => {
    for (const where of ["preview", "development", undefined]) {
      expect(ascendMissingInProduction(env({ VERCEL_ENV: where, ASCEND_ENABLED: "false" })), String(where)).toBe(false);
    }
  });
});
