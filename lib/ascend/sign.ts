/**
 * Request signing for the Ascend Open API.
 *
 * HMAC-SHA256 over the sorted request parameters. Four details are not in
 * Ascend's written spec and were established against the live endpoint - each
 * one of them fails the call on its own:
 *
 *   1. The digest is UPPERCASE hex. Lowercase or base64 returns code 600.
 *   2. `data` participates in the signed string, as its JSON string.
 *      Omitting it returns code 600.
 *   3. `data` is sent in the body as an OBJECT, not as that string.
 *      Sending the string returns code 505.
 *   4. Our credentials are accepted on `test` only; uat returns 401.
 *
 * Points 2 and 3 together are the trap: the same field is a string when signed
 * and an object when sent, so the two representations must be built from one
 * serialisation and never re-derived.
 */

import { createHmac } from "crypto";
import { randomUUID } from "crypto";

import type { AscendConfig } from "./config";

/** The envelope Ascend expects, with `data` as an object. */
export type SignedRequest = {
  appId: string;
  timestamp: string;
  nonce: string;
  data: Record<string, unknown>;
  sign: string;
};

/**
 * Builds the string that gets signed: `sign` excluded, empty values dropped,
 * keys in ASCII order, joined as `key=value` with `&`.
 */
export function buildSignString(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== "sign")
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

/** HMAC-SHA256, uppercase hex. Lowercase is rejected with code 600. */
export function signParams(params: Record<string, string>, secret: string): string {
  return createHmac("sha256", secret).update(buildSignString(params)).digest("hex").toUpperCase();
}

/**
 * Wraps a data object into a signed Ascend envelope.
 *
 * `timestamp` and `nonce` are injectable so tests can assert an exact
 * signature; in production they are the current time in milliseconds and a
 * fresh UUID. Ascend rejects a timestamp more than five minutes from its own
 * clock.
 */
export function buildSignedRequest(
  data: Record<string, unknown>,
  config: AscendConfig,
  overrides?: { timestamp?: string; nonce?: string },
): SignedRequest {
  const timestamp = overrides?.timestamp ?? String(Date.now());
  const nonce = overrides?.nonce ?? randomUUID();

  // One serialisation, used for the signature and then sent as the object it
  // came from. Re-stringifying elsewhere risks a different key order and a
  // signature that no longer matches the body.
  const dataJson = JSON.stringify(data);

  const sign = signParams(
    { appId: config.appId, timestamp, nonce, data: dataJson },
    config.secret,
  );

  return { appId: config.appId, timestamp, nonce, data, sign };
}
