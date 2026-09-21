import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";

import { PendingReviewView } from "./pending-review-view";

export const dynamic = "force-dynamic";

/**
 * Staging-only "bad case" screen: manual verification pending. Sits between
 * the income-verification step and the real review page so the demo can show
 * every outcome (pending → rejected → existing customer) before continuing
 * on to Singpass. See `app/apply/bad-case-nav.tsx`.
 */
export default async function PendingReviewPage() {
  await enforceApplyFunnel("/apply/pending-review");

  return <PendingReviewView />;
}
