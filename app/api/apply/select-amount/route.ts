/**
 * POST /api/apply/select-amount
 *
 * Persists the confirmed withdraw-today amount before the plan page.
 * Body: { leadId, amount }
 */

import { NextRequest, NextResponse } from "next/server";
import { setDesiredAmount } from "@/lib/db/applicants";
import { decodeSession, SESSION_COOKIE } from "@/lib/apply-session";
import {
  approvalOfferWithAmount,
  decodeApprovalOffer,
  APPROVAL_OFFER_COOKIE,
} from "@/lib/approval-offer";

export const dynamic = "force-dynamic";

const LOG = "[apply/select-amount]";

type Body = {
  leadId?: string;
  amount?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<Body>;
    const amount = body.amount;

    let leadId = typeof body.leadId === "string" && body.leadId ? body.leadId : null;
    if (!leadId) {
      const rawSession = request.cookies.get(SESSION_COOKIE)?.value ?? "";
      const session = rawSession ? (decodeSession(rawSession) ?? {}) : {};
      if (typeof session.leadId === "string" && session.leadId) leadId = session.leadId;
    }
    if (!leadId) {
      const offerRaw = request.cookies.get(APPROVAL_OFFER_COOKIE)?.value;
      const offer = offerRaw ? decodeApprovalOffer(offerRaw) : null;
      if (offer?.leadId) leadId = offer.leadId;
    }

    if (!leadId) {
      return NextResponse.json({ error: "No active application found" }, { status: 400 });
    }

    if (typeof amount !== "number" || amount < 500) {
      return NextResponse.json({ error: "amount must be at least 500" }, { status: 400 });
    }

    await setDesiredAmount(leadId, amount);

    const res = NextResponse.json({ ok: true });
    const offerCookie = approvalOfferWithAmount(
      request.cookies.get(APPROVAL_OFFER_COOKIE)?.value,
      amount,
    );
    if (offerCookie) res.cookies.set(offerCookie);
    return res;
  } catch (err) {
    console.error(`${LOG}`, err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
