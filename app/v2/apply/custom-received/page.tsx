import { redirect } from "next/navigation";

import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { applyRedirectPath } from "@/lib/apply-variant-server";
import { leadIdFromQuery, loadCustomOfferDisplay } from "@/lib/load-lead-display";

import { CustomReceivedScreen } from "./custom-received-screen";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ leadId?: string | string[] }>;
}

export default async function V2CustomReceivedPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  await enforceApplyFunnel("/apply/custom-received", sp);

  const leadId = leadIdFromQuery(sp.leadId);
  if (!leadId) redirect(await applyRedirectPath("/"));

  const offer = await loadCustomOfferDisplay(leadId);
  if (!offer) redirect(await applyRedirectPath("/"));

  return <CustomReceivedScreen offer={offer} />;
}
