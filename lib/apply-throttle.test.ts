import { describe, it, expect, vi, afterEach } from "vitest";
import { throttleApplication } from "./apply-throttle";

afterEach(() => vi.unstubAllEnvs());

describe("throttleApplication", () => {
  it("allows when recent volume is below the ceiling", async () => {
    const d = await throttleApplication(async () => 3);
    expect(d.allowed).toBe(true);
  });

  it("refuses at the ceiling, with a retry-after", async () => {
    vi.stubEnv("APPLY_THROTTLE_MAX", "12");
    vi.stubEnv("APPLY_THROTTLE_WINDOW_MIN", "10");
    const d = await throttleApplication(async () => 12);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.retryAfterSeconds).toBe(600);
  });

  it("refuses above the ceiling too", async () => {
    vi.stubEnv("APPLY_THROTTLE_MAX", "12");
    const d = await throttleApplication(async () => 40);
    expect(d.allowed).toBe(false);
  });

  it("would have stopped the 8 Nov burst (15 in 10 min) at the default ceiling", async () => {
    const d = await throttleApplication(async () => 15);
    expect(d.allowed).toBe(false);
  });

  it("never blocks real single-digit daily volume", async () => {
    for (const n of [0, 1, 2, 5, 8]) {
      expect((await throttleApplication(async () => n)).allowed, `count=${n}`).toBe(true);
    }
  });

  it("fails open: a count that cannot be read lets the applicant through", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = await throttleApplication(async () => {
      throw new Error("db down");
    });
    expect(d.allowed).toBe(true);
  });

  it("honours a configured ceiling and window", async () => {
    vi.stubEnv("APPLY_THROTTLE_MAX", "3");
    vi.stubEnv("APPLY_THROTTLE_WINDOW_MIN", "5");
    const d = await throttleApplication(async () => 3);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.retryAfterSeconds).toBe(300);
  });
});
