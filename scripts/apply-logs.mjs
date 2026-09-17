/**
 * Read what happened to an applicant, from the command line.
 *
 *   node scripts/apply-logs.mjs                    # the last 20 calls
 *   node scripts/apply-logs.mjs --failed           # only the ones that failed
 *   node scripts/apply-logs.mjs CFH5-06A2D6A1      # one applicant, by reference
 *   node scripts/apply-logs.mjs fba5e630-5e00-...  # one applicant, by id
 *   node scripts/apply-logs.mjs --body CFH5-06A2D6A1   # with Ascend's reply in full
 *
 * Answers the question the browser cannot: an applicant on the pending page
 * may have been declined, may have had Ascend fail, or may never have been
 * asked at all - three different problems behind one screen.
 *
 * Reads DATABASE_URL from .env.local, so this file holds no secrets.
 */

import "./helpers/resolve-app-imports.mjs";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const failedOnly = args.includes("--failed");
const withBody = args.includes("--body");
const subject = args.find((a) => !a.startsWith("--")) ?? null;

const { sql } = await import(join(ROOT, "lib/db/sql.ts"));

/** A reference like CFH5-06A2D6A1 ends with the applicant id's last 8 characters. */
async function resolveApplicant(raw) {
  const tail = raw.includes("-") && raw.length < 20 ? raw.split("-").pop().toLowerCase() : raw;
  const rows = await sql`
    select id, created_at, status, ascend_user_id
    from applicants
    where id::text = ${tail} or id::text like ${"%" + tail}
    limit 2`;
  return rows;
}

function line(l) {
  const when = l.created_at.toISOString().slice(0, 19).replace("T", " ");
  const verdict = l.error ?? "ok";
  console.log(`  ${when}  ${String(l.tag).padEnd(34)} ${verdict}`);
  if (withBody && l.response_body) console.log(`      ${String(l.response_body).slice(0, 600)}`);
}

if (subject) {
  const found = await resolveApplicant(subject);
  if (found.length === 0) {
    console.log(`No applicant matches "${subject}".`);
    process.exit(1);
  }
  if (found.length > 1) {
    console.log(`"${subject}" matches more than one applicant. Use the full id:`);
    for (const a of found) console.log(`  ${a.id}`);
    process.exit(1);
  }

  const a = found[0];
  console.log(`\nApplicant ${a.id}`);
  console.log(`  created        ${a.created_at.toISOString().slice(0, 19).replace("T", " ")}`);
  console.log(`  status         ${a.status}`);
  console.log(`  ascend user    ${a.ascend_user_id ?? "none yet"}`);

  const [order] = await sql`select * from ascend_orders where applicant_id = ${a.id}`;
  console.log(
    order
      ? `  ascend order   ${order.order_id}  (${order.risk_status})`
      : "  ascend order   none - nothing was ever created in Ascend",
  );

  const logs = await sql`
    select created_at, tag, error, response_body
    from api_logs where applicant_id = ${a.id} order by created_at`;
  console.log(`\n  Calls to Ascend (${logs.length})`);
  if (logs.length === 0) console.log("    none - Ascend was never asked about this applicant");
  logs.forEach(line);
  console.log();
  process.exit(0);
}

const logs = failedOnly
  ? await sql`select created_at, tag, error, response_body from api_logs
              where response_ok is not true order by created_at desc limit 20`
  : await sql`select created_at, tag, error, response_body from api_logs
              order by created_at desc limit 20`;

console.log(`\n${failedOnly ? "Failed calls" : "Recent calls"} (${logs.length})`);
logs.forEach(line);
console.log();
process.exit(0);
