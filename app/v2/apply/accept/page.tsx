import { redirect } from "next/navigation";

import { loadSelectedPlan } from "@/app/apply/accept/load-selected-plan";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { applyRedirectPath } from "@/lib/apply-variant-server";
import { parseWithdrawAmountValue } from "@/lib/withdraw-amount";

import { AcceptScreens } from "./accept-screens";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ amount?: string | string[] }>;
}

export default async function V2AcceptPage({ searchParams }: PageProps) {
  await enforceApplyFunnel("/apply/accept");

  const selected = await loadSelectedPlan(
    parseWithdrawAmountValue((await searchParams).amount),
  );
  if (!selected) redirect(await applyRedirectPath("/"));

  return <AcceptScreens plan={selected.plan} leadId={selected.leadId} />;
}
