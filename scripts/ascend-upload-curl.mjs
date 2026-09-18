/**
 * Prints a ready-to-run curl for /openApi/file/upload, freshly signed.
 *
 *   node scripts/ascend-upload-curl.mjs <userId> <path-to-pdf>
 *   node scripts/ascend-upload-curl.mjs 1550194515653763072 ~/Downloads/payslip.pdf
 *
 * The signature covers a timestamp, and Ascend rejects one more than five
 * minutes from its own clock - so the command this prints is only good for
 * about five minutes. Re-run this to get another. That is also why a curl for
 * this endpoint cannot simply be written by hand.
 *
 * Add --run to fire it here instead of printing it.
 *
 * Credentials come from .env.local, so this file holds no secrets.
 */

import "./helpers/quiet-known-warnings.mjs";
import "./helpers/resolve-app-imports.mjs";

import { readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const run = args.includes("--run");
const [userId, filePath] = args.filter((a) => !a.startsWith("--"));

if (!userId || !filePath) {
  console.error("Usage: node scripts/ascend-upload-curl.mjs <userId> <path-to-pdf> [--run]");
  process.exit(1);
}

const config = {
  baseUrl: (process.env.ASCEND_BASE_URL ?? "").replace(/\/+$/, ""),
  appId: process.env.ASCEND_APP_ID ?? "",
  secret: process.env.ASCEND_APP_SECRET ?? "",
};
const missing = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

try {
  statSync(filePath);
} catch {
  console.error(`No such file: ${filePath}`);
  process.exit(1);
}

const { buildSignedRequest } = await import(join(ROOT, "lib/ascend/sign.ts"));

// Exactly what the application sends: fileInfo is the signed payload, and the
// envelope fields travel beside it rather than wrapping it.
const fileInfo = { userId, fileSource: "web", fileBusiness: "income" };
// Signed as `fileInfo`: this endpoint verifies against the field name it
// sends the payload under, not `data`.
const signed = buildSignedRequest(fileInfo, config, { payloadKey: "fileInfo" });
const url = `${config.baseUrl}/openApi/file/upload`;

const curl = [
  `curl -i --location '${url}'`,
  `  --form 'file=@"${filePath}"'`,
  `  --form 'fileInfo=${JSON.stringify(fileInfo)}'`,
  `  --form 'appId=${signed.appId}'`,
  `  --form 'timestamp=${signed.timestamp}'`,
  `  --form 'nonce=${signed.nonce}'`,
  `  --form 'sign=${signed.sign}'`,
].join(" \\\n");

if (!run) {
  console.log(`\n# Signed at ${new Date(Number(signed.timestamp)).toISOString()} - valid for ~5 minutes.\n`);
  console.log(curl);
  // The real signing string, built the way the signature was - not reassembled
  // here, which is how this line came to print `data` last instead of in its
  // ASCII place between appId and nonce.
  const { buildSignString } = await import(join(ROOT, "lib/ascend/sign.ts"));
  console.log(
    "\n# String that was signed (keys in ASCII order, as the rule requires):\n#   " +
      buildSignString({
        appId: signed.appId,
        timestamp: signed.timestamp,
        nonce: signed.nonce,
        fileInfo: JSON.stringify(fileInfo),
      }) +
      "\n",
  );
  process.exit(0);
}

const form = new FormData();
form.append("file", new Blob([readFileSync(filePath)], { type: "application/pdf" }), basename(filePath));
form.append("fileInfo", JSON.stringify(fileInfo));
form.append("appId", signed.appId);
form.append("timestamp", signed.timestamp);
form.append("nonce", signed.nonce);
form.append("sign", signed.sign);

const res = await fetch(url, { method: "POST", body: form });
const text = await res.text();
console.log(`HTTP ${res.status}`);
console.log(text.slice(0, 1000));
process.exit(res.ok && !text.includes('"500"') ? 0 : 2);
