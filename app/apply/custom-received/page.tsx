import { redirect } from "next/navigation";

import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { leadIdFromQuery, loadCustomOfferDisplay } from "@/lib/load-lead-display";

import { applyRedirectPath } from "@/lib/apply-variant-server";

import { CustomOfferReceivedView } from "./custom-offer-received-view";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ leadId?: string | string[] }>;
}

/**
 * Custom offer confirmation (like /apply/pending): survives reload via ?leadId= only.
 * Skips the e-signature/accept flow entirely, since a custom amount/tenure
 * isn't a final approval - staff confirm the exact terms afterwards.
 */
export default async function CustomOfferReceivedPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  await enforceApplyFunnel("/apply/custom-received", sp);

  const leadId = leadIdFromQuery(sp.leadId);
  if (!leadId) redirect(await applyRedirectPath("/"));

  const display = await loadCustomOfferDisplay(leadId);
  if (!display) redirect(await applyRedirectPath("/"));

  return <CustomOfferReceivedView offer={display} />;
}
