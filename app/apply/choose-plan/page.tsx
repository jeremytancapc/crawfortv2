import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { approvalOfferDisplay } from "@/lib/approval-display";
import { parseWithdrawAmountParam } from "@/lib/withdraw-amount";

import { ApprovalView } from "../approval/approval-view";
import { loadApprovalFormData } from "../approval/load-approval-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ leadId?: string | string[]; amount?: string | string[] }>;
}

export default async function ChoosePlanPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  await enforceApplyFunnel("/apply/choose-plan", sp);

  const formData = await loadApprovalFormData();
  const { withdrawToday } = approvalOfferDisplay(formData);
  const initialWithdrawAmount = parseWithdrawAmountParam(sp.amount, withdrawToday);

  return (
    <ApprovalView
      formData={formData}
      phase="plan"
      initialWithdrawAmount={initialWithdrawAmount ?? undefined}
    />
  );
}
