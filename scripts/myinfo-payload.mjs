/**
 * Print the MyInfo object exactly as it was sent to Ascend.
 *
 *   node scripts/myinfo-payload.mjs                 # the most recent retrieval
 *   node scripts/myinfo-payload.mjs S7790717C       # by NRIC
 *   node scripts/myinfo-payload.mjs --fields        # just which fields carry a value
 *
 * api_logs deliberately records field names only, because apply/credit carries
 * a whole person - NRIC, address, CPF, notices of assessment. That is the right
 * default and the wrong one when a vendor says "you did not send us X" and the
 * question is what X actually contained.
 *
 * So this reads the stored retrieval instead, and prints it in full. Use it on
 * test personas. On a real applicant, prefer --fields, which says which fields
 * carry a value without showing any of them.
 */

import "./helpers/quiet-known-warnings.mjs";
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
const fieldsOnly = args.includes("--fields");
const wanted = args.find((a) => !a.startsWith("--")) ?? null;

const { sql } = await import(join(ROOT, "lib/db/sql.ts"));
const { myinfoPersonData } = await import(join(ROOT, "lib/myinfo.ts"));

const rows = await sql`select created_at, payload from myinfo_retrievals order by created_at desc limit 40`;

/** MyInfo wraps almost everything as {value, source, lastupdated}. */
const unwrap = (v) =>
  v && typeof v === "object" && !Array.isArray(v) && "value" in v ? v.value : v;

const match = wanted
  ? rows.find((r) => String(unwrap(myinfoPersonData(r.payload).uinfin)) === wanted)
  : rows[0];

if (!match) {
  console.log(wanted ? `No stored retrieval for ${wanted}.` : "No retrievals stored.");
  process.exit(1);
}

const person = myinfoPersonData(match.payload);
const who = unwrap(person.uinfin) ?? "?";
console.log(`\nRetrieved ${match.created_at.toISOString().slice(0, 19)}  ${who}`);
console.log(`Sent to /openApi/apply/credit as the \`myinfo\` object, unchanged.\n`);

if (fieldsOnly) {
  for (const key of Object.keys(person).sort()) {
    const v = person[key];
    const inner = unwrap(v);
    const state =
      inner === undefined || inner === null
        ? v?.unavailable
          ? "unavailable"
          : Array.isArray(v?.history)
            ? `${v.history.length} entries`
            : "object"
        : String(inner).trim()
          ? "has a value"
          : "EMPTY";
    console.log(`  ${key.padEnd(20)} ${state}`);
  }
  console.log();
  process.exit(0);
}

console.log(JSON.stringify(person, null, 2));
console.log();
process.exit(0);
