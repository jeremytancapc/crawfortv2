import { NextRequest, NextResponse } from "next/server";
import {
  clearIncomeGateCookie,
  decodeSession,
  encodeSession,
  sessionCookieValue,
  gateCookieValue,
  REVIEW_GATE_COOKIE,
  SESSION_COOKIE,
  GATE_COOKIE,
} from "@/lib/apply-session";
import { clearApprovalOfferCookie } from "@/lib/approval-offer";
import { clearBookingConfirmCookie } from "@/lib/booking-confirmation";
import { clearPlanAdditionalRequestsCookie } from "@/lib/plan-additional-requests";
import {
  APPLY_TRACE_ID_KEY,
  byteLength,
  computeResumeWouldPass,
  logApplyFlowEvent,
  newApplyTraceId,
} from "@/lib/apply-flow-log";
import type { LoanFormData } from "@/lib/loan-form";
import { getApplicant, insertApplicant } from "@/lib/db/applicants";
import { processedPayloadFromRetrieval } from "@/lib/myinfo-profile";
import type { IdType } from "@/lib/db/types";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import { draftLeadCookieValue, DRAFT_LEAD_COOKIE } from "@/lib/apply-session";
import {
  buildMyinfoCookiePayload,
  myinfoCookieValue,
} from "@/lib/apply-myinfo-cookie";
import { buildActivateSessionCookie } from "@/lib/apply-session-slim";
import { upsertMyinfoProfileForApplicant } from "@/lib/myinfo-profile";
import {
  APPLY_VARIANT_COOKIE,
  applyPath,
  parseApplyVariant,
} from "@/lib/apply-paths";

export const runtime = "nodejs";

type SessionWithTrace = Partial<LoanFormData> & { applyTraceId?: string };

