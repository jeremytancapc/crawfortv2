/**
 * POST /api/apply/decline-reason
 *
 * Records why a customer declined their offer, on their own lead record.
 * Body: { leadId, reason }
 *
 * Authorisation: the caller must hold a cookie that proves this is their own
 * application - the apply session or the approval-offer cookie, the same cookies
 * every other /api/apply write relies on. Without a matching cookie the request
 * is ignored silently (a generic 200), so an unauthenticated caller cannot write
 * a decline reason onto someone else's lead by guessing a leadId, and learns
 * nothing from the response.
 */

import { NextRequest } from "next/server";

import { setDeclineReason } from "@/lib/db/applicants";
import { decodeSession, SESSION_COOKIE } from "@/lib/apply-session";
import { decodeApprovalOffer, APPROVAL_OFFER_COOKIE } from "@/lib/approval-offer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { leadId, reason } = (await request.json()) as {
      leadId?: string;
      reason?: string;
    };

    if (!leadId || !reason) {
      return new Response("Missing leadId or reason", { status: 400 });
    }

    const rawSession = request.cookies.get(SESSION_COOKIE)?.value ?? "";
    const session = rawSession ? decodeSession(rawSession) : null;
    const sessionLead = session && typeof session.leadId === "string" ? session.leadId : null;

    const offerRaw = request.cookies.get(APPROVAL_OFFER_COOKIE)?.value;
    const offer = offerRaw ? decodeApprovalOffer(offerRaw) : null;
    const offerLead = offer?.leadId ?? null;

    // Only the owner of this lead (proven by their own cookie) may write to it.
    if (leadId !== sessionLead && leadId !== offerLead) {
      return new Response("ok", { status: 200 });
    }

    await setDeclineReason(leadId, reason);

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[decline-reason]", err);
    return new Response("Server error", { status: 500 });
  }
}
