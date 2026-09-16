/**
 * Postgres connection and query primitive.
 *
 * `pg` rather than `@neondatabase/serverless` on purpose: the Neon driver
 * speaks to Neon's proxy and nothing else, which would mean local development
 * and CI could never run against a plain Postgres. `pg` talks to both, so the
 * same queries that run against Neon in production run against a throwaway
 * local instance in a test.
 *
 * Point DATABASE_URL at Neon's *pooled* endpoint (the host containing
 * `-pooler`) in any serverless deployment. A Route Handler is a short-lived
 * process and each cold start opens its own pool; without the pooler, traffic
 * exhausts Postgres' connection limit long before it exhausts anything else.
 */

import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForPool = globalThis as typeof globalThis & {
  __crawfortPgPool?: Pool;
};

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Run `bash scripts/setup-database.sh` for a local " +
        "Postgres, or set it to your Neon pooled connection string.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

/**
 * One pool per process, reused across hot reloads. Next.js re-evaluates
 * modules on every edit in development, so a module-level `new Pool()` would
 * leak a pool per save until Postgres refuses new connections.
 */
export function pool(): Pool {
  if (globalForPool.__crawfortPgPool) return globalForPool.__crawfortPgPool;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new DatabaseNotConfiguredError();

  const created = new Pool({
    connectionString,
    // Neon terminates idle connections itself; keeping the pool small stops a
    // burst of cold starts from each holding connections they are not using.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // TLS is left to the connection string's own `sslmode`, deliberately.
    //
    // Passing `{ rejectUnauthorized: false }` here would silently downgrade a
    // URL that asked for `sslmode=require` - which `pg` currently treats as
    // verify-full - to an encrypted-but-unauthenticated connection. That is a
    // man-in-the-middle away from someone else's copy of an applicant's NRIC
    // and CPF history. Neon presents a certificate from a public CA, so there
    // is nothing to work around; a local instance simply omits sslmode.
  });

  globalForPool.__crawfortPgPool = created;
  return created;
}

/** True when a database is configured, without throwing. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Tagged-template query. Interpolated values become bound parameters, never
 * string-concatenated SQL:
 *
 *   sql`select * from leads where id = ${leadId}`
 *
 * becomes `select * from leads where id = $1` with `[leadId]`. There is no
 * escape hatch for interpolating an identifier, which is deliberate - column
 * and table names are written literally in each query module.
 */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const text = strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""),
    "",
  );
  const result = await pool().query<T>(text, values);
  return result.rows;
}

/** The single row a query returned, or null when it returned none. */
export async function sqlOne<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T | null> {
  const rows = await sql<T>(strings, ...values);
  return rows[0] ?? null;
}

/**
 * Runs `fn` inside a transaction, rolling back if it throws.
 *
 * Use it wherever two writes must both land or neither - a lead and its
 * credit assessment, say. A failure between them otherwise leaves a lead that
 * the approval screen cannot render.
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
