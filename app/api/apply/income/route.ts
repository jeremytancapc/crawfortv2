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
import { SESSION_COOKIE, decodeSession } from "@/lib/apply-session";
import { ascendSubmitIncome, AscendError } from "@/lib/ascend/client";
import { ascendConfig } from "@/lib/ascend/config";
import { getAscendOrder, updateAscendOrderDecision } from "@/lib/db/ascend-orders";
import { isDatabaseConfigured } from "@/lib/db/sql";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import { clearIncomeGateCookie } from "@/lib/apply-session";

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
    });

    await updateAscendOrderDecision(applicantId, result);

    // Not decideApplyOutcome: PENDING here means the income was taken and is
    // being reviewed, not that more is wanted.
    const outcome = decideAfterIncome(result);
    const res = NextResponse.json({
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
