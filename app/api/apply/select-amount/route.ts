/**
 * POST /api/apply/select-amount
 *
 * Persists the confirmed withdraw-today amount before the plan page.
 * Body: { leadId, amount }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/client";
import { decodeSession, SESSION_COOKIE } from "@/lib/apply-session";
import {
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

    const admin = createAdminClient();
    const { error } = await admin
      .from("leads")
      .update({ loan_amount: amount })
      .eq("id", leadId);

    if (error) {
      console.error(`${LOG} db error`, error);
      return NextResponse.json({ error: "Failed to save amount" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${LOG}`, err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
