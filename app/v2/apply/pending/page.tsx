import { redirect } from "next/navigation";

import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { applyRedirectPath } from "@/lib/apply-variant-server";
import { leadIdFromQuery, loadPendingDisplay } from "@/lib/load-lead-display";

import { PendingScreen } from "./pending-screen";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ leadId?: string | string[] }>;
}

export default async function V2PendingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  await enforceApplyFunnel("/apply/pending", sp);

  const leadId = leadIdFromQuery(sp.leadId);
  if (!leadId) redirect(await applyRedirectPath("/"));

  const pending = await loadPendingDisplay(leadId);
  if (!pending) redirect(await applyRedirectPath("/"));

  return <PendingScreen pending={pending} />;
}
