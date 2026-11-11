/**
 * A cheap, zero-false-positive screen for a forged MyInfo payload at the auth
 * callback.
 *
 * It blocks ONLY what can never appear in a genuine MyInfo record:
 *   - prototype-pollution keys (`__proto__`, `constructor`, `prototype`), and
 *   - injection characters inside the NRIC or phone (a real NRIC/phone is never
 *     `' OR '1'='1` or `%`).
 *
 * It deliberately does NOT require a phone number, an NRIC checksum, or any
 * completeness: a real customer whose MyInfo is sparse or unusual must still get
 * through. Blocking one genuine login is worse than letting junk through.
 *
 * This is NOT sender authentication. A forger who uses a valid-FORMAT fake
 * identity still passes - only a shared secret (AUTH_CALLBACK_SECRET) or a
 * source-IP allowlist can stop that. This only removes the obvious injection.
 */

type Json = Record<string, unknown>;

const POLLUTION_KEYS = ["__proto__", "constructor", "prototype"];

// Quotes, SQL punctuation, %, backslash, angle brackets, and the bare SQL
// keywords - none of which is valid inside an NRIC or a phone number.
const INJECTION = /['"<>;%()\\]|--|\b(?:or|and|union|select|drop|insert)\b/i;

function unwrap(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof (v as Json).value === "string") {
    return (v as Json).value as string;
  }
  return null;
}

/** FAPI 2.0 (Myinfo v5) nests the person under `person_info`; v3 is flat. */
function person(myinfo: Json): Json {
  const nested = myinfo.person_info;
  return nested && typeof nested === "object" ? (nested as Json) : myinfo;
}

function hasPollutionKey(obj: unknown, depth = 0): boolean {
  if (depth > 6 || !obj || typeof obj !== "object") return false;
  for (const key of POLLUTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return true;
  }
  for (const value of Object.values(obj as Json)) {
    if (hasPollutionKey(value, depth + 1)) return true;
  }
  return false;
}

export function looksLikeForgedMyinfo(myinfo: unknown): boolean {
  if (!myinfo || typeof myinfo !== "object") return false;

  if (hasPollutionKey(myinfo)) return true;

  const p = person(myinfo as Json);

  const nric = unwrap(p.uinfin);
  // A genuine NRIC/FIN is alphanumeric. Anything with a quote, space, `=` etc.
  // is an injection attempt, not a person.
  if (nric && !/^[A-Za-z0-9]{1,24}$/.test(nric)) return true;

  const mobileno = p.mobileno;
  if (mobileno && typeof mobileno === "object") {
    const nbr = unwrap((mobileno as Json).nbr);
    if (nbr && INJECTION.test(nbr)) return true;
  }

  return false;
}
