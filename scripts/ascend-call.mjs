/**
 * Smoke-test one Ascend Open API endpoint from the command line.
 *
 *   node scripts/ascend-call.mjs users --nric S7790721A --phone 91234567
 *   node scripts/ascend-call.mjs query --orderId 1523633858296446976
 *
 * Credentials come from .env.local, so this file holds no secrets and is safe
 * to commit - unlike the ad-hoc scripts .gitignore still excludes.
 *
 * It imports lib/ascend/sign.ts directly, because signing is the part with
 * the three undocumented rules that are expensive to get wrong, and a second
 * copy of it would drift. The envelope handling below is duplicated from
 * client.ts on purpose: Node's ESM resolver will not follow that module's
 * extensionless imports, and contorting application code to suit a smoke test
 * is the wrong way round.
 *
 * `users` CREATES the user in Ascend, so it prompts before firing.
 */

import { createInterface } from "node:readline/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { buildSignedRequest } = await import(join(ROOT, "lib/ascend/sign.ts"));

const config = {
  baseUrl: (process.env.ASCEND_BASE_URL ?? "").replace(/\/+$/, ""),
  appId: process.env.ASCEND_APP_ID ?? "",
  secret: process.env.ASCEND_APP_SECRET ?? "",
};

const missingNames = [
  !config.baseUrl && "ASCEND_BASE_URL",
  !config.appId && "ASCEND_APP_ID",
  !config.secret && "ASCEND_APP_SECRET",
].filter(Boolean);

if (missingNames.length) {
  console.error(`Missing from .env.local: ${missingNames.join(", ")}`);
  console.error("\nAdd them yourself - do not paste the secret into a chat.");
  process.exit(1);
}

console.log(`▸ ${config.baseUrl}  appId=${config.appId}\n`);

async function callAscend(path, data) {
  const body = buildSignedRequest(data, config);
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}, non-JSON response: ${text.slice(0, 200)}`);
  }
  if (envelope.code !== "10000") {
    const extra = envelope.code === "600" ? "  (600 is also what a bad signature returns)" : "";
    throw new Error(`${envelope.code}: ${envelope.msg}${extra}`);
  }
  return envelope.data;
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function confirm(question) {
  if (process.argv.includes("--yes")) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return /^y/i.test(answer);
}

try {
  const command = process.argv[2];

  if (command === "users") {
    const idNumber = arg("nric");
    const phone = arg("phone");
    if (!idNumber || !phone) {
      console.error("usage: users --nric <NRIC> --phone <phone>");
      process.exit(1);
    }
    console.log("/openApi/users CREATES the user in Ascend and returns the userId");
    console.log("that /openApi/apply/credit later consumes. This is not read-only.\n");
    if (!(await confirm(`Call /openApi/users for ${idNumber} / ${phone}?`))) {
      console.log("Aborted.");
      process.exit(0);
    }
    const data = await callAscend("/openApi/users", { idNumber, phone });
    console.log(`\n${JSON.stringify(data, null, 2)}\n`);
    console.log(`  userId:      ${data.userId}`);
    console.log(
      `  newCustomer: ${data.newCustomer}  → ${data.newCustomer ? "New Customer" : "RELOAN - leaves the web funnel"}`,
    );
    console.log(`  hasMyinfo:   ${data.hasMyinfo}`);
  } else if (command === "query") {
    const orderId = arg("orderId");
    if (!orderId) {
      console.error("usage: query --orderId <id>");
      process.exit(1);
    }
    console.log(JSON.stringify(await callAscend("/openApi/query/credit", { orderId }), null, 2));
  } else {
    console.error("commands: users, query");
    process.exit(1);
  }
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
}
