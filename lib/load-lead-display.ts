import { createAdminClient } from "@/lib/db/client";
import type { CustomOfferDisplay } from "@/lib/custom-offer-display";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import type { PendingDisplay } from "@/lib/pending-display";

/**
 * Server loaders for the two "we'll be in touch" confirmation screens. Both
 * survive reload via `?leadId=` only - apply cookies are cleared by then.
 */

/** First `leadId` query value if it looks like a lead UUID, else null. */
export function leadIdFromQuery(raw: string | string[] | undefined): string | null {
  const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return value && looksLikeLeadUuid(value) ? value.trim() : null;
}

export async function loadPendingDisplay(leadId: string): Promise<PendingDisplay | null> {
  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("leads")
    .select("full_name, loan_amount, id_type")
    .eq("id", leadId)
    .maybeSingle();

  if (error || !lead) return null;

  return {
    leadId,
    fullName: (lead.full_name as string) ?? "",
    amount: Number(lead.loan_amount) || 0,
    idType: (lead.id_type as string) ?? "",
  };
}

export async function loadCustomOfferDisplay(
  leadId: string,
): Promise<CustomOfferDisplay | null> {
  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("leads")
    .select("full_name, loan_amount, loan_tenure")
    .eq("id", leadId)
    .maybeSingle();

  if (error || !lead) return null;

  return {
    leadId,
    fullName: (lead.full_name as string) ?? "",
    amount: Number(lead.loan_amount) || 0,
    tenure: Number(lead.loan_tenure) || 0,
  };
}
