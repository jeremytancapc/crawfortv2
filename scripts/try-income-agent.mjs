/**
 * Run the income agent over documents by hand, next to the live rules.
 *
 *   node scripts/try-income-agent.mjs --name "TAN MEI" --employment EMPLOYED slip.pdf [more files]
 *
 * Prints what the rules decide and what the agent would (lib/income-agent.ts),
 * and whether they agree. Nothing is stored. Calls the model, so it costs a
 * few cents; ANTHROPIC_API_KEY comes from .env.local.
 *
 *   --name        the Singpass name the documents must belong to (required)
 *   --employment  employment status as on the application (default EMPLOYED)
 *   --today       YYYY-MM-DD the rules run against (default: today)
 */

import "./helpers/quiet-known-warnings.mjs";
import "./helpers/resolve-app-imports.mjs";

import { readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

try {
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  // .env.local is optional - ANTHROPIC_API_KEY may already be exported.
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set (add it to .env.local or export it).");
  process.exit(1);
}

const args = process.argv.slice(2);
const flags = {};
const files = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i].startsWith("--")) flags[args[i].slice(2)] = args[(i += 1)];
  else files.push(args[i]);
}
if (!flags.name || files.length === 0) {
  console.error('Usage: node scripts/try-income-agent.mjs --name "TAN MEI" [--employment EMPLOYED] [--today 2026-10-24] <file> ...');
  process.exit(1);
}

const MEDIA_TYPES = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
const documents = files.map((path) => ({
  fileName: basename(path),
  mediaType: MEDIA_TYPES[extname(path).toLowerCase()],
  bytes: readFileSync(path),
}));
if (documents.some((d) => !d.mediaType)) {
  console.error("Only PDF, JPG and PNG can be read.");
  process.exit(1);
}

const { readAndDecide } = await import(join(ROOT, "lib/income-extraction.ts"));
const { runIncomeAgent } = await import(join(ROOT, "lib/income-agent.ts"));

const today = flags.today ? new Date(`${flags.today}T00:00:00+08:00`) : new Date();
const applicant = { name: flags.name };
const employmentType = flags.employment ?? "EMPLOYED";

const { outcome } = await readAndDecide(documents, { today, applicant, employmentType });
const rules = { kind: outcome.kind, reason: outcome.kind === "usable" ? null : outcome.reason };
console.log(`RULES  ${rules.kind}${rules.reason ? `\n       ${rules.reason}` : ""}\n`);

const run = await runIncomeAgent(documents, { applicant, employmentType, today }, rules);
if (run.error) console.log(`ERROR  ${run.error}`);
if (run.decision) {
  console.log(`AGENT  ${run.decision.outcome}  [${run.decision.reasonCodes.join(", ")}]`);
  console.log(`       tell the customer: ${run.decision.customerMessage || "(nothing)"}`);
  console.log(`       evidence: ${run.decision.evidence}`);
} else {
  console.log(`AGENT  no decision (${run.stopReason})`);
}
console.log(
  `\nagrees with rules: ${run.agrees}   turns: ${run.turns}   tools: ${run.toolCalls.join(" > ")}\n` +
    `tokens in/out: ${run.usage.inputTokens}/${run.usage.outputTokens}   ${(run.latencyMs / 1000).toFixed(1)}s`,
);
