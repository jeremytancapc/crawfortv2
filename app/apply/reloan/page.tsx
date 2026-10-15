import { leadIdFromQuery, loadPendingDisplay } from "@/lib/load-lead-display";

import { ReloanView } from "./reloan-view";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ leadId?: string | string[] }>;
}

/**
 * Where Ascend's `newCustomer: false` sends a returning borrower.
 *
 * Deliberately not behind enforceApplyFunnel: an applicant is routed here
 * mid-funnel and their apply cookies may already be cleared, and bouncing an
 * existing customer back to the start would be the worst possible answer to
 * "welcome back". The name is the only thing loaded, and only to greet them.
 */
export default async function ReloanPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const leadId = leadIdFromQuery(sp.leadId);
  const lead = leadId ? await loadPendingDisplay(leadId) : null;

  return <ReloanView reloan={{ fullName: lead?.fullName ?? null }} />;
}
