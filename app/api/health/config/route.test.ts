import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET } from "./route";

const call = (authorization?: string) =>
  GET(new NextRequest("https://example.test/api/health/config", { headers: authorization ? { authorization } : {} }));

describe("GET /api/health/config", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret-for-tests";
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.ASCEND_ENABLED;
  });

  it("refuses everyone without the secret, so the site's setup is not public", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
  });

  it("refuses everyone when no secret is configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer ")).status).toBe(401);
  });

  it("with the secret, answers yes or no per setting, and says what is wrong", async () => {
    process.env.ASCEND_ENABLED = "false";

    const response = await call("Bearer s3cret-for-tests");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ascend).toBe(false);
    expect(body.cron).toBe(true);
    expect(body.problems).toContain("ascend");
    expect(JSON.stringify(body)).not.toContain("s3cret-for-tests");
  });
});
