/**
 * One look at production: is anyone being hurt, or about to be?
 *
 *   node scripts/prod-monitor.mjs                 one look, last 10 minutes
 *   node scripts/prod-monitor.mjs --window 6      look back 6 minutes (for a 5-minute schedule)
 *   node scripts/prod-monitor.mjs --quiet         print nothing when all is clear
 *   node scripts/prod-monitor.mjs --file <path>   another env file
 *
 * Exit code: 0 all clear (or news only), 1 something to look at, 2 URGENT.
 *
 * It only reads: it never writes to the database, never creates an Ascend user
 * and never pulls credit. The rules that decide "urgent" are lib/monitor/findings.ts,
 * where each one is tested. Prints counts and names only - no applicant data.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);

const windowMinutes = Number(option("window", "10"));
const file = option("file", ".env.vercel-production");

function readEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = readEnv(join(ROOT, file));
if (!env.DATABASE_URL_UNPOOLED || !env.NEXT_PUBLIC_APP_BASE_URL) {
  console.error(`URGENT monitor_setup: ${file} is missing DATABASE_URL_UNPOOLED or NEXT_PUBLIC_APP_BASE_URL.`);
  process.exit(2);
}

const within = (url, ms = 15000, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(ms) });

// ── Probes: things that can be asked from outside ─────────────────────────

async function siteOk() {
  try {
    const res = await within(env.NEXT_PUBLIC_APP_BASE_URL, 15000, { redirect: "manual" });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function lambdaOk() {
  try {
    const res = await within(env.MYINFO_AUTH_URL, 15000, { redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    return [301, 302, 303, 307].includes(res.status) && /^https:\/\/id\.singpass\.gov\.sg\//.test(location);
  } catch {
    return false;
  }
}

async function ascendCredentialsOk() {
  try {
    const { buildSignedRequest } = await import(join(ROOT, "lib/ascend/sign.ts"));
    const config = { baseUrl: env.ASCEND_BASE_URL.replace(/\/+$/, ""), appId: env.ASCEND_APP_ID, secret: env.ASCEND_APP_SECRET };
    const res = await within(`${config.baseUrl}/openApi/query/credit`, 15000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSignedRequest({ orderId: "1000000000000000000" }, config)),
    });
    if (res.status === 401) return false;
    const msg = String((await res.json().catch(() => ({}))).msg ?? "");
    if (/sign/i.test(msg)) return false;
    return /not (found|exist)|no such|invalid order/i.test(msg) ? true : null;
  } catch {
    return null; // could not ask: unknown, not a fault
  }
}

async function healthProblems() {
  try {
    const res = await within(`${env.NEXT_PUBLIC_APP_BASE_URL}/api/health/config`, 15000, {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body.problems) ? body.problems : null;
  } catch {
    return null;
  }
}

// ── Counts from the database (read-only) ──────────────────────────────────

async function counts() {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: env.DATABASE_URL_UNPOOLED });
  await client.connect();
  try {
    const n = async (text, params = [windowMinutes]) => Number((await client.query(text, params)).rows[0].n);
    const since = "now() - make_interval(mins => $1::int)";
    return {
      newApplicants: await n(`select count(*) as n from applicants where created_at > ${since}`),
      // Submitted in the window, not an existing customer sent to the app on purpose, and no order.
      submittedWithoutOrder: await n(
        `select count(*) as n from applicants a
          where a.status <> 'in_progress' and a.updated_at > ${since}
            and a.ascend_new_customer is distinct from false
            and not exists (select 1 from ascend_orders o where o.applicant_id = a.id)`,
      ),
      ascendSkipped: await n(`select count(*) as n from api_logs where tag = '[ascend]skipped' and created_at > ${since}`),
      ascendFailures: await n(
        `select count(*) as n from api_logs
          where tag like '[ascend]/openApi/%' and created_at > ${since}
            and (response_ok is false or error is not null)`,
      ),
      airconnectFailures: await n(
        `select count(*) as n from api_logs
          where url ilike '%airconnect%' and created_at > ${since}
            and (response_ok is false or error is not null)`,
      ),
      passWithoutLimit: await n(
        `select count(*) as n from api_logs where tag = '[ascend-shape]' and error like '%pass_without_limit%' and created_at > ${since}`,
      ),
      singpassRedirects: await n(`select count(*) as n from apply_flow_events where event = 'singpass_redirected' and created_at > ${since}`),
      singpassCallbacks: await n(`select count(*) as n from apply_flow_events where event = 'auth_callback_received' and created_at > ${since}`),
      readerFailures: await n(`select count(*) as n from income_model_calls where report is null and created_at > ${since}`),
      // Not limited to the window: it stays urgent until someone fixes it.
      approvedWithoutLimit: await n(
        `select count(*) as n from ascend_orders where risk_status = 'passed' and coalesce(a_card_limit, 0) = 0 and created_at > now() - interval '1 day'`,
        [],
      ),
    };
  } finally {
    await client.end();
  }
}

// ── Look, then say ────────────────────────────────────────────────────────

const [site, lambda, ascend, health] = await Promise.all([siteOk(), lambdaOk(), ascendCredentialsOk(), healthProblems()]);
let measured;
try {
  measured = await counts();
} catch (error) {
  console.log(`URGENT database_unreachable: could not read the production database (${String(error.message).replace(/postgres(ql)?:\/\/\S+/g, "<url>").slice(0, 120)}).`);
  process.exit(2);
}

const { findingsFrom } = await import(join(ROOT, "lib/monitor/findings.ts"));
const findings = findingsFrom({
  windowMinutes,
  probes: { siteOk: site, lambdaOk: lambda, ascendCredentialsOk: ascend, healthProblems: health },
  counts: measured,
});

const sgt = new Date().toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" });
const urgent = findings.filter((f) => f.level === "urgent");
const warn = findings.filter((f) => f.level === "warn");

if (findings.every((f) => f.level === "info") && flag("quiet")) process.exit(0);

console.log(urgent.length ? `[${sgt} SGT] URGENT (${urgent.length})` : warn.length ? `[${sgt} SGT] LOOK (${warn.length})` : `[${sgt} SGT] ALL CLEAR`);
for (const f of findings) console.log(`  ${f.level.toUpperCase().padEnd(6)} ${f.code}: ${f.message}`);
process.exit(urgent.length ? 2 : warn.length ? 1 : 0);
