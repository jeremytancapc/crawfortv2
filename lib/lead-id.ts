/** Customer-facing application reference: `CFH5-` + last 8 chars of the lead id. */
export function leadReference(leadId: string): string {
  return `CFH5-${leadId.slice(-8).toUpperCase()}`;
}

/** Loose UUID check for lead IDs from query strings (defensive only). */
export function looksLikeLeadUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}
