/**
 * Applies db/migrations/*.sql in filename order, once each.
 *
 * Deliberately not a migration framework. These are plain SQL files against
 * one Postgres; a framework would add a dependency, a DSL and a lock file to
 * solve a problem this does not have.
 *
 * Each migration runs inside a transaction together with the ledger row that
 * records it, so a migration cannot half-apply: either the DDL and its ledger
 * entry both commit, or neither does. Postgres has transactional DDL, which
 * is what makes that possible.
 *
 * Usage:
 *   node scripts/db-migrate.mjs          apply pending migrations
 *   node scripts/db-migrate.mjs --status list applied and pending
 *   node scripts/db-migrate.mjs --dry    show what would run
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "db", "migrations");

/**
 * Loads .env.local so the script works without an env manager.
 *
 * Skipped entirely when DATABASE_URL is already in the environment. A caller
 * that names a database means that database, and merging the file in
 * variable-by-variable is how a test harness ends up migrating production:
 * pass DATABASE_URL for a throwaway instance, leave DATABASE_URL_UNPOOLED
 * empty, and the file's value - pointing at the real database - wins the
 * `!process.env[name]` check and takes precedence over the pooled URL.
 */
function loadEnvLocal() {
  if (process.env.DATABASE_URL?.trim()) return;

  try {
    for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
      const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // No .env.local is fine when DATABASE_URL comes from the environment.
  }
}

function migrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, name), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex").slice(0, 16) };
    });
}

async function main() {
  loadEnvLocal();

  // Prefer the direct endpoint. Neon's pooled host runs pgbouncer, and DDL
  // through a transaction pooler is not something to stake a migration on -
  // Neon recommends a direct connection for exactly this. Falls back to
  // DATABASE_URL when only the pooled URL exists, which is the common case
  // for a plain local Postgres.
  const connectionString = (
    process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim()
  );
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Add it to .env.local or the environment.");
    process.exit(1);
  }
  const usingDirect = Boolean(process.env.DATABASE_URL_UNPOOLED?.trim());

  const mode = process.argv.includes("--status")
    ? "status"
    : process.argv.includes("--dry")
      ? "dry"
      : "apply";

  const client = new pg.Client({ connectionString });
  await client.connect();

  // Host only - the connection string carries a password.
  console.log(`▸ ${new URL(connectionString).hostname}`);
  console.log(`  ${usingDirect ? "direct endpoint" : "pooled endpoint"}\n`);

  try {
    await client.query(`
      create table if not exists schema_migrations (
        name        text primary key,
        checksum    text not null,
        applied_at  timestamptz not null default now()
      )`);

    const { rows } = await client.query("select name, checksum from schema_migrations");
    const applied = new Map(rows.map((r) => [r.name, r.checksum]));

    let pending = 0;

    for (const migration of migrations()) {
      const appliedChecksum = applied.get(migration.name);

      if (appliedChecksum) {
        // An edited migration is a real hazard: this database has the old
        // shape, a fresh one would get the new shape, and nothing would say
        // so. Refuse rather than let the two silently diverge.
        if (appliedChecksum !== migration.checksum) {
          console.error(`✗ ${migration.name} was edited after being applied.`);
          console.error(`  applied: ${appliedChecksum}  now: ${migration.checksum}`);
          console.error(`  Write a new migration instead of editing this one.`);
          process.exit(1);
        }
        if (mode !== "apply") console.log(`  applied  ${migration.name}`);
        continue;
      }

      pending += 1;

      if (mode !== "apply") {
        console.log(`  PENDING  ${migration.name}`);
        continue;
      }

      process.stdout.write(`  applying ${migration.name} ... `);
      try {
        await client.query("begin");
        await client.query(migration.sql);
        await client.query("insert into schema_migrations (name, checksum) values ($1, $2)", [
          migration.name,
          migration.checksum,
        ]);
        await client.query("commit");
        console.log("ok");
      } catch (err) {
        await client.query("rollback");
        console.log("FAILED");
        console.error(`\n${err.message}\n`);
        if (err.position) {
          const upto = migration.sql.slice(0, Number(err.position));
          console.error(`  at line ${upto.split("\n").length} of ${migration.name}`);
        }
        process.exit(1);
      }
    }

    if (mode === "apply") {
      console.log(pending ? `\n${pending} migration(s) applied.` : "\nAlready up to date.");
    } else if (!pending) {
      console.log("\nNothing pending.");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
