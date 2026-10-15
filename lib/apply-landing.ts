import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";

/** Call at the top of `/`, `/v2`, `/foreigner`, `/vcsa-sg` before rendering the gate form. */
export async function redirectToApplyContinueIfNeeded(pathname = "/") {
  // Someone mid-application who lands back on a gate page is resumed to where
  // they actually are, rather than being offered a fresh start that would
  // strand the application they already have.
  await enforceApplyFunnel(pathname);
}
