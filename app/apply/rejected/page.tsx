import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";

import { RejectedView } from "./rejected-view";

export const dynamic = "force-dynamic";

/**
 * Staging-only "bad case" screen: generic rejection. See
 * `app/apply/bad-case-nav.tsx` for why this is not a real funnel step.
 */
export default async function RejectedPage() {
  await enforceApplyFunnel("/apply/rejected");

  return <RejectedView />;
}
