import { NextRequest, NextResponse } from "next/server";

import { applyClearApplyCookiesOnResponse } from "@/lib/clear-apply-cookies-response";
import {
  getFunnelRedirectUrl,
  readFunnelContextFromRequest,
} from "@/lib/apply-funnel";
import { looksLikeLeadUuid } from "@/lib/lead-id";

function isPendingWithLeadId(request: NextRequest): boolean {
  if (!request.nextUrl.pathname.startsWith("/apply/pending")) return false;
  const q = request.nextUrl.searchParams.get("leadId")?.trim() ?? "";
  return Boolean(q && looksLikeLeadUuid(q));
}

function isLandingPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/foreigner" ||
    pathname.startsWith("/foreigner/") ||
    pathname === "/vcsa-sg" ||
    pathname.startsWith("/vcsa-sg/")
  );
}

export function proxy(request: NextRequest) {
  // TEMPORARILY DISABLED — cookie resume from landings (`/` → /apply/approval etc.).
  // Clear funnel cookies so each home visit starts a fresh apply flow for testing.
  // Re-enable by deleting this block.
  if (isLandingPath(request.nextUrl.pathname)) {
    const res = NextResponse.next();
    applyClearApplyCookiesOnResponse(res);
    return res;
  }

  const ctx = readFunnelContextFromRequest(request);
  const target = getFunnelRedirectUrl(ctx);
  const clearPendingCookies = isPendingWithLeadId(request);

  if (target) {
    const url = new URL(target, request.url);
    const res = NextResponse.redirect(url);
    if (clearPendingCookies) {
      applyClearApplyCookiesOnResponse(res);
    }
    return res;
  }

  const res = NextResponse.next();
  if (clearPendingCookies) {
    applyClearApplyCookiesOnResponse(res);
  }
  return res;
}

export const config = {
  matcher: [
    "/",
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
  ],
};
