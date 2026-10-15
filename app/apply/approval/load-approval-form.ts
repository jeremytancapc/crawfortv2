import { redirect } from "next/navigation";

import {
  getApprovalOffer,
  mergeOfferIntoFormData,
} from "@/lib/approval-offer";
import { getApplySession } from "@/lib/apply-session";
import { getAscendOrder } from "@/lib/db/ascend-orders";
import { getCreditAssessment } from "@/lib/db/credit-assessments";
import { initialLoanFormData, type LoanFormData } from "@/lib/loan-form";
import type { AscendLimits } from "@/lib/approval-display";
import { applyRedirectPath } from "@/lib/apply-variant-server";

export async function loadApprovalFormData(): Promise<{ formData: LoanFormData; limits?: AscendLimits }> {
  const session = await getApplySession();
  const offer = await getApprovalOffer();

  const leadId =
    (typeof session?.leadId === "string" && session.leadId.length > 0
      ? session.leadId
      : null) ??
    offer?.leadId ??
    null;

  if (!leadId) {
    redirect(await applyRedirectPath("/"));
  }

  const formData: LoanFormData = {
    ...initialLoanFormData,
    ...session,
    ...(offer ? mergeOfferIntoFormData(offer) : {}),
    leadId,
  };

  // Always read, not only when the amount is missing: the offer screens need
  // both of Ascend's limits, and the MLCB ceiling has no other source.
  const order = await getAscendOrder(leadId);
  const limits: AscendLimits | undefined = order
    ? {
        aCardLimit: order.a_card_limit === null ? null : Number(order.a_card_limit),
        maximumLoanQuantum:
          order.maximum_loan_quantum === null ? null : Number(order.maximum_loan_quantum),
      }
    : undefined;

  if (!formData.approvedLoanAmount || formData.approvedLoanAmount <= 0) {
    // Ascend's A-Card Limit is the authority on what can be borrowed
    // (ADR-0001). The engine's figure is only a fallback for an applicant who
    // has no order - one who came through before Ascend was switched on.
    if (order?.a_card_limit) {
      formData.approvedLoanAmount = Number(order.a_card_limit) || 0;
    }

    const row = await getCreditAssessment(leadId);

    if (row) {
      formData.approvedLoanAmount =
        formData.approvedLoanAmount || Number(row.engine_offer_amount) || 0;
      formData.verifiedMonthlyIncome = Number(row.verified_monthly_income) || 0;
      const src = row.income_source;
      if (src === "cpf" || src === "noa" || src === "self_declared") {
        formData.incomeSource = src;
      }
    }
  }

  if (!formData.approvedLoanAmount || formData.approvedLoanAmount <= 0) {
    redirect(await applyRedirectPath("/"));
  }

  return { formData, limits };
}
