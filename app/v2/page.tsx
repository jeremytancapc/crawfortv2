import { LoanSetupScreens } from "@/app/v2/loan-setup/loan-setup-screens";
import { getApplySession } from "@/lib/apply-session";
import { gateInitialSession } from "@/lib/apply-flow-guard";
import { redirectToApplyContinueIfNeeded } from "@/lib/apply-landing";

/**
 * Split-test landing. Same session + funnel rules as `/`, different chrome:
 * the whole `/v2` funnel is a fixed-height, one-job-per-screen flow.
 */
export default async function V2HomePage() {
  const session = await getApplySession();
  await redirectToApplyContinueIfNeeded("/v2");
  return <LoanSetupScreens initialApplySession={gateInitialSession(session)} />;
}
