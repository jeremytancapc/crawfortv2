/**
 * POST /api/apply/income
 *
 * Submits the figures taken from an applicant's payslips against their
 * PENDING Ascend order, which re-scores it, and answers with where they go
 * next - the same three outcomes as submit, because income/credit returns the
 * same shape as apply/credit.
 *
 * Only reachable in the PENDING case: an applicant whose CPF or NOA data
 * already satisfied Ascend never uploads anything.
 */

import { NextRequest, NextResponse } from "next/server";

import { decideAfterIncome } from "@/lib/apply-outcome";
import {
  POST_SUBMIT_COOKIE_MAX_AGE_SEC,
  SESSION_COOKIE,
  decodeSession,
  encodeSession,
  reviewGateCookieValue,
  sessionCookieValue,
} from "@/lib/apply-session";
import {
  approvalOfferCookieValue,
  storedApprovalOfferFromForm,
} from "@/lib/approval-offer";
import { ascendSubmitIncome, AscendError } from "@/lib/ascend/client";
import { ascendConfig } from "@/lib/ascend/config";
import { applyClearApplyCookiesOnResponse } from "@/lib/clear-apply-cookies-response";
import { getAscendOrder, updateAscendOrderDecision } from "@/lib/db/ascend-orders";
import { isDatabaseConfigured } from "@/lib/db/sql";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import { clearIncomeGateCookie } from "@/lib/apply-session";
import { creditAfterIncome } from "@/lib/ascend/after-income";

export const runtime = "nodejs";

type Body = {
  months?: Array<{ amount?: number }>;
  incomeType?: string;
  files?: Array<{ fileType: string; fileName: string; fileUrl: string }>;
};

export async function POST(request: NextRequest) {
  if (!ascendConfig() || !isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Income submission is not available right now." },
      { status: 503 },
    );
  }

  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value ?? "") ?? {};
  const applicantId = (session as { leadId?: string }).leadId ?? "";
  if (!looksLikeLeadUuid(applicantId)) {
    return NextResponse.json({ error: "No application in progress." }, { status: 400 });
  }

  const order = await getAscendOrder(applicantId);
  if (!order) {
    return NextResponse.json({ error: "No application in progress." }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Three months, most recent first - the shape the upload step produces and
  // the shape Ascend wants as m1/m2/m3.
  const amounts = (body.months ?? []).map((m) => Number(m.amount)).filter((n) => Number.isFinite(n) && n > 0);
  if (amounts.length < 3) {
    return NextResponse.json(
      { error: "Three months of income are needed." },
      { status: 400 },
    );
  }

  // Ascend rejects income with no documents behind it: `600: orderFile is
  // required`. Refusing here rather than there keeps the failure legible -
  // sending figures Ascend will not accept returns a 502 that reads like an
  // outage rather than a missing upload.
  //
  // NOT YET WIRED: the verify-income page collects files in the browser and
  // they are never uploaded. Reaching Ascend needs /openApi/file/upload
  // first, then its returned URLs passed here as `files`.
  const files = body.files ?? [];
  if (files.length === 0) {
    console.error("[apply/income] no documents to submit - file upload is not wired yet");
    return NextResponse.json(
      { error: "Please attach your income documents before submitting." },
      { status: 400 },
    );
  }

  try {
    const result = await ascendSubmitIncome({
      orderId: order.order_id,
      incomeType: body.incomeType ?? "PANEL_PAYSLIP",
      m1: amounts[0],
      m2: amounts[1],
      m3: amounts[2],
      // The figures come from documents the applicant uploaded, so Ascend
      // should treat them as credible income rather than self-declared.
      incomeFile: true,
      files,
    }, { applicantId });

    // income/credit answers immediately and Ascend settles afterwards, so ask
    // again before deciding where the applicant goes. A failed re-ask keeps
    // the pending answer rather than inventing progress.
    const settled = await creditAfterIncome(result.orderId, result, { applicantId });

    await updateAscendOrderDecision(applicantId, settled);

    // Not decideApplyOutcome: PENDING here means the income was taken and is
    // being reviewed, not that more is wanted.
    const outcome = decideAfterIncome(settled);
    const res = NextResponse.json({
      // The declined/in-review/unresolved branch below clears the session,
      // so the client has nowhere else to read a leadId from - and without
      // one, postSubmitUrl sends it to a bare "/apply/pending" that the
      // funnel guard cannot resolve to anything and bounces to "/".
      leadId: applicantId,
      destination: outcome.destination,
      outcome: outcome.kind,
      aCardLimit: outcome.kind === "approved" ? outcome.aCardLimit : null,
      maximumLoanQuantum: outcome.kind === "approved" ? outcome.maximumLoanQuantum : null,
    });

    // Income has been accepted and re-scored. Unless Ascend is still asking
    // for more, the income step stops being where this applicant belongs -
    // otherwise the lock would keep pulling them back to it.
    // The income step is behind them either way now - approved, declined, or
    // waiting on a human. Leaving the gate set would pull them back to it.
    res.cookies.set(clearIncomeGateCookie());

    // Without this, an applicant Ascend just approved had nothing marking
    // them as ever having submitted - income_gate just cleared, and neither
    // review_gate nor the approval offer had ever been set here (only
    // /apply/submit's own approved branch sets them). The funnel guard reads
    // that as "never submitted, still eligible for review" and sent a freshly
    // approved applicant straight back to /apply/review instead of their
    // offer. Mirrors /apply/submit's own approved branch, using Ascend's own
    // aCardLimit rather than a locally recomputed figure - there is none here.
    if (outcome.kind === "approved") {
      const updatedSession = { ...session, leadId: applicantId };
      res.cookies.set({ ...sessionCookieValue(updatedSession), value: encodeSession(updatedSession) });
      res.cookies.set(reviewGateCookieValue(POST_SUBMIT_COOKIE_MAX_AGE_SEC));
      res.cookies.set(
        approvalOfferCookieValue(
          storedApprovalOfferFromForm(applicantId, session, {
            approvedLoanAmount: outcome.aCardLimit,
            verifiedMonthlyIncome: Number(session.verifiedMonthlyIncome) || 0,
            incomeSource: session.incomeSource || "",
          }),
        ),
      );
    } else {
      // Declined, in review, or unresolved: not approved, but just as
      // submitted as the approved branch above - and review_gate would be
      // the wrong marker for that, since it also grants /apply/book access
      // (hasPostSubmitAccess). Clearing apply_gate and the session instead
      // is what /apply/submit's own declined branch already does: with no
      // apply_gate, canEnterReview can't say yes, and the funnel guard stops
      // reading a leadId alone as "still eligible for review." Without this,
      // an applicant Ascend declined via income could navigate straight
      // back into Review and edit it - not just see a dead button, but
      // actually reach the form the one-way gate exists to lock.
      applyClearApplyCookiesOnResponse(res);
    }

    return res;
  } catch (err) {
    if (err instanceof AscendError) {
      console.error(`[apply/income] income/credit failed ${err.code}: ${err.msg}`);
      // 600 covers an order that has already moved past the income stage, among
      // other things - the message is the only thing that separates them.
      return NextResponse.json(
        { error: "We could not accept those documents. Please try again or contact us." },
        { status: 502 },
      );
    }
    throw err;
  }
}
