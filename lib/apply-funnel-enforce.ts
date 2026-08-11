/**
 * Single server entry: redirect if cookies say the user belongs on another page.
 * Call at the top of `/`, landing variants, and every `/apply/*` page.
 *
 * TEMPORARILY DISABLED for testing — cookie resume/lock is off so users can
 * restart after visiting the offer page. See also `proxy.ts`.
 *
 * To re-enable, restore the cookie checks + `getFunnelRedirectUrl` redirect
 * (git history / previous implementation).
 */
export async function enforceApplyFunnel(
  pathname: string,
  searchParams?: { leadId?: string | string[] },
): Promise<void> {
  void pathname;
  void searchParams;
}
