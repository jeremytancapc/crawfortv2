import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "crypto";

import { buildSignString, signParams, buildSignedRequest } from "./sign";
import { ascendConfig } from "./config";

const config = { baseUrl: "https://api-mms.newtime.top", appId: "10001", secret: "test-secret" };

describe("buildSignString", () => {
  it("sorts keys in ASCII order", () => {
    expect(buildSignString({ timestamp: "3", appId: "1", nonce: "2" })).toBe(
      "appId=1&nonce=2&timestamp=3",
    );
  });

  it("excludes sign itself", () => {
    expect(buildSignString({ appId: "1", sign: "ABC" })).toBe("appId=1");
  });

  it("drops empty values rather than signing key=", () => {
    expect(buildSignString({ appId: "1", remark: "" })).toBe("appId=1");
  });

  it("puts data in ASCII position, between appId and nonce", () => {
    const out = buildSignString({ appId: "1", data: '{"x":1}', nonce: "n", timestamp: "t" });
    expect(out).toBe('appId=1&data={"x":1}&nonce=n&timestamp=t');
  });
});

describe("signParams", () => {
  it("is uppercase hex - lowercase is rejected by Ascend with code 600", () => {
    const sign = signParams({ appId: "10001" }, "test-secret");
    expect(sign).toMatch(/^[0-9A-F]{64}$/);
  });

  it("matches an independently computed HMAC of the sorted string", () => {
    const expected = createHmac("sha256", "test-secret")
      .update("appId=10001&nonce=abc&timestamp=1719580800000")
      .digest("hex")
      .toUpperCase();

    expect(
      signParams({ timestamp: "1719580800000", appId: "10001", nonce: "abc" }, "test-secret"),
    ).toBe(expected);
  });

  it("changes when any signed field changes", () => {
    const base = signParams({ appId: "10001", nonce: "a" }, "s");
    expect(signParams({ appId: "10001", nonce: "b" }, "s")).not.toBe(base);
    expect(signParams({ appId: "10002", nonce: "a" }, "s")).not.toBe(base);
    expect(signParams({ appId: "10001", nonce: "a" }, "other")).not.toBe(base);
  });
});

describe("buildSignedRequest", () => {
  const data = { desiredAmount: 8000, myinfo: { uinfin: { value: "S1234567D" } } };

  it("sends data as an object - sending the JSON string returns code 505", () => {
    const req = buildSignedRequest(data, config);
    expect(typeof req.data).toBe("object");
    expect(req.data).toEqual(data);
  });

  it("signs the JSON string of that same object - omitting data returns code 600", () => {
    const req = buildSignedRequest(data, config, { timestamp: "1719580800000", nonce: "abc" });
    const expected = createHmac("sha256", config.secret)
      .update(`appId=10001&data=${JSON.stringify(data)}&nonce=abc&timestamp=1719580800000`)
      .digest("hex")
      .toUpperCase();

    expect(req.sign).toBe(expected);
  });

  it("stays verifiable after the envelope is serialised for the wire", () => {
    // The body is JSON.stringify'd as a whole, so `data` must serialise to the
    // exact string that was signed. This is the check that catches a key-order
    // drift between signing and sending.
    const req = buildSignedRequest(data, config, { timestamp: "1719580800000", nonce: "abc" });
    const onTheWire = JSON.parse(JSON.stringify(req)) as typeof req;

    const recomputed = createHmac("sha256", config.secret)
      .update(
        `appId=${onTheWire.appId}&data=${JSON.stringify(onTheWire.data)}&nonce=${onTheWire.nonce}&timestamp=${onTheWire.timestamp}`,
      )
      .digest("hex")
      .toUpperCase();

    expect(recomputed).toBe(req.sign);
  });

  it("generates a fresh nonce and a millisecond timestamp by default", () => {
    const a = buildSignedRequest(data, config);
    const b = buildSignedRequest(data, config);
    expect(a.nonce).not.toBe(b.nonce);
    expect(Number(a.timestamp)).toBeGreaterThan(1.7e12);
    expect(a.timestamp).toMatch(/^\d{13}$/);
  });
});

describe("ascendConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is off unless explicitly switched on", () => {
    vi.stubEnv("ASCEND_BASE_URL", "https://api-mms.newtime.top");
    vi.stubEnv("ASCEND_APP_ID", "10001");
    vi.stubEnv("ASCEND_APP_SECRET", "s");
    vi.stubEnv("ASCEND_ENABLED", "");
    expect(ascendConfig()).toBeNull();
  });

  it("stays off when switched on but incompletely configured", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("ASCEND_ENABLED", "true");
    vi.stubEnv("ASCEND_BASE_URL", "https://api-mms.newtime.top");
    vi.stubEnv("ASCEND_APP_ID", "10001");
    vi.stubEnv("ASCEND_APP_SECRET", "");
    expect(ascendConfig()).toBeNull();
  });

  it("never reports the secret it is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("ASCEND_ENABLED", "true");
    vi.stubEnv("ASCEND_APP_SECRET", "super-secret-value");
    vi.stubEnv("ASCEND_BASE_URL", "");
    ascendConfig();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("super-secret-value");
  });

  it("trims a trailing slash so URLs join predictably", () => {
    vi.stubEnv("ASCEND_ENABLED", "true");
    vi.stubEnv("ASCEND_BASE_URL", "https://api-mms.newtime.top/");
    vi.stubEnv("ASCEND_APP_ID", "10001");
    vi.stubEnv("ASCEND_APP_SECRET", "s");
    expect(ascendConfig()?.baseUrl).toBe("https://api-mms.newtime.top");
  });
});
