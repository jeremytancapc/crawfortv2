import { redirect } from "next/navigation";

import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { applyRedirectPath } from "@/lib/apply-variant-server";

import { AcceptView } from "./accept-view";
import { loadSelectedPlan } from "./load-selected-plan";

export type { SelectedPlanData } from "./load-selected-plan";

export const dynamic = "force-dynamic";

export default async function AcceptPage() {
  await enforceApplyFunnel("/apply/accept");

  const selected = await loadSelectedPlan();
  if (!selected) redirect(await applyRedirectPath("/"));

  // Computed server-side (rather than `new Date()` in the client component)
  // so the SSR and hydration passes render the exact same timestamp.
  const acceptedAt = new Date().toISOString();

  return (
    <AcceptView plan={selected.plan} leadId={selected.leadId} acceptedAt={acceptedAt} />
  );
}
