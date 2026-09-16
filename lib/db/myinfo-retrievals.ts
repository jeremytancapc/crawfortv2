/**
 * Verbatim Myinfo payloads, held between the Singpass callback and activate.
 *
 * This is the durable replacement for the in-memory map in
 * lib/auth-callback-store.ts. The functions are named for what the flow does
 * with a payload - save it at callback, read it at activate, link it once the
 * lead exists - rather than for the SQL underneath.
 */

import { sql, sqlOne } from "./sql";

export type MyinfoRetrieval = {
  id: string;
  created_at: string;
  payload: Record<string, unknown>;
  lead_id: string | null;
  consumed_at: string | null;
  expires_at: string;
};

/**
 * Stores the payload and returns the key that identifies it.
 *
 * The key travels onward in the session as `singpassRawKey`; the payload
 * itself never does. That split is the point - the payload is far larger
 * than a cookie can hold.
 */
export async function saveMyinfoRetrieval(
  payload: Record<string, unknown>,
  id?: string,
): Promise<string> {
  const row = id
    ? await sqlOne<{ id: string }>`
        insert into myinfo_retrievals (id, payload)
        values (${id}, ${JSON.stringify(payload)}::jsonb)
        on conflict (id) do update set payload = excluded.payload
        returning id`
    : await sqlOne<{ id: string }>`
        insert into myinfo_retrievals (payload)
        values (${JSON.stringify(payload)}::jsonb)
        returning id`;

  if (!row) throw new Error("failed to store Myinfo retrieval");
  return row.id;
}

/**
 * Reads a payload back without consuming it.
 *
 * Expired rows are treated as absent rather than returned with a warning: a
 * caller that gets a payload should be able to use it, and the retention
 * deadline is not advisory.
 */
export async function getMyinfoRetrieval(id: string): Promise<Record<string, unknown> | null> {
  const row = await sqlOne<{ payload: Record<string, unknown> }>`
    select payload from myinfo_retrievals
    where id = ${id} and expires_at > now()`;
  return row?.payload ?? null;
}

/** Attaches a stored payload to the lead that activate has just created. */
export async function linkMyinfoRetrievalToLead(id: string, leadId: string): Promise<void> {
  await sql`
    update myinfo_retrievals
    set lead_id = ${leadId}, consumed_at = now()
    where id = ${id}`;
}

/**
 * Deletes payloads past their retention deadline.
 *
 * Returns the number removed so a scheduled caller can log it. Retention here
 * is a legal obligation, not housekeeping - these rows hold unminimised
 * personal data.
 */
export async function pruneExpiredMyinfoRetrievals(): Promise<number> {
  const rows = await sql<{ id: string }>`
    delete from myinfo_retrievals where expires_at <= now() returning id`;
  return rows.length;
}
