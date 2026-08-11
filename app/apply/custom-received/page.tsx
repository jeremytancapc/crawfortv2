import { redirect } from "next/navigation";

import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { createAdminClient } from "@/lib/db/client";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import type { CustomOfferDisplay } from "@/lib/custom-offer-display";

import { CustomOfferReceivedView } from "./custom-offer-received-view";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ leadId?: string | string[] }>;
}

function pickLeadQuery(raw: string | string[] | undefined): string | undefined {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return undefined;
}

/**
 * Custom offer confirmation (like /apply/pending): survives reload via ?leadId= only.
 * Skips the e-signature/accept flow entirely, since a custom amount/tenure
 * isn't a final approval - staff confirm the exact terms afterwards.
 */
export default async function CustomOfferReceivedPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  await enforceApplyFunnel("/apply/custom-received", sp);

  const qRaw = pickLeadQuery(sp.leadId);
  const leadId = qRaw && looksLikeLeadUuid(qRaw) ? qRaw.trim() : null;

  if (!leadId) {
    redirect("/");
  }

  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("leads")
    .select("full_name, loan_amount, loan_tenure")
    .eq("id", leadId)
    .maybeSingle();

  if (error || !lead) {
    redirect("/");
  }

  const display: CustomOfferDisplay = {
    leadId,
    fullName: (lead.full_name as string) ?? "",
    amount: Number(lead.loan_amount) || 0,
    tenure: Number(lead.loan_tenure) || 0,
  };

  return <CustomOfferReceivedView offer={display} />;
}
