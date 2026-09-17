/**
 * Tries /openApi/file/upload in every shape the documentation allows, so the
 * 500 can be attributed to the endpoint rather than to our request.
 *
 *   node scripts/ascend-upload-probe.mjs <userId> <path-to-file>
 *
 * Credentials come from .env.local. Run scripts/ascend-call.mjs first to get
 * a real userId if you do not have one.
 */

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

const [userId, filePath] = process.argv.slice(2);
if (!userId || !filePath) {
  console.error("usage: ascend-upload-probe.mjs <userId> <path-to-file>");
  process.exit(1);
}
if (!config.baseUrl || !config.appId || !config.secret) {
  console.error("Missing ASCEND_BASE_URL / ASCEND_APP_ID / ASCEND_APP_SECRET in .env.local");
  process.exit(1);
}

const bytes = readFileSync(filePath);
const name = filePath.split("/").pop();
const info = { userId, fileSource: "web", fileBusiness: "income" };

/**
 * Signed fresh for each attempt. `nonce` must be unique per request - reusing
 * one across attempts returns `401: Authentication failed`, which looks like
 * a credentials problem and is not.
 */
function envelope(form) {
  const signed = buildSignedRequest(info, config);
  form.append("appId", signed.appId);
  form.append("timestamp", signed.timestamp);
  form.append("nonce", signed.nonce);
  form.append("sign", signed.sign);
}

const shapes = {
  "documented fileInfo only": (f) => f.append("fileInfo", JSON.stringify(info)),
  "signed envelope, data=info": (f) => { envelope(f); f.append("data", JSON.stringify(info)); },
  "signed envelope + fileInfo": (f) => { envelope(f); f.append("fileInfo", JSON.stringify(info)); },
  "both data and fileInfo": (f) => {
    envelope(f);
    f.append("data", JSON.stringify(info));
    f.append("fileInfo", JSON.stringify(info));
  },
  "flattened fields": (f) => {
    envelope(f);
    f.append("userId", userId);
    f.append("fileSource", "web");
    f.append("fileBusiness", "income");
  },
};

console.log(`▸ ${config.baseUrl}/openApi/file/upload`);
console.log(`  file: ${name} (${bytes.length} bytes)\n`);

for (const [label, build] of Object.entries(shapes)) {
  const form = new FormData();
  form.append("file", new Blob([bytes]), name);
  build(form);

  try {
    const res = await fetch(`${config.baseUrl}/openApi/file/upload`, { method: "POST", body: form });
    const text = await res.text();
    console.log(`  ${label.padEnd(30)} HTTP ${res.status}  ${text.slice(0, 90)}`);
  } catch (err) {
    console.log(`  ${label.padEnd(30)} threw  ${err.message}`);
  }
}

console.log("\n  For reference: a malformed request returns 502, a bad signature 600.");
console.log("  scripts/ascend-call.mjs signs identically and /openApi/users succeeds.");
