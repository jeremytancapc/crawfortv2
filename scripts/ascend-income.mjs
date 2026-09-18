/**
 * Submits income against a PENDING order, from the command line.
 *
 *   node scripts/ascend-income.mjs <orderId> <m1> <m2> <m3>
 *   node scripts/ascend-income.mjs 1550194524684099584 4280 4150 4200
 *
 * Exists to test /openApi/income/credit while /openApi/file/upload is broken.
 * `incomeFile` is a boolean - whether a document backs the figures - so income
 * can be submitted with none, which Ascend scores as less credible but does
 * accept. That is the only way past the upload today.
 *
 * Add --with-file <url> once uploads work again, to send the real thing.
 *
 * This MUTATES a real order: it re-scores it, and Ascend refuses a second
 * attempt with `600: order status is not CREATE or ELIGIBILITY`. So it prompts
 * before firing.
 */

import "./helpers/quiet-known-warnings.mjs";
import "./helpers/resolve-app-imports.mjs";

import { createInterface } from "node:readline/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const fileUrlAt = args.indexOf("--with-file");
const fileUrl = fileUrlAt >= 0 ? args[fileUrlAt + 1] : null;
// Drop the flag and its value, not "index 0" - which is what `fileUrlAt + 1`
// resolves to when the flag is absent and fileUrlAt is -1.
const positional = args.filter(
  (a, i) => !a.startsWith("--") && !(fileUrlAt >= 0 && i === fileUrlAt + 1),
);
const [orderId, m1, m2, m3] = positional;

if (!orderId || !m1 || !m2 || !m3) {
  console.error("Usage: node scripts/ascend-income.mjs <orderId> <m1> <m2> <m3> [--with-file <url>]");
  process.exit(1);
}

const { ascendSubmitIncome } = await import(join(ROOT, "lib/ascend/client.ts"));

const months = [Number(m1), Number(m2), Number(m3)];
const average = Number((months.reduce((a, b) => a + b, 0) / 3).toFixed(2));

console.log(`\n  order        ${orderId}`);
console.log(`  m1/m2/m3     ${months.join(" / ")}`);
console.log(`  average      ${average}`);
console.log(`  incomeFile   ${Boolean(fileUrl)}${fileUrl ? "" : "   (no document - Ascend scores this as less credible)"}`);
console.log(`\n  This re-scores the order and cannot be repeated.`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const go = await rl.question("  Submit? [y/N] ");
rl.close();
if (go.trim().toLowerCase() !== "y") {
  console.log("  Cancelled.\n");
  process.exit(0);
}

try {
  const result = await ascendSubmitIncome({
    orderId,
    incomeType: "PANEL_PAYSLIP",
    m1: months[0],
    m2: months[1],
    m3: months[2],
    incomeFile: Boolean(fileUrl),
    files: fileUrl
      ? [{ fileType: "PANEL_PAYSLIP", fileName: fileUrl.split("/").pop() ?? "payslip", fileUrl }]
      : [],
  });
  console.log("\n  ACCEPTED");
  console.log(`  riskStatus   ${result.risk?.riskStatus}`);
  console.log(`  riskMsg      ${result.risk?.riskMsg ?? "-"}`);
  console.log(`  creditLimit  ${result.creditScore?.creditLimit ?? "(none)"}`);
  console.log(`  raw          ${JSON.stringify(result).slice(0, 400)}\n`);
} catch (err) {
  console.log(`\n  REFUSED  ${err.code ?? ""} ${err.msg ?? err.message}\n`);
  process.exit(2);
}
