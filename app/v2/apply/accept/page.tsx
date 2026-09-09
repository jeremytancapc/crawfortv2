import { redirect } from "next/navigation";

import { loadSelectedPlan } from "@/app/apply/accept/load-selected-plan";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { applyRedirectPath } from "@/lib/apply-variant-server";

import { AcceptScreens } from "./accept-screens";

export const dynamic = "force-dynamic";

export default async function V2AcceptPage() {
  await enforceApplyFunnel("/apply/accept");

  const selected = await loadSelectedPlan();
  if (!selected) redirect(await applyRedirectPath("/"));

  return <AcceptScreens plan={selected.plan} leadId={selected.leadId} />;
}
