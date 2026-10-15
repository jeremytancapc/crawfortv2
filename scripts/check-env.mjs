/**
 * Keeps .env.example honest.
 *
 * Fails when:
 *   1. The code reads a variable no template documents. That variable is
 *      then undefined in production and nobody finds out until the feature
 *      it gates quietly does nothing.
 *   2. A per-environment template drifts from the canonical file - a
 *      variable missing from one environment is the same silent failure.
 *   3. A template looks like it contains a real secret. These files are
 *      committed; a value that leaks here leaks permanently.
 *
 * Usage: node scripts/check-env.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CANONICAL = ".env.example";
const TEMPLATES = [".env.local.example", ".env.stg.example", ".env.production.example"];

/** Supplied by the platform or the shell, never set by us. */
const PROVIDED = new Set(["NODE_ENV", "VERCEL_ENV", "VERCEL_DEPLOYMENT_ID", "VERCEL_URL"]);

/** Internal switches for a single script, not deployment configuration. */
const INTERNAL = new Set(["SINGPASS_KEYGEN_JSON"]);

const SOURCE_DIRS = ["app", "lib", "scripts"];
const SOURCE_EXT = /\.(ts|tsx|mjs|js)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry)) out.push(full);
  }
  return out;
}

function varsUsedInCode() {
  const found = new Map(); // name -> first file that reads it
  for (const dir of SOURCE_DIRS) {
    let files;
    try {
      files = walk(join(ROOT, dir));
    } catch {
      continue;
    }
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/process\.env\.([A-Z_0-9]+)/g)) {
        if (!found.has(m[1])) found.set(m[1], file.slice(ROOT.length + 1));
      }
    }
  }
  return found;
}

function varsIn(file) {
  const names = new Set();
  try {
    for (const line of readFileSync(join(ROOT, file), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_0-9]+)=/);
      if (m) names.add(m[1]);
    }
  } catch {
    return null;
  }
  return names;
}

/**
 * Values that look real rather than like placeholders. Deliberately narrow:
 * a checker that cries wolf gets switched off.
 */
function suspiciousValues(file) {
  const hits = [];
  const patterns = [
    [/^postgres(ql)?:\/\/[^<\s]*:[^<@\s]+@/, "a database password"],
    [/\bnpg_[A-Za-z0-9]{10,}/, "a Neon token"],
    [/"d"\s*:\s*"[A-Za-z0-9_-]{30,}"/, "a private key (JWK 'd' member)"],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a PEM private key"],
    [/\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}/, "an API secret key"],
  ];
  let lineNo = 0;
  for (const line of readFileSync(join(ROOT, file), "utf8").split("\n")) {
    lineNo += 1;
    if (line.trimStart().startsWith("#")) continue;
    for (const [re, what] of patterns) {
      if (re.test(line)) hits.push({ line: lineNo, what, name: line.split("=")[0] });
    }
  }
  return hits;
}

const problems = [];

// 1. Everything the code reads must be documented.
const canonical = varsIn(CANONICAL);
if (!canonical) {
  problems.push(`${CANONICAL} is missing.`);
} else {
  for (const [name, file] of varsUsedInCode()) {
    if (PROVIDED.has(name) || INTERNAL.has(name)) continue;
    if (!canonical.has(name)) {
      problems.push(`${name} is read in ${file} but not documented in ${CANONICAL}.`);
    }
  }
}

// 2. Per-environment templates must cover the same ground.
for (const template of TEMPLATES) {
  const names = varsIn(template);
  if (!names) {
    problems.push(`${template} is missing.`);
    continue;
  }
  if (!canonical) continue;
  for (const name of canonical) {
    // Tuning knobs with a working default, and test-only variables, need not
    // appear in every per-environment template.
    if (name === "DATABASE_POOL_MAX" || name === "TEST_DATABASE_URL") continue;
    if (!names.has(name)) problems.push(`${name} is in ${CANONICAL} but missing from ${template}.`);
  }
  for (const name of names) {
    if (!canonical.has(name)) problems.push(`${name} is in ${template} but not in ${CANONICAL}.`);
  }
}

// 3. No template may carry a real value.
for (const file of [CANONICAL, ...TEMPLATES]) {
  for (const hit of suspiciousValues(file)) {
    problems.push(`${file}:${hit.line} ${hit.name} looks like ${hit.what}. These files are committed.`);
  }
}

if (problems.length) {
  console.error("Environment templates are out of date:\n");
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(`\n${problems.length} problem(s).`);
  process.exit(1);
}

console.log(`✓ ${canonical.size} variables documented, ${TEMPLATES.length} templates in step, no secrets.`);
