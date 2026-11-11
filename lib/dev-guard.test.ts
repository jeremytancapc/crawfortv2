import { describe, expect, it } from "vitest";

import { devEndpointsBlocked } from "./dev-guard";

describe("devEndpointsBlocked", () => {
  it("blocks on the production deployment even when a MYINFO flag is set", () => {
    expect(
      devEndpointsBlocked({
        VERCEL_ENV: "production",
        MYINFO_EDITOR_ENABLED: "true",
        MYINFO_CAPTURE_ENABLED: "true",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("does not block on preview/staging", () => {
    expect(
      devEndpointsBlocked({ VERCEL_ENV: "preview" } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it("does not block locally when VERCEL_ENV is unset", () => {
    expect(devEndpointsBlocked({} as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});
