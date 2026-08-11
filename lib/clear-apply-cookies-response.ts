import type { NextResponse } from "next/server";

import { clearApprovalOfferCookie } from "@/lib/approval-offer";
import { clearCookies } from "@/lib/apply-session-codec";
import { clearBookingConfirmCookie } from "@/lib/booking-confirmation";
import { clearPlanAdditionalRequestsCookie } from "@/lib/plan-additional-requests";

/** Set expired apply funnel cookies on a Route Handler / middleware response. */
export function applyClearApplyCookiesOnResponse<T extends NextResponse>(res: T): T {
  for (const c of clearCookies()) {
    res.cookies.set(c);
  }
  res.cookies.set(clearApprovalOfferCookie());
  res.cookies.set(clearBookingConfirmCookie());
  res.cookies.set(clearPlanAdditionalRequestsCookie());
  return res;
}
