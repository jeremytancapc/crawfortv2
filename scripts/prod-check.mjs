/**
 * Checks, one by one, that the production settings work - without doing
 * anything an applicant's journey would do.
 *
 *   node scripts/prod-check.mjs --offline      names, flags and hosts only (no network)
 *   node scripts/prod-check.mjs                 + database, Anthropic, S3 and Ascend
 *   node scripts/prod-check.mjs --control       + one Ascend call signed with a WRONG
 *                                                 secret, to prove the real one is accepted
 *   node scripts/prod-check.mjs --airconnect    + an empty request to AirConnect
 *   node scripts/prod-check.mjs --live          ask the LIVE site what settings it really has
 *                                                 (the file checks above prove the file, not Vercel)
 *
 * Reads .env.vercel-production (or --file <path>), never process.env, so it
 * cannot pick up staging values by accident. Prints names and PASS/FAIL only,
 * never a secret or a connection string.
 *
 * What it will NOT call, on purpose:
 *   - Ascend /openApi/users      creates a user
 *   - Ascend apply/credit, user/mlcb   pull from the credit bureau (MLCB)
 *   - Ascend order/comments      writes to an order
 *   - the Singpass Lambda        starts a real Singpass login
 * Ascend is checked with /openApi/query/credit on an order id that does not
 * exist: it reads, writes nothing and pulls nothing.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const fileArg = args.includes("--file") ? args[args.indexOf("--file") + 1] : ".env.vercel-production";

function readEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = readEnv(join(ROOT, fileArg));
const staging = readEnv(join(ROOT, ".env.local"));
if (Object.keys(env).length === 0) {
  console.error(`No variables found in ${fileArg}.`);
  process.exit(2);
}

let failed = 0;
let warned = 0;
const say = (state, name, detail = "") => {
  if (state === "FAIL") failed += 1;
  if (state === "WARN") warned += 1;
  console.log(`${state.padEnd(5)} ${name}${detail ? `  - ${detail}` : ""}`);
};
const hostOf = (value) => {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
};
const section = (title) => console.log(`\n${title}`);

// ── 1. Names, flags and hosts (no network) ────────────────────────────────

section("1. Settings");

const REQUIRED = [
  "APPLY_SESSION_SECRET", "DATABASE_URL", "DATABASE_URL_UNPOOLED",
  "ASCEND_ENABLED", "ASCEND_BASE_URL", "ASCEND_APP_ID", "ASCEND_APP_SECRET",
  "AIRCONNECT_API_KEY", "AIRCONNECT_APPOINTMENTS_URL", "AIRCONNECT_LEADS_URL",
  "AXS_PARTNER_API_KEY", "AXS_TOKEN_SECRET", "MYINFO_AUTH_URL", "ANTHROPIC_API_KEY",
  "DOCUMENTS_S3_BUCKET", "DOCUMENTS_S3_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
  "DOCUMENTS_URL_SECRET", "CRON_SECRET", "NEXT_PUBLIC_APP_BASE_URL", "SINGPASS_ENV",
];
const missing = REQUIRED.filter((name) => !env[name]);
if (missing.length) say("FAIL", "all required names are set", `missing: ${missing.join(", ")}`);
else say("PASS", "all required names are set", `${REQUIRED.length} names`);
if (env.DOCUMENT_S3_REGION) say("FAIL", "typo", "DOCUMENT_S3_REGION is spelt without the S; the code reads DOCUMENTS_S3_REGION");

const expect = (name, ok, detail) => say(ok ? "PASS" : "FAIL", name, detail);
expect("editor and capture are off", env.MYINFO_EDITOR_ENABLED === "false" && env.MYINFO_CAPTURE_ENABLED === "false",
  `MYINFO_EDITOR_ENABLED=${env.MYINFO_EDITOR_ENABLED}, MYINFO_CAPTURE_ENABLED=${env.MYINFO_CAPTURE_ENABLED}`);
expect("test banks are off", !env.TEST_RECOGNISED_BANKS, "TEST_RECOGNISED_BANKS must be empty");
expect("SINGPASS_ENV is production", env.SINGPASS_ENV === "production");
expect("Ascend is on", env.ASCEND_ENABLED === "true");
expect("app address is get.crawfort.com", env.NEXT_PUBLIC_APP_BASE_URL === "https://get.crawfort.com", env.NEXT_PUBLIC_APP_BASE_URL);
expect("Ascend is the production address", hostOf(env.ASCEND_BASE_URL) === "api-admin-ascend.crawfort.com", hostOf(env.ASCEND_BASE_URL));
expect("Singpass Lambda is the production one", /\/prod\/auth$/.test(env.MYINFO_AUTH_URL ?? "") && hostOf(env.MYINFO_AUTH_URL).startsWith("lss57v8zd2."), hostOf(env.MYINFO_AUTH_URL));
for (const name of ["AIRCONNECT_LEADS_URL", "AIRCONNECT_APPOINTMENTS_URL"]) {
  expect(`${name} is the production host`, hostOf(env[name]) === "airconnect.capcfintech.com", hostOf(env[name]));
}
const dbHost = (name) => hostOf(env[name] ?? "");
const stagingDbHost = hostOf(staging.DATABASE_URL ?? "");
expect("database is not the staging database", !!dbHost("DATABASE_URL") && dbHost("DATABASE_URL") !== stagingDbHost, dbHost("DATABASE_URL").split(".")[0]);
expect("pooled and direct URLs are the same database", dbHost("DATABASE_URL").replace("-pooler", "") === dbHost("DATABASE_URL_UNPOOLED"));
expect("session secret is long enough", (env.APPLY_SESSION_SECRET ?? "").length >= 32, `${(env.APPLY_SESSION_SECRET ?? "").length} characters`);
for (const name of ["APPLY_SESSION_SECRET", "DOCUMENTS_URL_SECRET", "CRON_SECRET", "AXS_TOKEN_SECRET", "ANTHROPIC_API_KEY", "AWS_ACCESS_KEY_ID", "DATABASE_URL"]) {
  if (env[name] && env[name] === staging[name]) say("FAIL", `${name} differs from staging`, "same value as .env.local");
}
for (const name of ["AIRCONNECT_API_KEY", "AXS_PARTNER_API_KEY", "ASCEND_APP_ID", "ASCEND_APP_SECRET"]) {
  if (env[name] && env[name] === staging[name]) say("WARN", `${name} equals the staging value`, "fine only if the provider uses one value for both");
}

if (flag("offline")) finish();

// ── 2. Database ───────────────────────────────────────────────────────────

section("2. Database (read-only)");
try {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: env.DATABASE_URL_UNPOOLED });
  await client.connect();
  const migrations = (await client.query("select count(*)::int as n from schema_migrations")).rows[0].n;
  const applicants = (await client.query("select count(*)::int as n from applicants")).rows[0].n;
  await client.end();
  expect("migrations applied", migrations === 9, `${migrations} of 9`);
  say("PASS", "database answers", `${applicants} applicants`);
} catch (error) {
  say("FAIL", "database answers", String(error.message).replace(/postgres(ql)?:\/\/\S+/g, "<url>"));
}

// ── 3. Anthropic ──────────────────────────────────────────────────────────

section("3. Anthropic (lists models: costs nothing, reads no document)");
try {
  const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
  });
  const body = await res.json().catch(() => ({}));
  const ids = (body.data ?? []).map((m) => m.id);
  expect("key is accepted", res.ok, `HTTP ${res.status}`);
  if (res.ok) expect("reader model is available", ids.includes("claude-opus-5-5"), ids.includes("claude-opus-5-5") ? "claude-opus-5-5" : "claude-opus-5-5 not in this key's models");
} catch (error) {
  say("FAIL", "Anthropic reachable", String(error.message));
}

// ── 4. S3 ─────────────────────────────────────────────────────────────────

section("4. Documents bucket (read-only)");
try {
  const { S3Client, HeadBucketCommand, ListObjectsV2Command, ListBucketsCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: env.DOCUMENTS_S3_REGION,
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
  });
  await s3.send(new HeadBucketCommand({ Bucket: env.DOCUMENTS_S3_BUCKET }));
  await s3.send(new ListObjectsV2Command({ Bucket: env.DOCUMENTS_S3_BUCKET, MaxKeys: 1 }));
  say("PASS", "key can reach the bucket", env.DOCUMENTS_S3_BUCKET);
  try {
    await s3.send(new ListBucketsCommand({}));
    say("WARN", "key is limited to this bucket", "it could also list other buckets");
  } catch {
    say("PASS", "key is limited to this bucket", "it cannot list other buckets");
  }
} catch (error) {
  say("FAIL", "key can reach the bucket", String(error.name ?? error.message));
}

// ── 5. Ascend ─────────────────────────────────────────────────────────────

section("5. Ascend (query/credit on an order that does not exist: no write, no credit pull)");
try {
  const { buildSignedRequest } = await import(join(ROOT, "lib/ascend/sign.ts"));
  const call = async (secret) => {
    const config = { baseUrl: env.ASCEND_BASE_URL.replace(/\/+$/, ""), appId: env.ASCEND_APP_ID, secret };
    const res = await fetch(`${config.baseUrl}/openApi/query/credit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSignedRequest({ orderId: "1000000000000000000" }, config)),
    });
    const text = await res.text();
    try {
      const envelope = JSON.parse(text);
      return { http: res.status, code: String(envelope.code), msg: String(envelope.msg ?? "").slice(0, 120) };
    } catch {
      return { http: res.status, code: "?", msg: text.slice(0, 120) };
    }
  };
  const real = await call(env.ASCEND_APP_SECRET);
  console.log(`      with the production secret: HTTP ${real.http}, code ${real.code}, "${real.msg}"`);
  if (flag("control")) {
    const wrong = await call(`${env.ASCEND_APP_SECRET}-wrong`);
    console.log(`      with a wrong secret:        HTTP ${wrong.http}, code ${wrong.code}, "${wrong.msg}"`);
    expect("Ascend accepts the production credentials", real.http !== 401 && `${real.code}|${real.msg}` !== `${wrong.code}|${wrong.msg}`, "answer differs from the wrong-secret answer");
  } else if (real.http === 401 || /sign/i.test(real.msg)) {
    say("FAIL", "Ascend accepts the production credentials", "looks like a signature or credentials problem");
  } else if (/not (found|exist)|no such|invalid order|does not/i.test(real.msg)) {
    say("PASS", "Ascend accepts the production credentials", "it looked for the order and did not find it");
  } else {
    say("WARN", "Ascend answer is unclear", "run again with --control to compare against a wrong secret");
  }
} catch (error) {
  say("FAIL", "Ascend reachable", String(error.message));
}

// ── 6. AirConnect (only when asked) ───────────────────────────────────────

if (flag("airconnect")) {
  section("6. AirConnect (an EMPTY request: it should be refused as invalid, not accepted)");
  for (const name of ["AIRCONNECT_LEADS_URL", "AIRCONNECT_APPOINTMENTS_URL"]) {
    try {
      const send = (key) => fetch(env[name], { method: "POST", headers: { "x-api-key": key, "Content-Type": "application/json" }, body: "{}" });
      const real = await send(env.AIRCONNECT_API_KEY);
      const wrong = await send(`${env.AIRCONNECT_API_KEY}-wrong`);
      console.log(`      ${name}: real key HTTP ${real.status}, wrong key HTTP ${wrong.status}`);
      if (real.ok) say("WARN", `${name} accepted an empty request`, "it may have created a blank record; check AirConnect");
      else expect(`${name} accepts the key`, ![401, 403].includes(real.status) && [401, 403].includes(wrong.status), "the wrong key is refused and the real key is not");
    } catch (error) {
      say("FAIL", `${name} reachable`, String(error.message));
    }
  }
}

if (flag("live")) {
  section("7. The live site (what Vercel really holds, as yes or no)");
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_APP_BASE_URL}/api/health/config`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    if (res.status === 401) {
      say("FAIL", "live site answers", "401: CRON_SECRET in Vercel is missing, or differs from the file, or the site has not been redeployed since it was added");
    } else if (res.status === 404) {
      say("FAIL", "live site answers", "404: the live site does not have the health route yet (not deployed)");
    } else {
      const report = await res.json();
      console.log(`      environment ${report.environment}, running commit ${report.commit}`);
      for (const name of ["ascend", "database", "documents", "anthropic", "singpass", "airconnect", "appBaseUrl", "cron", "editorsOff", "testBanksOff"]) {
        say(report[name] ? "PASS" : "FAIL", `live: ${name}`);
      }
    }
  } catch (error) {
    say("FAIL", "live site reachable", String(error.message));
  }
}

section("Not checked here");
console.log("      Singpass Lambda  (starts a real login: tested in the smoke test)");
console.log("      AXS              (AXS calls us: tested in the smoke test)");
finish();

function finish() {
  console.log(`\n${failed ? "FAILED" : "OK"}: ${failed} failed, ${warned} warning(s).`);
  process.exit(failed ? 1 : 0);
}
