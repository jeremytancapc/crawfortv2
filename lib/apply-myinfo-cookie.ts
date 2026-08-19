import { createHmac, timingSafeEqual } from "crypto";
import { gunzipSync, gzipSync } from "zlib";

import { COOKIE_BASE_OPTS, MYINFO_COOKIE } from "@/lib/apply-session-codec";
import type { CpfContribution, LoanFormData, NoaRecord } from "@/lib/loan-form";

export { MYINFO_COOKIE };

/**
 * Signed, gzip-compressed cookie that carries processed CPF/NOA across
 * serverless isolates. The session cookie is slimmed to stay under 4 KB;
 * the in-memory store used for myinfo_profiles does not survive a new
 * deploy instance, so review hydration has to read this instead.
 */

export type MyinfoCookiePayload = {
  cpfContributions: CpfContribution[];
  noaHistory: NoaRecord[];
  dob: string;
};

function secret(): string {
  return process.env.APPLY_SESSION_SECRET ?? "dev-insecure-secret-32chars-xx";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function buildMyinfoCookiePayload(
  session: Partial<LoanFormData>,
): MyinfoCookiePayload | null {
  const cpfContributions = session.cpfContributions ?? [];
  const noaHistory = session.noaHistory ?? [];
  if (cpfContributions.length === 0 && noaHistory.length === 0) return null;
  return {
    cpfContributions,
    noaHistory,
    dob: session.dob ?? "",
  };
}

export function encodeMyinfoCookie(data: MyinfoCookiePayload): string {
  const compressed = gzipSync(Buffer.from(JSON.stringify(data)), { level: 9 });
  const payload = compressed.toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeMyinfoCookie(raw: string): MyinfoCookiePayload | null {
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;

  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const json = gunzipSync(Buffer.from(payload, "base64url")).toString();
    const parsed = JSON.parse(json) as Partial<MyinfoCookiePayload>;
    return {
      cpfContributions: parsed.cpfContributions ?? [],
      noaHistory: parsed.noaHistory ?? [],
      dob: parsed.dob ?? "",
    };
  } catch {
    return null;
  }
}

export function myinfoCookieValue(data: MyinfoCookiePayload) {
  return { name: MYINFO_COOKIE, value: encodeMyinfoCookie(data), ...COOKIE_BASE_OPTS };
}

export function clearMyinfoCookie() {
  return { name: MYINFO_COOKIE, value: "", maxAge: 0, path: "/" };
}
