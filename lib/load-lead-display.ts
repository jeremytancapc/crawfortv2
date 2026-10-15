import type { CustomOfferDisplay } from "@/lib/custom-offer-display";
import { getApplicant } from "@/lib/db/applicants";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import type { PendingDisplay } from "@/lib/pending-display";

/**
 * Server loaders for the confirmation screens. All of them survive reload via
 * `?leadId=` only - apply cookies are cleared by the time they render.
 */

/** First `leadId` query value if it looks like an applicant UUID, else null. */
export function leadIdFromQuery(raw: string | string[] | undefined): string | null {
  const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return value && looksLikeLeadUuid(value) ? value.trim() : null;
}

export async function loadPendingDisplay(leadId: string): Promise<PendingDisplay | null> {
  const applicant = await getApplicant(leadId);
  if (!applicant) return null;

  return {
    leadId,
    fullName: applicant.full_name ?? "",
    // numeric columns arrive as strings, so the conversion is explicit.
    amount: Number(applicant.desired_amount) || 0,
    idType: applicant.id_type ?? "",
  };
}

export async function loadCustomOfferDisplay(
  leadId: string,
): Promise<CustomOfferDisplay | null> {
  const applicant = await getApplicant(leadId);
  if (!applicant) return null;

  return {
    leadId,
    fullName: applicant.full_name ?? "",
    amount: Number(applicant.desired_amount) || 0,
    tenure: Number(applicant.loan_tenure) || 0,
  };
}
