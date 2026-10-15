import {
  getApprovalOffer,
  mergeOfferIntoFormData,
} from "@/lib/approval-offer";
import { getApplySession } from "@/lib/apply-session";
import { getApplicant } from "@/lib/db/applicants";
import { initialLoanFormData } from "@/lib/loan-form";
import {
  PLAN_TITLES,
  OFFER_MONTHLY_RATE,
  calculateInstalment,
  resolvePlanId,
} from "@/lib/offer-plans";
import {
  formatPlanAdditionalRequestsLabel,
  getPlanAdditionalRequests,
} from "@/lib/plan-additional-requests";
import { MIN_WITHDRAW_AMOUNT } from "@/lib/withdraw-amount";

export interface SelectedPlanData {
  planId: string;
  planTitle: string;
  amount: number;
  tenure: number;
  monthlyInstalment: number;
  monthlyRate: number;
  totalRepayment: number;
  totalInterest: number;
  /** Labels for optional requests ticked on the approval page, e.g. "Longer tenure". */
  additionalRequests: string[];
}

/**
 * Resolves the plan the customer chose for the acceptance page. Prefers the
 * persisted lead row, falling back to session/offer data so the page always
 * renders even if the select-plan write hasn't landed yet. Returns `null`
 * when there is no lead to accept against.
 */
export async function loadSelectedPlan(
  amountOverride?: number | null,
): Promise<{
  plan: SelectedPlanData;
  leadId: string;
} | null> {
  const session = await getApplySession();
  const offer = await getApprovalOffer();

  const merged = {
    ...initialLoanFormData,
    ...session,
    ...(offer ? mergeOfferIntoFormData(offer) : {}),
  };

  const leadId =
    (typeof session?.leadId === "string" && session.leadId.length > 0
      ? session.leadId
      : null) ??
    offer?.leadId ??
    null;

  if (!leadId) return null;

  const row = await getApplicant(leadId);

  const persistedAmount = Number(row?.desired_amount) || 0;
  const approvedAmount = Number(merged.approvedLoanAmount) || 0;
  // Prefer an explicit overwrite from the plan page (query) over the lead
  // row, which still holds the original application request until select-plan
  // lands.
  const amount =
    (amountOverride && amountOverride >= MIN_WITHDRAW_AMOUNT
      ? amountOverride
      : 0) ||
    persistedAmount ||
    approvedAmount ||
    0;
  const tenure =
    Number(row?.loan_tenure) ||
    Number(merged.tenure) ||
    0;
  // If selected_plan is missing/unrecognized, infer it from tenure so the
  // acceptance page never shows a broken placeholder instead of a real name.
  const planId = resolvePlanId(row?.selected_plan, tenure);
  const monthlyRate =
    Number(row?.plan_monthly_rate) ||
    OFFER_MONTHLY_RATE;
  const storedInstalment = Number(row?.plan_monthly_instalment) || 0;
  const monthlyInstalment =
    amountOverride && amount > 0 && tenure > 0
      ? Math.ceil(calculateInstalment(amount, tenure, monthlyRate))
      : storedInstalment ||
        (amount > 0 && tenure > 0
          ? Math.ceil(calculateInstalment(amount, tenure, monthlyRate))
          : 0);
  const totalRepayment = monthlyInstalment * tenure;
  const totalInterest = Math.max(0, totalRepayment - amount);

  const additionalRequests = formatPlanAdditionalRequestsLabel(
    await getPlanAdditionalRequests(),
  );

  return {
    leadId,
    plan: {
      planId,
      planTitle: PLAN_TITLES[planId] ?? PLAN_TITLES.custom,
      amount,
      tenure,
      monthlyInstalment,
      monthlyRate,
      totalRepayment,
      totalInterest,
      additionalRequests,
    },
  };
}
