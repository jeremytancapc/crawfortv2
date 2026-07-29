import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";

/** Call at the top of `/`, `/foreigner`, `/vcsa-sg` before rendering the gate form. */
export async function redirectToApplyContinueIfNeeded(pathname = "/") {
  // TEMPORARILY DISABLED — cookie-based resume redirect to /apply/approval (etc.).
  // Re-enable for production by uncommenting the line below.
  void pathname;
  void enforceApplyFunnel;
  // await enforceApplyFunnel(pathname);
}
