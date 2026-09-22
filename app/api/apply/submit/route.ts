/**
 * POST /api/apply/submit
 *
 * Called when the applicant finishes the moneylender step and submits.
 * 1. Reads the full form data from the signed session cookie.
 * 2. Saves a Lead row to the in-memory store.
 * 3. If MyInfo was used, saves a MyInfoProfile row.
 * 4. Runs the credit scoring engine.
 * 5. Saves a CreditAssessment row.
 * 6. Updates the session cookie with leadId + approval result.
 * 7. Returns JSON { leadId, approvedLoanAmount, verifiedMonthlyIncome, incomeSource, isEligible }.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  approvalOfferCookieValue,
  storedApprovalOfferFromForm,
} from "@/lib/approval-offer";
import { applyClearApplyCookiesOnResponse } from "@/lib/clear-apply-cookies-response";
import {
  decodeSession,
  encodeSession,
  POST_SUBMIT_COOKIE_MAX_AGE_SEC,
  sessionCookieValue,
  reviewGateCookieValue,
  incomeGateCookieValue,
  clearIncomeGateCookie,
  SESSION_COOKIE,
} from "@/lib/apply-session";
import { initialLoanFormData } from "@/lib/loan-form";
import type { LoanFormData } from "@/lib/loan-form";
import { assessCredit } from "@/lib/credit-score";
import { deriveCreditRejectionReason } from "@/lib/credit-rejection";
import {
  getApplicant,
  insertApplicant,
  markAirConnectLeadPushed,
  setAscendIdentity,
  setApplicantStatus,
  updateApplicantDetails,
  type NewApplicant,
} from "@/lib/db/applicants";
import { upsertCreditAssessment } from "@/lib/db/credit-assessments";
import type { AuthMethod, BankruptcyDeclaration, IdType } from "@/lib/db/types";
import { buildPostSubmitSession } from "@/lib/apply-session-slim";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import { DRAFT_LEAD_COOKIE } from "@/lib/apply-session";
import { clearMyinfoCookie, decodeMyinfoCookie, MYINFO_COOKIE } from "@/lib/apply-myinfo-cookie";
import {
  loadMyinfoProcessedPayload,
  processedPayloadFromRetrieval,
  upsertMyinfoProfileForApplicant,
} from "@/lib/myinfo-profile";
import { pushNewLeadToAirConnect } from "@/lib/airconnect/notify";
import { decideSubmission } from "@/lib/apply-outcome";
import { requestAscendDecision } from "@/lib/ascend/decision";
import { DuplicateAscendOrderError, recordAscendOrder } from "@/lib/db/ascend-orders";
import { isDatabaseConfigured } from "@/lib/db/sql";
import { resolveAscendIdentity } from "@/lib/ascend/identity";
import { ascendBankruptcy, buildBorrowerMyInfo } from "@/lib/ascend/borrower-info";
import { deriveBorrowerFields } from "@/lib/ascend/borrower-derive";
import { getMyinfoRetrieval } from "@/lib/db/myinfo-retrievals";
import { myinfoPersonData } from "@/lib/myinfo";
import { toSgE164 } from "@/lib/phone";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Accept formData posted directly in the body (preferred - avoids cookie race
  // between the session-save and submit requests).  Fall back to the session
  // cookie so that older callers keep working.
  let bodyData: Partial<LoanFormData> = {};
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      bodyData = (await request.json()) as Partial<LoanFormData>;
    }
  } catch {
    // ignore parse errors; will fall back to cookie
  }
  const rawSession = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const sessionData = rawSession ? (decodeSession(rawSession) ?? {}) : {};
  // Body takes precedence over cookie so fresh data is always used.
  const formData = { ...initialLoanFormData, ...sessionData, ...bodyData };
  // SPA manual path: client JSON often omits or sends authMethod "" while the
  // cookie was set at the Singpass gate - don't let the body wipe it.
  const sessionAuth = sessionData.authMethod;
  const bodyAuth = bodyData.authMethod;
  const bodyHasConcreteAuth =
    bodyAuth === "manual" || bodyAuth === "singpass";
  if (
    !bodyHasConcreteAuth &&
    (sessionAuth === "manual" || sessionAuth === "singpass")
  ) {
    formData.authMethod = sessionAuth;
  }

  // Read the draft lead ID from the dedicated draft_lead cookie.
  // This cookie is set by /api/apply/activate (Singpass) or /api/apply/draft
  // (manual). It is separate from the session so the funnel is never affected.
  // The draft_lead cookie first, then the session. Activate writes the id to
  // both, because the cookie is set on a cross-site redirect from the Lambda
  // and does not always survive it. Without either, submit cannot tell an
  // applicant who just finished MyInfo from a new one and inserts a second
  // row, stranding the first as `in_progress`.
  const draftLeadId = (
    request.cookies.get(DRAFT_LEAD_COOKIE)?.value ||
    (sessionData as { leadId?: string }).leadId ||
    ""
  ).trim();

  // ── 1. Save the applicant (UPDATE if a partial row exists, INSERT otherwise) ─
  const applicantFields: NewApplicant = {
    desiredAmount: formData.amount,
    loanTenure: formData.tenure,
    loanPurpose: formData.loanPurpose || null,
    urgency: formData.urgency || null,
    authMethod: (formData.authMethod as AuthMethod | undefined) || null,
    idType: (formData.idType as IdType | undefined) || null,
    fullName: formData.fullName || null,
    nric: formData.nric || null,
    email: formData.email || null,
    mobile: formData.mobile || null,
    secondaryMobile: formData.secondaryMobile || null,
    postalCode: formData.postalCode || null,
    address: formData.address || null,
    mailingAddress: formData.mailingAddress || null,
    employmentStatus: formData.employmentStatus || null,
    monthlyIncome: formData.monthlyIncome || null,
    workIndustry: formData.workIndustry || null,
    position: formData.position || null,
    employmentDuration: formData.employmentDuration || null,
    officePhone: formData.officePhone || null,
    maritalStatus: formData.maritalStatus || null,
    bankruptcyDeclaration: (formData.bankruptcyDeclaration as BankruptcyDeclaration | undefined) || null,
    moneylenderNoLoans: formData.moneylenderNoLoans,
    moneylenderLoanAmount: formData.moneylenderLoanAmount || null,
    moneylenderPaymentHistory: formData.moneylenderPaymentHistory || null,
    status: "new",
  };

  let leadId: string;

  try {
    if (looksLikeLeadUuid(draftLeadId)) {
      // Partial row created at activate (Singpass) or draft (manual).
      await updateApplicantDetails(draftLeadId, applicantFields);
      leadId = draftLeadId;
    } else {
      leadId = await insertApplicant(applicantFields);
    }
  } catch (err) {
    console.error("Failed to save applicant:", err);
    return NextResponse.json({ error: "Failed to save application" }, { status: 500 });
  }

  // ── 2. MyInfo profile (Singpass) - upsert; hydrate CPF/NOA from DB if cookie was slim ─
  if (formData.authMethod === "singpass") {
    let cpfContributions = formData.cpfContributions;
    let noaHistory = formData.noaHistory;
    let dob = formData.dob;

    if (cpfContributions.length === 0 && noaHistory.length === 0) {
      const fromMyinfoCookie = decodeMyinfoCookie(
        request.cookies.get(MYINFO_COOKIE)?.value ?? "",
      );
      const cookieHasBulk = Boolean(
        fromMyinfoCookie &&
          (fromMyinfoCookie.cpfContributions.length > 0 ||
            fromMyinfoCookie.noaHistory.length > 0),
      );
      const fromDb = looksLikeLeadUuid(leadId)
        ? await loadMyinfoProcessedPayload(leadId)
        : null;
      const fromStore =
        !fromDb && formData.singpassRawKey
          ? await processedPayloadFromRetrieval(formData.singpassRawKey)
          : null;
      const fallback = (cookieHasBulk ? fromMyinfoCookie : null) ?? fromDb ?? fromStore;
      if (fallback) {
        cpfContributions = fallback.cpfContributions;
        noaHistory = fallback.noaHistory;
        dob = dob || fallback.dob;
      }
    }

    try {
      await upsertMyinfoProfileForApplicant(leadId, {
        ...formData,
        cpfContributions,
        noaHistory,
        dob,
      });
    } catch (err) {
      console.error("Failed to save MyInfo profile:", err);
      return NextResponse.json({ error: "Failed to save application" }, { status: 500 });
    }

    formData.cpfContributions = cpfContributions;
    formData.noaHistory = noaHistory;
    formData.dob = dob;
  }

  // ── 3. Run credit scoring ─────────────────────────────────────────────────
  const e164Phone = toSgE164(formData.mobile);

  // Always run credit scoring.
  const assessment = assessCredit({
    dob: formData.dob,
    idType: formData.idType,
    cpfContributions: formData.cpfContributions,
    noaHistory: formData.noaHistory,
    selfDeclaredMonthlyIncome: parseInt(formData.monthlyIncome.replace(/,/g, ""), 10) || 0,
    requestedLoanAmount: formData.amount,
    moneylenderNoLoans: formData.moneylenderNoLoans,
    moneylenderLoanAmount: formData.moneylenderLoanAmount,
    moneylenderPaymentHistory: formData.moneylenderPaymentHistory,
    authMethod: formData.authMethod,
  });

  // The guaranteed-approval clamp that used to sit here is gone. It forced
  // every Singpass applicant to approval with a $500 floor, so the Singpass
  // path could not decline anyone - which was right while the identity was
  // simulated, and is wrong now that Ascend decides. It would override a
  // genuine REJECT (ADR-0001).
  //
  // The engine still runs. Its Underwritten Cap is still persisted below, for
  // comparison against what Ascend returns. It no longer decides anything.
  const finalAssessment = assessment;

  const creditRejectionReason = deriveCreditRejectionReason(finalAssessment);

  // ── 4. Save what the engine made of it ───────────────────────────────────
  //
  // Persisted, not acted on. Since ADR-0001 these numbers exist so they can
  // be compared against Ascend's - the only way anyone would notice Ascend
  // mis-reading, say, a platform worker's CPF.
  await upsertCreditAssessment(leadId, {
    incomeSource: finalAssessment.incomeSource,
    verifiedMonthlyIncome: finalAssessment.verifiedMonthlyIncome,
    underwrittenCap: finalAssessment.maxEligibleLoan,
    engineOfferAmount: finalAssessment.approvedLoanAmount,
    isEligible: finalAssessment.isEligible,
    creditRejectionReason,
    ageAtApplication: finalAssessment.age || null,
    existingLoans: finalAssessment.existingLoans,
    moneylenderLoanAmount: finalAssessment.existingLoans > 0 ? finalAssessment.existingLoans : null,
    moneylenderPaymentHistory: formData.moneylenderNoLoans ? null : (formData.moneylenderPaymentHistory || null),
    explanation: finalAssessment.explanation,
    rawAssessment: assessment as unknown as Record<string, unknown>,
  });

  // ── 4a. Identify the applicant to Ascend, before spending a credit pull ───
  //
  // ADR-0001: a Reloan Customer goes to the mobile app and never reaches
  // /openApi/apply/credit. This also yields the userId that the credit call
  // and every later document upload are addressed by.
  const identity = await resolveAscendIdentity({
    idNumber: formData.authMethod === "singpass" ? formData.nric : null,
    phone: e164Phone,
    applicantId: leadId,
  });

  if (identity) {
    await setAscendIdentity(leadId, {
      ascendUserId: identity.userId,
      newCustomer: identity.kind === "continue",
      // What Ascend said, not what we chose to send.
      hasMyinfo: identity.kind === "continue" && identity.hasMyinfo,
    }).catch((err) => console.error("[apply/submit] could not record identity", err));
  }

  // A returning borrower stops here. Continuing would create an Order for
  // someone who is being redirected anyway, which is the exact cost ADR-0001
  // exists to avoid.
  if (identity?.kind === "reloan") {
    await setApplicantStatus(leadId, "new").catch(() => {});
    const reloanRes = NextResponse.json({
      leadId,
      destination: identity.destination,
      outcome: "reloan",
      isEligible: false,
      explanation: "Existing customer - continue in the Crawfort app.",
    });
    reloanRes.cookies.set({
      ...sessionCookieValue(sessionData),
      value: encodeSession(
        buildPostSubmitSession(sessionData, leadId, {
          // A reloan is redirected, not offered: there is no assessed amount
          // to carry, and zero here means "none", not "declined for zero".
          approvedLoanAmount: 0,
          verifiedMonthlyIncome: 0,
          incomeSource: "",
        }),
      ),
    });
    return reloanRes;
  }

  // ── 4b. Ask Ascend, which owns the borrowable amount (ADR-0001) ───────────
  //
  // Not a quote: this creates an Order, once per applicant, guarded by the
  // UNIQUE constraint on ascend_orders.applicant_id. When Ascend is not
  // configured the call is skipped and `null` flows into the decision, which
  // resolves to a failure state rather than an offer - there is no amount to
  // show without it.
  // The five answers MyInfo cannot give: two the applicant stated, three
  // worked out from what MyInfo did provide. Built before the call so a bad
  // value fails here, with the applicant still on the page, rather than
  // arriving at Ascend as a rejected credit application.
  let borrowerMyInfo: Record<string, unknown> | undefined;
  try {
    // The same retrieval the credit call sends, read for the two fields the
    // derivation needs: cpfemployers for how long they have been there, and
    // occupation for their position.
    const stored = formData.singpassRawKey
      ? await getMyinfoRetrieval(formData.singpassRawKey)
      : null;
    const person = stored ? myinfoPersonData(stored) : {};
    borrowerMyInfo = buildBorrowerMyInfo(
      {
        ...deriveBorrowerFields(person),
        employmentType: formData.employmentStatus as never,
        bankruptcyDeclaration: ascendBankruptcy(
          formData.bankruptcyDeclaration as never,
        ),
      },
      { passExpiryDate: (person.passexpirydate as { value?: string })?.value },
    );
  } catch (err) {
    // Not fatal: Ascend documents borrowerMyInfo as required but currently
    // accepts a call without it. Sending nothing beats sending a value it
    // will reject, and the log says which applicant to look at.
    console.error("[apply/submit] could not build borrowerMyInfo", err);
  }

  const ascendResult = await requestAscendDecision({
    desiredAmount: formData.amount,
    singpassRawKey: formData.singpassRawKey,
    // Once Ascend holds this person's MyInfo, the userId alone is accepted and
    // the whole payload no longer has to travel.
    ascendUserId:
      identity?.kind === "continue" && identity.creditCallUses === "userId"
        ? identity.userId
        : null,
    applicantId: leadId,
    borrowerMyInfo,
  });

  const decision = decideSubmission({ ascend: ascendResult });

  // AirConnect needs to know about this lead once Ascend opens an order for
  // them - don't wait for a booking that may never happen.
  const pushLeadToAirConnectOnce = async () => {
    const pushed = await pushNewLeadToAirConnect({
      applicantId: leadId,
      customerName: formData.fullName,
      phoneNumber: e164Phone,
      idNumber: formData.authMethod === "singpass" && formData.nric ? formData.nric : undefined,
    });
    if (pushed) await markAirConnectLeadPushed(leadId);
  };

  if (ascendResult && isDatabaseConfigured()) {
    try {
      // Ascend's own user id, needed before any document can be uploaded
      // against this applicant - files hang off its user, not our id.
      await setAscendIdentity(leadId, {
        ascendUserId: ascendResult.userId,
        newCustomer: ascendResult.newCustomer,
        hasMyinfo: true,
      });
      await recordAscendOrder(leadId, ascendResult);
      await pushLeadToAirConnectOnce();
    } catch (err) {
      if (err instanceof DuplicateAscendOrderError) {
        // Already decided. Keep the first Order rather than buying a second.
        console.warn("[apply/submit] order already exists, keeping the first", leadId);

        // A resubmit lands here. Only push if the earlier attempt never did -
        // this must never send AirConnect the same lead twice.
        const existingApplicant = await getApplicant(leadId);
        if (existingApplicant && !existingApplicant.airconnect_lead_pushed_at) {
          await pushLeadToAirConnectOnce();
        }
      } else {
        console.error("[apply/submit] could not record Ascend order", err);
      }
    }
  }

  // ── 5. Update session with approval result (slim cookie - no CPF/NOA blobs) ─
  const updatedSession = buildPostSubmitSession(sessionData, leadId, {
    approvedLoanAmount: finalAssessment.approvedLoanAmount,
    verifiedMonthlyIncome: finalAssessment.verifiedMonthlyIncome,
    incomeSource: finalAssessment.incomeSource,
  });
  const encoded = encodeSession(updatedSession);

  const res = NextResponse.json({
    leadId,
    approvedLoanAmount: finalAssessment.approvedLoanAmount,
    verifiedMonthlyIncome: finalAssessment.verifiedMonthlyIncome,
    incomeSource: finalAssessment.incomeSource,
    // Ascend decides where the applicant goes. `isEligible` stays for the
    // analytics event the client still fires, but it no longer picks a page.
    destination: decision.destination,
    outcome: decision.kind,
    isEligible: decision.kind === "approved",
    aCardLimit: decision.kind === "approved" ? decision.aCardLimit : null,
    maximumLoanQuantum: decision.kind === "approved" ? decision.maximumLoanQuantum : null,
    maxEligibleLoan: finalAssessment.maxEligibleLoan,
    explanation: finalAssessment.explanation,
  });

  // Clear draft_lead + MyInfo blobs - no longer needed after full submit.
  res.cookies.set({ name: DRAFT_LEAD_COOKIE, value: "", maxAge: 0, path: "/" });
  res.cookies.set(clearMyinfoCookie());

  // Ascend asked for income, so the income step is now where this applicant
  // belongs and the funnel lock has to know it. Without this they would be
  // sent to the pending page - away from the one screen that can move them on.
  if (decision.kind === "needs_income") {
    res.cookies.set(incomeGateCookieValue(POST_SUBMIT_COOKIE_MAX_AGE_SEC));
  } else {
    res.cookies.set(clearIncomeGateCookie());
  }

  if (finalAssessment.isEligible && finalAssessment.approvedLoanAmount > 0) {
    const sc = sessionCookieValue(updatedSession);
    res.cookies.set({ ...sc, value: encoded });
    res.cookies.set(reviewGateCookieValue(POST_SUBMIT_COOKIE_MAX_AGE_SEC));
    res.cookies.set(
      approvalOfferCookieValue(
        storedApprovalOfferFromForm(leadId, formData, {
          approvedLoanAmount: finalAssessment.approvedLoanAmount,
          verifiedMonthlyIncome: finalAssessment.verifiedMonthlyIncome,
          incomeSource: finalAssessment.incomeSource,
        }),
      ),
    );
    return res;
  }

  applyClearApplyCookiesOnResponse(res);
  return res;
}
