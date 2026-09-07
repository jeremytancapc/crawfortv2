import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";

import { ApprovalView } from "./approval-view";
import { loadApprovalFormData } from "./load-approval-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ leadId?: string | string[] }>;
}

export default async function ApprovalPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  await enforceApplyFunnel("/apply/approval", sp);

  const formData = await loadApprovalFormData();
  return <ApprovalView formData={formData} phase="amount" />;
}
