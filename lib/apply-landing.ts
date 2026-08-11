import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";

/** Call at the top of `/`, `/foreigner`, `/vcsa-sg` before rendering the gate form. */
export async function redirectToApplyContinueIfNeeded(pathname = "/") {
  // TEMPORARILY DISABLED - cookie resume / funnel lock for testing.
  // Also disabled in `proxy.ts` and `enforceApplyFunnel`.
  void pathname;
  void enforceApplyFunnel;
  // await enforceApplyFunnel(pathname);
}
