import { APPLY_TRACE_ID_KEY } from "@/lib/apply-flow-log";
import type { LoanFormData } from "@/lib/loan-form";

type SessionWithTrace = Partial<LoanFormData> & { applyTraceId?: string };

/**
 * Session cookie after Singpass activate - identity + loan fields only.
 * Full CPF/NOA live in myinfo_profiles (keyed by draft_lead) and are hydrated
 * on /apply/review. singpassRawKey stays as the key into myinfo_retrievals.
 */
/**
 * `applicantId` travels in the session as well as the draft_lead cookie.
 *
 * Not belt and braces for its own sake. The draft_lead cookie is set on a
 * response the browser reaches by a cross-site redirect from the Lambda, and
 * a separate cookie set on that hop is exactly what Safari's tracking
 * prevention and SameSite edge cases drop. When it goes missing, submit
 * cannot tell an applicant who just finished MyInfo from a brand-new one, and
 * inserts a second row - leaving the first stranded as `in_progress` forever.
 *
 * The session cookie demonstrably survives that hop: the review page renders
 * MyInfo out of it.
 */
export function buildActivateSessionCookie(
  merged: SessionWithTrace,
  applicantId?: string | null,
): SessionWithTrace {
  return {
    ...(applicantId ? { leadId: applicantId } : {}),
    amount: merged.amount,
    tenure: merged.tenure,
    urgency: merged.urgency,
    authMethod: merged.authMethod,
    idType: merged.idType,
    fullName: merged.fullName,
    nric: merged.nric,
    email: merged.email,
    mobile: merged.mobile,
    secondaryMobile: merged.secondaryMobile,
    postalCode: merged.postalCode,
    address: merged.address,
    loanPurpose: merged.loanPurpose,
    monthlyIncome: merged.monthlyIncome,
    maritalStatus: merged.maritalStatus,
    dob: merged.dob,
    singpassRawKey: merged.singpassRawKey,
    [APPLY_TRACE_ID_KEY]: merged[APPLY_TRACE_ID_KEY],
    cpfContributions: [],
    noaHistory: [],
  };
}

/**
 * Strip heavy MyInfo arrays from the session cookie after submit so Set-Cookie
 * stays under the browser ~4 KB limit (common on Singpass flows).
 */
export function buildPostSubmitSession(
  session: Partial<LoanFormData>,
  leadId: string,
  assessment: {
    approvedLoanAmount: number;
    verifiedMonthlyIncome: number;
    incomeSource: LoanFormData["incomeSource"];
  },
): Partial<LoanFormData> {
  return {
    amount: session.amount,
    tenure: session.tenure,
    urgency: session.urgency,
    authMethod: session.authMethod,
    idType: session.idType,
    fullName: session.fullName,
    nric: session.nric,
    email: session.email,
    mobile: session.mobile,
    secondaryMobile: session.secondaryMobile,
    postalCode: session.postalCode,
    address: session.address,
    loanPurpose: session.loanPurpose,
    monthlyIncome: session.monthlyIncome,
    maritalStatus: session.maritalStatus,
    leadId,
    approvedLoanAmount: assessment.approvedLoanAmount,
    verifiedMonthlyIncome: assessment.verifiedMonthlyIncome,
    incomeSource: assessment.incomeSource,
    cpfContributions: [],
    noaHistory: [],
    singpassRawKey: "",
  };
}

/**
 * The session handed to activate in the callback's redirect URL.
 *
 * Deliberately without the CPF and NOA arrays. They are 85% of the encoded
 * size - 3415 bytes with them, 514 without - and they travel in a URL, where
 * the limits are lower and less forgiving than a cookie's: some proxies and
 * older browsers truncate past ~2000 bytes, and a truncated token fails to
 * verify rather than arriving short.
 *
 * Activate re-reads them from myinfo_retrievals using singpassRawKey, which
 * is the same payload the callback has just stored.
 */
export function buildActivateToken(
  patch: Partial<LoanFormData>,
  singpassRawKey: string,
): Partial<LoanFormData> {
  return {
    ...patch,
    singpassRawKey,
    cpfContributions: [],
    noaHistory: [],
  };
}
