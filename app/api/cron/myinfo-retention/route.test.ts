import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prune = vi.fn();
vi.mock("@/lib/db/myinfo-retrievals", () => ({ pruneExpiredMyinfoRetrievals: () => prune() }));

import { GET } from "./route";

const call = (authorization?: string) =>
  GET(new NextRequest("https://example.test/api/cron/myinfo-retention", { headers: authorization ? { authorization } : {} }));

describe("GET /api/cron/myinfo-retention", () => {
  beforeEach(() => {
    prune.mockReset().mockResolvedValue(3);
    process.env.CRON_SECRET = "s3cret-for-tests";
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("refuses a request with no secret and deletes nothing", async () => {
    expect((await call()).status).toBe(401);
    expect(prune).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret", async () => {
    expect((await call("Bearer nope")).status).toBe(401);
    expect(prune).not.toHaveBeenCalled();
  });

  it("refuses everyone when no secret is configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer ")).status).toBe(401);
    expect(prune).not.toHaveBeenCalled();
  });

  it("with the right secret deletes expired records and says how many", async () => {
    const response = await call("Bearer s3cret-for-tests");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pruned: 3 });
    expect(prune).toHaveBeenCalledTimes(1);
  });
});
