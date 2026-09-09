import { loadApprovalFormData } from "@/app/apply/approval/load-approval-form";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";

import { ApprovalScreen } from "./approval-screen";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ leadId?: string | string[] }>;
}

export default async function V2ApprovalPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  await enforceApplyFunnel("/apply/approval", sp);

  const formData = await loadApprovalFormData();
  return <ApprovalScreen formData={formData} />;
}
