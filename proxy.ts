import { NextRequest, NextResponse } from "next/server";

import { applyClearApplyCookiesOnResponse } from "@/lib/clear-apply-cookies-response";
import { applyVariantCookie, variantFromPathname } from "@/lib/apply-paths";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import {
  getFunnelRedirectUrl,
  readFunnelContextFromRequest,
} from "@/lib/apply-funnel";

/** Exact segment match only - `/apply/pending-review` (a staging "bad case"
 *  page, not the real pending screen) must never satisfy this. */
function isPendingPath(pathname: string): boolean {
  return (
    pathname === "/apply/pending" ||
    pathname.startsWith("/apply/pending/") ||
    pathname === "/v2/apply/pending" ||
    pathname.startsWith("/v2/apply/pending/")
  );
}

function isPendingWithLeadId(request: NextRequest): boolean {
  if (!isPendingPath(request.nextUrl.pathname)) return false;
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
 * Keeps an applicant on the page their cookies say they belong on.
 *
 * Two behaviours were switched off together while the funnel was being
 * tested: the resume redirect, and - in its place - a blanket cookie clear on
 * every landing visit so each one started fresh. Both are restored, so
 * visiting `/` mid-application resumes rather than silently abandoning an
 * application that already exists.
 *
 * `/apply/pending?leadId=` still clears: that page is the end of a journey,
 * and its link is what a customer returns to.
 */
export function proxy(request: NextRequest) {
  const variant = variantFromPathname(request.nextUrl.pathname);
  const clearPendingCookies = isPendingWithLeadId(request);

  const target = getFunnelRedirectUrl(readFunnelContextFromRequest(request));
  if (target) {
    const res = NextResponse.redirect(new URL(target, request.url));
    res.cookies.set(applyVariantCookie(variant));
    if (clearPendingCookies) applyClearApplyCookiesOnResponse(res);
    return res;
  }

  const res = NextResponse.next();
  res.cookies.set(applyVariantCookie(variant));
  if (clearPendingCookies) {
    applyClearApplyCookiesOnResponse(res);
    res.cookies.set(applyVariantCookie(variant));
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
    "/apply/verify-income",
    "/apply/verify-income/:path*",
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
