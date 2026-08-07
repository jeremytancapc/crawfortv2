/**
 * POST /api/apply/select-plan
 *
 * Persists the customer's chosen repayment plan to the lead record.
 * Body: { leadId, planId, tenure, amount, monthlyRate, monthlyInstalment }
 *
 * Updates loan_tenure and (for custom plans) loan_amount on the lead so that
 * downstream flows (booking confirmation, AirConnect notification) pick up the
 * correct figures.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/client";
import {
  MIN_OFFER_TENURE,
  MAX_OFFER_TENURE,
} from "@/lib/offer-plans";
import {
  decodeSession,
  SESSION_COOKIE,
} from "@/lib/apply-session";
import {
  decodeApprovalOffer,
  APPROVAL_OFFER_COOKIE,
} from "@/lib/approval-offer";
import {
  formatPlanAdditionalRequestsLabel,
  planAdditionalRequestsCookieValue,
  type PlanAdditionalRequests,
} from "@/lib/plan-additional-requests";

export const dynamic = "force-dynamic";

const LOG = "[apply/select-plan]";

type Body = {
  leadId?: string;
  planId?: string;
  tenure?: number;
  amount?: number;
  monthlyRate?: number;
  monthlyInstalment?: number;
  requestLongerTenure?: boolean;
  requestHigherAmount?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<Body>;
    const { planId, tenure, amount, monthlyRate, monthlyInstalment } = body;
    const additionalRequests: PlanAdditionalRequests = {
      longerTenure: Boolean(body.requestLongerTenure),
      higherAmount: Boolean(body.requestHigherAmount),
    };

    // Resolve leadId: prefer body, fall back to session/offer cookies
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

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    if (typeof tenure !== "number" || tenure < MIN_OFFER_TENURE || tenure > MAX_OFFER_TENURE) {
      return NextResponse.json(
        { error: `tenure must be between ${MIN_OFFER_TENURE} and ${MAX_OFFER_TENURE}` },
        { status: 400 },
      );
    }

    if (typeof amount !== "number" || amount < 500) {
      return NextResponse.json({ error: "amount must be at least 500" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Persist the chosen withdraw amount so /apply/accept shows the same figure.
    const update: Record<string, unknown> = {
      loan_tenure: tenure,
      loan_amount: amount,
      selected_plan: planId,
      plan_monthly_rate: monthlyRate ?? null,
      plan_monthly_instalment: monthlyInstalment ?? null,
    };

    // Append a short ops-facing note when the customer ticked additional requests.
    const requestLabels = formatPlanAdditionalRequestsLabel(additionalRequests);
    if (requestLabels.length > 0) {
      const { data: existing } = await admin
        .from("leads")
        .select("notes")
        .eq("id", leadId)
        .maybeSingle();
      const previousNotes = typeof existing?.notes === "string" ? existing.notes.trim() : "";
      const requestNote = `Additional requests: ${requestLabels.join("; ")}`;
      const stripped = previousNotes
        .split("\n")
        .filter((line: string) => !line.startsWith("Additional requests:"))
        .join("\n")
        .trim();
      update.notes = stripped ? `${stripped}\n${requestNote}` : requestNote;
    }

    const { error } = await admin.from("leads").update(update).eq("id", leadId);

    if (error) {
      console.error(`${LOG} db error`, error);
      return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
    }

    console.info(`${LOG} plan saved`, { leadId, planId, tenure, amount, additionalRequests });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(planAdditionalRequestsCookieValue(additionalRequests));
    return res;
  } catch (err) {
    console.error(`${LOG}`, err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
