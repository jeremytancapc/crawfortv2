import { describe, it, expect, vi, afterEach } from "vitest";
import { sessionSecret } from "./apply-session-codec";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sessionSecret", () => {
  it("uses the configured secret when there is one", () => {
    vi.stubEnv("APPLY_SESSION_SECRET", "a-real-secret-of-sufficient-length");
    expect(sessionSecret()).toBe("a-real-secret-of-sufficient-length");
  });

  it("refuses to sign on a deployment that has none", () => {
    vi.stubEnv("APPLY_SESSION_SECRET", "");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => sessionSecret()).toThrow(/APPLY_SESSION_SECRET is not set/);
  });

  it("refuses on a preview deployment too - a forgeable preview is still forgeable", () => {
    vi.stubEnv("APPLY_SESSION_SECRET", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(() => sessionSecret()).toThrow();
  });

  it("still works locally, where there is no session worth forging", () => {
    vi.stubEnv("APPLY_SESSION_SECRET", "");
    vi.stubEnv("VERCEL_ENV", "");
    expect(sessionSecret()).toBe("dev-insecure-secret-32chars-xx");
  });

  it("prefers a configured secret over the development constant", () => {
    vi.stubEnv("APPLY_SESSION_SECRET", "configured");
    vi.stubEnv("VERCEL_ENV", "");
    expect(sessionSecret()).not.toBe("dev-insecure-secret-32chars-xx");
  });

  it("treats whitespace as unset rather than signing with a space", () => {
    vi.stubEnv("APPLY_SESSION_SECRET", "   ");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => sessionSecret()).toThrow();
  });
});
