/**
 * The links Ascend is given for an applicant's payslips.
 *
 * Ascend needs a URL it can fetch, and the two obvious answers are both bad.
 * A presigned S3 link expires, which would leave a credit decision with no
 * retrievable evidence behind it - unacceptable for a licensed moneylender
 * whose records are kept for years. A long-lived presigned link is worse: a
 * public URL to someone's NRIC, address and bank details, valid for months,
 * to anyone who comes across it.
 *
 * So the link points at us. The token names the object and is signed, the
 * bucket stays closed to the world, and the endpoint serving it decides who
 * may read what - which can be changed later without asking Ascend to update
 * anything they have stored.
 *
 * The signature is what makes the link unguessable AND unforgeable: holding
 * one link must not be enough to mint another for a different applicant.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** `<base64url(key)>.<base64url(hmac)>` - safe in a path segment. */
export function signDocumentToken(objectKey: string, secret: string): string {
  const payload = Buffer.from(objectKey, "utf8").toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

/** The object this token names, or null if it was not signed by us. */
export function readDocumentToken(token: string, secret: string): string | null {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, provided] = parts;
  if (!payload || !provided) return null;

  const expected = signature(payload, secret);
  // Constant-time: a fast rejection tells an attacker how much of a guess was
  // right, which is how a signature gets brute-forced one byte at a time.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const key = Buffer.from(payload, "base64url").toString("utf8");
  return key.length > 0 && !key.includes("..") ? key : null;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Where an applicant's document lives in the bucket.
 *
 * Grouped by applicant so everything about one person can be found, or
 * deleted, together. The applicant's own filename is deliberately discarded:
 * it arrives from their phone, and in real uploads it has contained path
 * traversal, spaces, and - more than once - their NRIC. A random name cannot
 * collide either, so re-uploading the same payslip never overwrites the first.
 */
export function documentKey(applicantId: string, fileName: string): string {
  const extension = /\.(pdf|jpe?g|png)$/i.exec(fileName)?.[0].toLowerCase() ?? ".bin";
  return `applicants/${applicantId}/${randomBytes(16).toString("hex")}${extension}`;
}
