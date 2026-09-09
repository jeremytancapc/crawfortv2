import { loadApprovalFormData } from "@/app/apply/approval/load-approval-form";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { approvalOfferDisplay } from "@/lib/approval-display";
import { parseWithdrawAmountParam } from "@/lib/withdraw-amount";

import { PlanScreen } from "./plan-screen";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ leadId?: string | string[]; amount?: string | string[] }>;
}

export default async function V2ChoosePlanPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  await enforceApplyFunnel("/apply/choose-plan", sp);

  const formData = await loadApprovalFormData();
  const { withdrawToday } = approvalOfferDisplay(formData);
  const initialWithdrawAmount = parseWithdrawAmountParam(sp.amount, withdrawToday);

  return (
    <PlanScreen formData={formData} initialWithdrawAmount={initialWithdrawAmount ?? undefined} />
  );
}
