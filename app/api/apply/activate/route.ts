import { NextRequest, NextResponse } from "next/server";
import {
  decodeSession,
  encodeSession,
  sessionCookieValue,
  gateCookieValue,
  SESSION_COOKIE,
  GATE_COOKIE,
} from "@/lib/apply-session";
import {
  APPLY_TRACE_ID_KEY,
  byteLength,
  computeResumeWouldPass,
  logApplyFlowEvent,
  newApplyTraceId,
} from "@/lib/apply-flow-log";
import type { LoanFormData } from "@/lib/loan-form";
import { insertApplicant } from "@/lib/db/applicants";
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
  const alreadyHasDraft = looksLikeLeadUuid(existingDraftLeadId);

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
  }

  return res;
}
