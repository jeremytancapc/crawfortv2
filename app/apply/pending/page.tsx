import { redirect } from "next/navigation";

import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { leadIdFromQuery, loadPendingDisplay } from "@/lib/load-lead-display";

import { applyRedirectPath } from "@/lib/apply-variant-server";

import { PendingView } from "./pending-view";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ leadId?: string | string[] }>;
}

/**
 * Pending confirmation (like /apply/booked): survives reload via ?leadId= only.
 * Apply cookies are cleared in middleware + submit response (not here - RSC cannot mutate cookies).
 */
export default async function PendingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  await enforceApplyFunnel("/apply/pending", sp);

  const leadId = leadIdFromQuery(sp.leadId);
  if (!leadId) redirect(await applyRedirectPath("/"));

  const pending = await loadPendingDisplay(leadId);
  if (!pending) redirect(await applyRedirectPath("/"));

  return <PendingView pending={pending} />;
}
