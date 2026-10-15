/**
 * Read the monthly income off payslips from the command line.
 *
 *   node scripts/read-payslips.mjs ~/Downloads/aug.pdf ~/Downloads/jul.pdf ~/Downloads/jun.pdf
 *   node scripts/read-payslips.mjs s3://some-bucket/some/key.pdf
 *   node scripts/read-payslips.mjs s3://some-bucket/prefix/
 *
 * This is the same reader the funnel uses (lib/income-extraction.ts), run by
 * hand - so what it prints here is exactly what an applicant would get, m1/m2/m3
 * included. Use it to check a specific customer's documents without going
 * through the upload screen.
 *
 * An s3:// argument is fetched with the AWS CLI under YOUR credentials
 * (`aws s3 cp`), so whatever profile/SSO session your shell already has is what
 * reaches the bucket. Set AWS_PROFILE if you need a particular one. Nothing is
 * stored: downloads land in a temp directory that is removed on exit.
 *
 * ANTHROPIC_API_KEY comes from .env.local, so this file holds no secrets.
 */

import "./helpers/quiet-known-warnings.mjs";
import "./helpers/resolve-app-imports.mjs";

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
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
if (args.length === 0) {
  console.error("Usage: node scripts/read-payslips.mjs <file|s3://bucket/key> ...");
  process.exit(1);
}

const MEDIA_TYPES = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

let scratch = null;

/** Local paths pass through; s3:// URIs are copied down first. */
function resolveToLocalFiles(arg) {
  if (!arg.startsWith("s3://")) {
    return statSync(arg).isDirectory()
      ? readdirSync(arg).map((name) => join(arg, name))
      : [arg];
  }

  scratch ??= mkdtempSync(join(tmpdir(), "payslips-"));
  const target = join(scratch, basename(arg.replace(/\/$/, "")) || "download");
  const isPrefix = arg.endsWith("/");
  try {
    execFileSync(
      "aws",
      isPrefix ? ["s3", "cp", "--recursive", arg, target] : ["s3", "cp", arg, target],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
  } catch {
    console.error(
      `\nCould not download ${arg}. The AWS CLI runs under your own credentials -\n` +
        "check `aws sts get-caller-identity`, or set AWS_PROFILE.",
    );
    process.exit(1);
  }
  return isPrefix ? readdirSync(target).map((name) => join(target, name)) : [target];
}

const documents = [];
for (const arg of args) {
  for (const path of resolveToLocalFiles(arg)) {
    const mediaType = MEDIA_TYPES[extname(path).toLowerCase()];
    if (!mediaType) {
      console.error(`Skipping ${basename(path)} - only PDF, JPG and PNG can be read.`);
      continue;
    }
    documents.push({ fileName: basename(path), mediaType, bytes: readFileSync(path) });
  }
}

if (documents.length === 0) {
  console.error("No readable documents.");
  process.exit(1);
}

const { extractIncome, monthParts } = await import(join(ROOT, "lib/income-extraction.ts"));

console.log(`Reading ${documents.length} document(s): ${documents.map((d) => d.fileName).join(", ")}\n`);

const started = Date.now();
let outcome;
try {
  outcome = await extractIncome(documents);
} finally {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
}
const seconds = ((Date.now() - started) / 1000).toFixed(1);

if (outcome.kind === "unreadable") {
  console.log(`UNREADABLE (${seconds}s)\n  ${outcome.reason}`);
  process.exit(2);
}

for (const month of outcome.months) {
  const { month: name, year } = monthParts(month.month);
  const employer = month.employer ? ` — ${month.employer}` : "";
  console.log(`  ${name} ${year}  $${month.amount.toLocaleString("en-SG")}${employer}`);
}
console.log();

if (outcome.kind === "needs_review") {
  console.log(`NEEDS REVIEW (${seconds}s)\n  ${outcome.reason}`);
  process.exit(3);
}

console.log(
  `USABLE (${seconds}s)\n` +
    `  m1 ${outcome.m1}   m2 ${outcome.m2}   m3 ${outcome.m3}\n` +
    `  average $${Math.round((outcome.m1 + outcome.m2 + outcome.m3) / 3).toLocaleString("en-SG")}`,
);
if (outcome.note) console.log(`  note: ${outcome.note}`);
