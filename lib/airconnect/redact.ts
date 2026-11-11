/**
 * Redacts personal data from an AirConnect request body before it is written to
 * the api_logs table. The lead/appointment bodies carry a customer's name and
 * mobile; api_logs is for diagnostics, so the key names are kept but the PII
 * values are masked. Mirrors what the Ascend client does with redactAscendRequest.
 */

const PII_KEYS = new Set(
  [
    "customerName",
    "name",
    "fullName",
    "phoneNumber",
    "mobile",
    "phone",
    "contactNumber",
    "nric",
    "uinfin",
    "email",
    "dob",
    "dateOfBirth",
    "address",
  ].map((k) => k.toLowerCase()),
);

export function redactAirconnectBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    out[key] =
      PII_KEYS.has(key.toLowerCase()) && value != null && value !== ""
        ? "[redacted]"
        : value;
  }
  return out;
}
