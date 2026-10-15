/**
 * Singapore E.164 formatting. The applicants.mobile column stores whatever
 * format the form/partner gave it (often the bare local number), so any
 * caller sending a phone number to an external system - AirConnect, Ascend -
 * normalizes through here first. Two AirConnect calls for the same applicant
 * disagreeing on format (e.g. "+6591234567" for the lead, "91234567" for the
 * appointment) is exactly the kind of mismatch that breaks matching on their
 * side.
 */
export function toSgE164(mobile: string | null | undefined): string {
  if (!mobile) return "";
  return mobile.startsWith("+") ? mobile : `+65${mobile}`;
}
