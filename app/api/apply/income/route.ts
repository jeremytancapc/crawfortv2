/**
 * POST /api/apply/income
 *
 * Submits the figures taken from an applicant's income documents against
 * their PENDING Ascend order, which re-scores it, and answers with where they
 * go next - the same three outcomes as submit, because income/credit returns
 * the same shape as apply/credit.
 *
 * The browser sends only the id of a reading. The figures, the income type
 * and the file labels are the ones recorded when the documents were read, and
 * the files are the stored copies - nothing the browser says can change what
 * Ascend is told. The request is refused if the applicant's documents are no
 * longer exactly the ones that reading came from.
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
import { getApplicant } from "@/lib/db/applicants";
import {
  claimIncomeReading,
  completeIncomeReading,
  getIncomeReading,
  listActiveIncomeDocuments,
  logIncomeDocumentEvent,
  markIncomeDocumentsSubmitted,
  releaseIncomeReading,
  setIncomeDocumentAscendUrl,
} from "@/lib/db/income-documents";
import { isDatabaseConfigured } from "@/lib/db/sql";
import { fileUrlForAscend } from "@/lib/documents/ascend-file";
import { getDocumentBytes } from "@/lib/documents/store";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import { clearIncomeGateCookie } from "@/lib/apply-session";
import { creditAfterIncome } from "@/lib/ascend/after-income";
import { recordNoteOnAscendOrder } from "@/lib/ascend/record-plan";

export const runtime = "nodejs";

/**
 * The document kinds the upload step reads. CPF and NOA come from Myinfo at
 * submit and are never uploaded, so they are not accepted here.
 */
const UPLOADED_INCOME_TYPES = new Set([
  "PANEL_PAYSLIP",
  "NON_PANEL_PAYSLIP",
  "BANK_STATEMENT_OTHER_INCOME",
]);

type Body = { readingId?: string };

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

  const readingId = typeof body.readingId === "string" ? body.readingId : "";
  const reading = /^[0-9a-f-]{36}$/i.test(readingId)
    ? await getIncomeReading(applicantId, readingId)
    : null;
  if (!reading) {
    return NextResponse.json(
      { error: "Please upload your income documents before submitting." },
      { status: 400 },
    );
  }

  // The documents must still be exactly the ones this reading came from.
  // Anything added or removed since means the figures describe different
  // files, and submitting them would put someone else's evidence behind a
  // credit decision.
  const active = await listActiveIncomeDocuments(applicantId);
  const unchanged =
    active.length === reading.document_ids.length &&
    active.every((doc) => doc.status === "read" && doc.reading_id === reading.id);
  if (!unchanged) {
    await logIncomeDocumentEvent({
      applicantId,
      readingId: reading.id,
      event: "submit_failed",
      detail: { reason: "documents changed since they were read" },
    });
    return NextResponse.json(
      { error: "Your documents changed since they were read. Please check them again." },
      { status: 409 },
    );
  }

  const applicant = await getApplicant(applicantId);
  if (!applicant?.ascend_user_id) {
    return NextResponse.json({ error: "No application in progress." }, { status: 400 });
  }

  // One submission per reading. income/credit can take longer than an
  // applicant will wait, and a second tap used to re-upload every file and
  // call it again while the first was still going. Whoever takes this first
  // submits; anyone else is told it is already under way.
  const claimed = await claimIncomeReading(applicantId, reading.id);
  if (!claimed) {
    await logIncomeDocumentEvent({
      applicantId,
      readingId: reading.id,
      event: "submit_failed",
      detail: { reason: "already submitted or in progress" },
    });
    return NextResponse.json(
      { error: "Your income is already being submitted. Please wait a moment." },
      { status: 409 },
    );
  }

  // Three months, most recent first - what Ascend wants as m1/m2/m3, with any
  // month not read already filled in when the reading was taken.
  const amounts = [Number(reading.m1), Number(reading.m2), Number(reading.m3)];

  const incomeType = UPLOADED_INCOME_TYPES.has(reading.income_type)
    ? reading.income_type
    : "NON_PANEL_PAYSLIP";

  // Ascend rejects income with no documents behind it: `600: orderFile is
  // required`. The documents are the stored copies, labelled as they were
  // when read - a bank statement sent beside payslips stays a bank statement.
  const files: Array<{ fileType: string; fileName: string; fileUrl: string }> = [];
  // Only the files that fed the months. A March payslip sent in October is not
  // evidence for this decision, and sending it only gives Ascend noise.
  const toSend = active.filter(
    (doc) => !reading.used_document_ids || reading.used_document_ids.includes(doc.id),
  );
  try {
    for (const doc of toSend) {
      // Already given a URL by an earlier attempt: use it rather than upload
      // the file to Ascend a second time.
      let fileUrl = doc.ascend_file_url;
      if (!fileUrl) {
        const bytes = await getDocumentBytes(doc.object_key);
        if (!bytes) {
          await releaseIncomeReading(reading.id);
          await logIncomeDocumentEvent({
            applicantId,
            documentId: doc.id,
            readingId: reading.id,
            event: "submit_failed",
            detail: { reason: "object missing from storage" },
          });
          return NextResponse.json(
            { error: `We could not find ${doc.file_name}. Please add it again.` },
            { status: 409 },
          );
        }
        ({ fileUrl } = await fileUrlForAscend({
          doc,
          bytes,
          ascendUserId: applicant.ascend_user_id,
          origin: request.nextUrl.origin,
        }));
        await setIncomeDocumentAscendUrl(doc.id, fileUrl);
      }
      files.push({
        fileType: UPLOADED_INCOME_TYPES.has(doc.file_type ?? "") ? doc.file_type! : incomeType,
        fileName: doc.file_name,
        fileUrl,
      });
    }
  } catch (err) {
    await releaseIncomeReading(reading.id);
    throw err;
  }

  try {
    const result = await ascendSubmitIncome({
      orderId: order.order_id,
      incomeType,
      m1: amounts[0],
      m2: amounts[1],
      m3: amounts[2],
      // The figures come from documents the applicant uploaded, so Ascend
      // should treat them as credible income rather than self-declared.
      incomeFile: true,
      files,
    }, { applicantId });

    // Staff reviewing this order should know which evidence was taken without
    // a name on it. Fire-and-forget: a missing note must not cost the
    // applicant a step they have completed.
    if (reading.name_not_shown_for.length > 0) {
      void recordNoteOnAscendOrder(
        applicantId,
        `Income documents accepted without a name shown on them: ${reading.name_not_shown_for.join(", ")}. ` +
          "Not matched to the Singpass name.",
      );
    }

    await markIncomeDocumentsSubmitted(
      applicantId,
      reading.id,
      toSend.map((doc) => doc.id),
    );
    await completeIncomeReading(reading.id);

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
    // Give the right back so the applicant can try again - unless income/credit
    // already went through, which is the one case a retry must not repeat.
    await releaseIncomeReading(reading.id);
    if (err instanceof AscendError) {
      console.error(`[apply/income] income/credit failed ${err.code}: ${err.msg}`);
      await logIncomeDocumentEvent({
        applicantId,
        readingId: reading.id,
        event: "submit_failed",
        detail: { code: err.code, msg: err.msg },
      });
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
