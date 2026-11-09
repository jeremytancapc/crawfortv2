/**
 * Singapore mobile numbers: validating them, and formatting them for the
 * systems downstream.
 *
 * `toSgE164` formats; it has never validated. On 8 Nov 2026 that showed:
 * `' OR '1'='1` and `%` arrived in the mobile field, were stored verbatim as
 * applicants, and would have been passed on to AirConnect and Ascend had those
 * journeys gone a step further. Our own SQL binds every value, so neither was
 * ever SQL here - but we are not the last system to read them, and `%` is a
 * LIKE wildcard in whichever one does.
 *
 * The funnel checked `/^[89]\d{7}$/` in the browser and nowhere else, so
 * skipping the form skipped the check. Validation belongs on this side.
 */

/** Digits and a leading `+` only; people and partners send spaces and dashes. */
function strip(mobile: string): string {
  return mobile.replace(/[\s()-]/g, "");
}

/**
 * The bare 8-digit local number, or null when the input is not a Singapore
 * mobile. Accepts the three shapes that actually arrive - `91234567`,
 * `6591234567`, `+6591234567` - and nothing else.
 *
 * Null is the caller's cue to refuse the value, not to repair it: a number we
 * cannot read is one we cannot reach the applicant on either.
 */
export function sgMobileOrNull(mobile: string | null | undefined): string | null {
  if (!mobile) return null;

  const cleaned = strip(mobile);
  const local = cleaned.startsWith("+65")
    ? cleaned.slice(3)
    : cleaned.startsWith("65") && cleaned.length === 10
      ? cleaned.slice(2)
      : cleaned;

  // Mobile lines in Singapore begin 8 or 9 and are eight digits long.
  return /^[89]\d{7}$/.test(local) ? local : null;
}

/** Whether this is a Singapore mobile number we are willing to store. */
export function isValidSgMobile(mobile: string | null | undefined): boolean {
  return sgMobileOrNull(mobile) !== null;
}

/**
 * Singapore E.164 formatting. The applicants.mobile column stores whatever
 * format the form/partner gave it (often the bare local number), so any
 * caller sending a phone number to an external system - AirConnect, Ascend -
 * normalizes through here first. Two AirConnect calls for the same applicant
 * disagreeing on format (e.g. "+6591234567" for the lead, "91234567" for the
 * appointment) is exactly the kind of mismatch that breaks matching on their
 * side.
 *
 * Formatting only, deliberately unchanged: callers that must not pass an
 * unchecked value on validate with `sgMobileOrNull` first.
 */
export function toSgE164(mobile: string | null | undefined): string {
  if (!mobile) return "";
  return mobile.startsWith("+") ? mobile : `+65${mobile}`;
}
