import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * The callback mints a signed apply session from whatever MyInfo it is given,
 * so who may call it is the whole of its security.
 */

function post(headers: Record<string, string> = {}) {
  return new NextRequest("https://get.crawfort.com/api/auth/callback", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ myinfo: { uinfin: { value: "S1234567A" } } }),
  });
}

describe("auth callback gateway authentication", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("refuses a request with no credential once the secret is configured", async () => {
    vi.stubEnv("AUTH_CALLBACK_SECRET", "gateway-secret");
    const { POST } = await import("./route");
    const res = await POST(post());
    expect(res.status).toBe(401);
  });

  it("refuses a wrong credential", async () => {
    vi.stubEnv("AUTH_CALLBACK_SECRET", "gateway-secret");
    const { POST } = await import("./route");
    const res = await POST(post({ authorization: "Bearer not-the-secret" }));
    expect(res.status).toBe(401);
  });

  it("refuses a credential that is merely a prefix of the right one", async () => {
    vi.stubEnv("AUTH_CALLBACK_SECRET", "gateway-secret");
    const { POST } = await import("./route");
    const res = await POST(post({ authorization: "Bearer gateway" }));
    expect(res.status).toBe(401);
  });

  it("gives nothing away in the refusal", async () => {
    vi.stubEnv("AUTH_CALLBACK_SECRET", "gateway-secret");
    const { POST } = await import("./route");
    const res = await POST(post());
    expect(JSON.stringify(await res.json())).not.toContain("gateway-secret");
  });

  it("does not mint an activate token for a refused request", async () => {
    vi.stubEnv("AUTH_CALLBACK_SECRET", "gateway-secret");
    const { POST } = await import("./route");
    const body = JSON.stringify(await (await POST(post())).json());
    expect(body).not.toContain("/api/apply/activate");
    expect(body).not.toContain("token");
  });

  it("stays open while the secret is unset, so our side can ship first", async () => {
    vi.stubEnv("AUTH_CALLBACK_SECRET", "");
    const { POST } = await import("./route");
    const res = await POST(post());
    expect(res.status).not.toBe(401);
  });

  it("says so on every request while it is open", async () => {
    vi.stubEnv("AUTH_CALLBACK_SECRET", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { POST } = await import("./route");
    await POST(post());
    expect(warn.mock.calls.flat().join(" ")).toContain("AUTH_CALLBACK_SECRET is not set");
  });
});
