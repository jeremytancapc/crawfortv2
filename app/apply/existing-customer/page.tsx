import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";

import { ExistingCustomerView } from "./existing-customer-view";

export const dynamic = "force-dynamic";

/**
 * Staging-only "bad case" screen: existing Crawfort customer. This ends the
 * web flow - the mobile app is where an existing customer continues - so
 * there is deliberately no `progressStep` (hides the progress panel/strip),
 * and the next arrow hands off to Singpass exactly like the real "Review
 * Application" CTA would. See `app/apply/bad-case-nav.tsx`.
 */
export default async function ExistingCustomerPage() {
  await enforceApplyFunnel("/apply/existing-customer");

  return <ExistingCustomerView />;
}
