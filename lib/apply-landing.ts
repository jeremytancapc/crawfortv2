import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";

/** Call at the top of `/`, `/foreigner`, `/vcsa-sg` before rendering the gate form. */
export async function redirectToApplyContinueIfNeeded(pathname = "/") {
  // TEMPORARILY DISABLED - cookie resume is also disabled in `proxy.ts` for landings
  // (that middleware was still redirecting `/` → /apply/approval after this stub).
  // Re-enable both: uncomment below, and remove the landing short-circuit in proxy.ts.
  void pathname;
  void enforceApplyFunnel;
  // await enforceApplyFunnel(pathname);
}
