import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs against a real Postgres. The retention deadline on a raw MyInfo record
 * is a legal obligation, so what is under test is that an expired payload is
 * really deleted, a live one is left alone, and neither is readable once past
 * its time.
 *
 *   TEST_DATABASE_URL=$(bash scripts/db-test-server.sh start) npx vitest run lib/db/myinfo-retrievals
 */
const TEST_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_URL)("myinfo_retrievals retention", () => {
  let saveMyinfoRetrieval: typeof import("./myinfo-retrievals").saveMyinfoRetrieval;
  let getMyinfoRetrieval: typeof import("./myinfo-retrievals").getMyinfoRetrieval;
  let pruneExpiredMyinfoRetrievals: typeof import("./myinfo-retrievals").pruneExpiredMyinfoRetrievals;
  let sql: typeof import("./sql").sql;
  const made: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL;
    ({ saveMyinfoRetrieval, getMyinfoRetrieval, pruneExpiredMyinfoRetrievals } = await import("./myinfo-retrievals"));
    ({ sql } = await import("./sql"));
  });

  afterAll(async () => {
    for (const id of made) await sql`delete from myinfo_retrievals where id = ${id}`;
  });

  it("deletes an expired record and leaves a live one", async () => {
    const live = await saveMyinfoRetrieval({ name: { value: "TEST LIVE" } });
    const expired = await saveMyinfoRetrieval({ name: { value: "TEST EXPIRED" } });
    made.push(live, expired);
    await sql`update myinfo_retrievals set expires_at = now() - interval '1 minute' where id = ${expired}`;

    const removed = await pruneExpiredMyinfoRetrievals();

    expect(removed).toBeGreaterThanOrEqual(1);
    const rows = await sql<{ id: string }>`select id from myinfo_retrievals where id in (${live}, ${expired})`;
    expect(rows.map((r) => r.id)).toEqual([live]);
  });

  it("will not hand back a record past its deadline, even before it is deleted", async () => {
    const id = await saveMyinfoRetrieval({ name: { value: "TEST LATE" } });
    made.push(id);
    expect(await getMyinfoRetrieval(id)).not.toBeNull();

    await sql`update myinfo_retrievals set expires_at = now() - interval '1 second' where id = ${id}`;

    expect(await getMyinfoRetrieval(id)).toBeNull();
  });

  it("keeps records for 24 hours from the moment they are saved", async () => {
    const id = await saveMyinfoRetrieval({ name: { value: "TEST WINDOW" } });
    made.push(id);
    const [row] = await sql<{ hours: string }>`
      select (extract(epoch from (expires_at - created_at)) / 3600)::numeric(6,2)::text as hours
      from myinfo_retrievals where id = ${id}`;

    expect(Number(row.hours)).toBe(24);
  });
});
