import { NextRequest, NextResponse } from "next/server";

import { applyClearApplyCookiesOnResponse } from "@/lib/clear-apply-cookies-response";
import { applyVariantCookie, variantFromPathname } from "@/lib/apply-paths";
import { looksLikeLeadUuid } from "@/lib/lead-id";

function isPendingWithLeadId(request: NextRequest): boolean {
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/apply/pending") && !path.startsWith("/v2/apply/pending")) {
    return false;
  }
  const q = request.nextUrl.searchParams.get("leadId")?.trim() ?? "";
  return Boolean(q && looksLikeLeadUuid(q));
}

function isLandingPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/v2" ||
    pathname === "/foreigner" ||
    pathname.startsWith("/foreigner/") ||
    pathname === "/vcsa-sg" ||
    pathname.startsWith("/vcsa-sg/")
  );
}

/**
 * TEMPORARILY DISABLED funnel cookie lock for testing.
 *
 * - Landings (and pending?leadId=) clear apply/offer/booking cookies so a home
 *   visit always starts a fresh flow.
 * - Funnel redirects that bounce users to /apply/approval or /apply/booked are
 *   skipped.
 *
 * Re-enable production resume redirects via git history when testing is done.
 * Also re-enable `enforceApplyFunnel` in `lib/apply-funnel-enforce.ts`.
 */
export function proxy(request: NextRequest) {
  const variant = variantFromPathname(request.nextUrl.pathname);
  const res = NextResponse.next();
  res.cookies.set(applyVariantCookie(variant));

  if (isLandingPath(request.nextUrl.pathname) || isPendingWithLeadId(request)) {
    applyClearApplyCookiesOnResponse(res);
    res.cookies.set(applyVariantCookie(variant));
    return res;
  }

  return res;
}

export const config = {
  matcher: [
    "/",
    "/v2",
    "/foreigner",
    "/foreigner/:path*",
    "/vcsa-sg",
    "/vcsa-sg/:path*",
    "/apply/review",
    "/apply/review/:path*",
    "/apply/approval",
    "/apply/approval/:path*",
    "/apply/pending",
    "/apply/pending/:path*",
    "/apply/book",
    "/apply/book/:path*",
    "/apply/booked",
    "/apply/booked/:path*",
    "/v2/apply/:path*",
  ],
};