// GET /api/apply/activate?token=<signed-myinfo-patch>
//
// The browser lands here after the Lambda → Singpass → Lambda → webhook flow.
// We merge the MyInfo patch with the existing apply_session cookie, set the
// apply_gate cookie, and redirect to /apply/review (no PII in URL).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const tokenDecodeOk = Boolean(token && decodeSession(token));
  const myinfoPatch = token ? (decodeSession(token) ?? {}) : {};

  const existingRaw = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const existing: SessionWithTrace = existingRaw
    ? (decodeSession(existingRaw) ?? {})
    : {};

  const merged: SessionWithTrace = { ...existing, ...myinfoPatch };
  if (!merged[APPLY_TRACE_ID_KEY]) {
    merged[APPLY_TRACE_ID_KEY] = existing[APPLY_TRACE_ID_KEY] ?? newApplyTraceId();
  }

  // The token no longer carries CPF and NOA - they were 85% of a URL-borne
  // payload - so read them from the retrieval the callback has just stored.
  // Only the profile row written below needs them; the session cookie is
  // slimmed of them again immediately afterwards.
  if (
    merged.singpassRawKey &&
    (merged.cpfContributions?.length ?? 0) === 0 &&
    (merged.noaHistory?.length ?? 0) === 0
  ) {
    try {
      const stored = await processedPayloadFromRetrieval(merged.singpassRawKey);
      if (stored) {
        merged.cpfContributions = stored.cpfContributions;
        merged.noaHistory = stored.noaHistory;
        merged.dob = merged.dob || stored.dob;
      }
    } catch (err) {
      // The applicant still has their mapped details; only the income
      // arrays are missing, and submit re-reads them from the same place.
      console.error("[activate] could not read stored MyInfo:", err);
    }
  }

  // ── Create partial lead while MyInfo data is fresh ─────────────────────────
  // Stored in a dedicated draft_lead cookie - NOT in the session - so the
  // funnel gate logic is completely unaffected.
  const hasLoanDetails =
    typeof merged.amount === "number" && merged.amount > 0 &&
    typeof merged.tenure === "number" && merged.tenure > 0;
  // Don't create a second draft if the browser already has one from this journey.
  const existingDraftLeadId = request.cookies.get(DRAFT_LEAD_COOKIE)?.value ?? "";
  const alreadyHasDraft =
    looksLikeLeadUuid(existingDraftLeadId) &&
    (await isReusableDraft(existingDraftLeadId, merged.nric));

  let newDraftLeadId: string | null = null;
  if (hasLoanDetails && !alreadyHasDraft) {
    try {
      newDraftLeadId = await insertApplicant({
        desiredAmount: merged.amount!,
        loanTenure: merged.tenure!,
        loanPurpose: merged.loanPurpose || null,
        urgency: merged.urgency || null,
        authMethod: "singpass",
        idType: (merged.idType as IdType | undefined) || null,
        fullName: merged.fullName || null,
        nric: merged.nric || null,
        email: merged.email || null,
        mobile: merged.mobile || null,
        address: merged.address || null,
        postalCode: merged.postalCode || null,
        monthlyIncome: merged.monthlyIncome || null,
        // Partial until final submit makes it `new`. Captured here so an
        // applicant who drops off after MyInfo can still be followed up.
        status: "in_progress",
        moneylenderNoLoans: false,
      });
    } catch (err) {
      console.error("[activate] partial lead creation failed:", err);
    }
  }

  const draftLeadId =
    newDraftLeadId ??
    (alreadyHasDraft ? existingDraftLeadId : null);

  if (
    draftLeadId &&
    merged.authMethod === "singpass" &&
    merged.nric?.trim() &&
    merged.fullName?.trim()
  ) {
    try {
      await upsertMyinfoProfileForApplicant(draftLeadId, merged);
    } catch (err) {
      console.error("[activate] myinfo_profiles upsert failed:", err);
    }
  }

  const slimSession = buildActivateSessionCookie(merged, draftLeadId);
  const encoded = encodeSession(slimSession);
  const hadApplyGateBefore = request.cookies.get(GATE_COOKIE)?.value === "1";
  const resumeWouldPass = computeResumeWouldPass(slimSession, true);

  await logApplyFlowEvent({
    event: "activate_merged",
    traceId: merged[APPLY_TRACE_ID_KEY]!,
    applyTraceId: merged[APPLY_TRACE_ID_KEY] ?? null,
    singpassRawKey: merged.singpassRawKey || null,
    request,
    requestPath: request.nextUrl.pathname,
    hadExistingSessionCookie: Boolean(existingRaw),
    hadActivateToken: Boolean(token),
    tokenDecodeOk,
    hadApplyGateCookie: hadApplyGateBefore,
    cookieExistingBytes: byteLength(existingRaw),
    cookieTokenBytes: byteLength(token),
    cookieMergedBytes: byteLength(encoded),
    resumeWouldPass,
    sessionBefore: existing,
    sessionAfter: slimSession,
    details: {
      redirect_to: applyPath(
        parseApplyVariant(request.cookies.get(APPLY_VARIANT_COOKIE)?.value),
        "/apply/review",
      ),
      had_apply_gate_before: hadApplyGateBefore,
      draft_lead_id: draftLeadId,
      myinfo_persisted: Boolean(draftLeadId),
      singpass_raw_key_from_token: Boolean(
        (myinfoPatch as Partial<LoanFormData>).singpassRawKey,
      ),
    },
  });

  const reviewPath = applyPath(
    parseApplyVariant(request.cookies.get(APPLY_VARIANT_COOKIE)?.value),
    "/apply/review",
  );
  const reviewUrl = new URL(reviewPath, request.nextUrl.origin);
  const res = NextResponse.redirect(reviewUrl, { status: 302 });

  // A Singpass login starts an application, so nothing a previous one left
  // behind in this browser may carry over. These are the cookies the funnel
  // guard reads as "already submitted / approved / asked for income" - left
  // in place, an earlier applicant's approval_offer would still read as
  // approved for whoever logs in next, and send them to someone else's offer.
  res.cookies.set(clearApprovalOfferCookie());
  res.cookies.set(clearIncomeGateCookie());
  res.cookies.set({ name: REVIEW_GATE_COOKIE, value: "", maxAge: 0, path: "/" });
  res.cookies.set(clearBookingConfirmCookie());
  res.cookies.set(clearPlanAdditionalRequestsCookie());

  const sc = sessionCookieValue(slimSession);
  res.cookies.set({ ...sc, value: encoded });
  res.cookies.set(gateCookieValue());

  const myinfoPayload = buildMyinfoCookiePayload(merged);
  if (myinfoPayload) {
    res.cookies.set(myinfoCookieValue(myinfoPayload));
  }

  if (newDraftLeadId) {
    res.cookies.set(draftLeadCookieValue(newDraftLeadId));
  } else if (draftLeadId && alreadyHasDraft) {
    res.cookies.set(draftLeadCookieValue(draftLeadId));
  } else if (looksLikeLeadUuid(existingDraftLeadId)) {
    // Not reusable and nothing new replaced it - left behind, submit would
    // read it first and write this applicant over someone else's row.
    res.cookies.set({ name: DRAFT_LEAD_COOKIE, value: "", maxAge: 0, path: "/" });
  }

  return res;
}

/**
 * Whether a draft lead already in this browser belongs to this login.
 *
 * The draft cookie exists so one journey doesn't create two applicant rows.
 * But nothing tied it to the person: a draft left by an earlier applicant -
 * a reloan, an abandoned tab, a tester switching personas - was picked up by
 * whoever logged in next, and their details written over that applicant's
 * row, Ascend order and all. Reused now only while it is still the same
 * person's unfinished application.
 */
async function isReusableDraft(draftLeadId: string, nric: string | undefined): Promise<boolean> {
  const incoming = nric?.trim().toUpperCase();
  if (!incoming) return false;
  try {
    const draft = await getApplicant(draftLeadId);
    return draft?.status === "in_progress" && draft.nric?.trim().toUpperCase() === incoming;
  } catch {
    // Unreadable means unverifiable - a fresh draft costs one row, a wrong
    // one costs someone else's application.
    return false;
  }
}
