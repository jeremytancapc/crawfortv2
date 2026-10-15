import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { leadIdFromQuery } from "@/lib/load-lead-display";

import { RejectedView } from "./rejected-view";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ leadId?: string | string[] }>;
}

/**
 * Where a genuine Ascend REJECT lands (decideApplyOutcome), and also the
 * staging "bad case" demo screen - see `app/apply/bad-case-nav.tsx`. The two
 * are told apart by `?leadId=`: a real decline always carries one
 * (postSubmitUrl appends it), a staff member walking the demo chain never
 * does. That is what decides whether the demo's back/next arrows show - a
 * declined applicant has nothing to "continue" to.
 */
export default async function RejectedPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  await enforceApplyFunnel("/apply/rejected", sp);

  const leadId = leadIdFromQuery(sp.leadId);

  return <RejectedView isRealApplicant={Boolean(leadId)} />;
}
