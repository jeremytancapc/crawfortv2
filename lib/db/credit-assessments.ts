/**
 * The local income engine's output.
 *
 * Since ADR-0001 this decides nothing - Ascend owns the borrowable amount.
 * It is written so its numbers can be compared against Ascend's in
 * production, which is the only way anyone would notice Ascend mis-reading,
 * say, a platform worker's CPF.
 */

import { sql, sqlOne } from "./sql";
import type { CreditAssessment, IncomeSource } from "./types";

export type CreditAssessmentInput = {
  incomeSource: IncomeSource;
  verifiedMonthlyIncome: number;
  /** The engine's ceiling. Comparison only. */
  underwrittenCap: number;
  /** The engine's offer figure. NOT an approved amount. */
  engineOfferAmount: number;
  isEligible: boolean;
  ageAtApplication?: number | null;
  existingLoans?: number;
  moneylenderLoanAmount?: number | null;
  moneylenderPaymentHistory?: string | null;
  explanation?: string | null;
  creditRejectionReason?: string | null;
  rawAssessment?: Record<string, unknown>;
};

/** One per applicant; re-submitting replaces the previous scoring. */
export async function upsertCreditAssessment(
  applicantId: string,
  input: CreditAssessmentInput,
): Promise<void> {
  await sql`
    insert into credit_assessments (
      applicant_id, income_source, verified_monthly_income, underwritten_cap,
      engine_offer_amount, is_eligible, age_at_application, existing_loans,
      moneylender_loan_amount, moneylender_payment_history, explanation,
      credit_rejection_reason, raw_assessment
    ) values (
      ${applicantId}, ${input.incomeSource}, ${input.verifiedMonthlyIncome},
      ${input.underwrittenCap}, ${input.engineOfferAmount}, ${input.isEligible},
      ${input.ageAtApplication ?? null}, ${input.existingLoans ?? 0},
      ${input.moneylenderLoanAmount ?? null}, ${input.moneylenderPaymentHistory ?? null},
      ${input.explanation ?? null}, ${input.creditRejectionReason ?? null},
      ${JSON.stringify(input.rawAssessment ?? {})}::jsonb
    )
    on conflict (applicant_id) do update set
      income_source = excluded.income_source,
      verified_monthly_income = excluded.verified_monthly_income,
      underwritten_cap = excluded.underwritten_cap,
      engine_offer_amount = excluded.engine_offer_amount,
      is_eligible = excluded.is_eligible,
      age_at_application = excluded.age_at_application,
      existing_loans = excluded.existing_loans,
      moneylender_loan_amount = excluded.moneylender_loan_amount,
      moneylender_payment_history = excluded.moneylender_payment_history,
      explanation = excluded.explanation,
      credit_rejection_reason = excluded.credit_rejection_reason,
      raw_assessment = excluded.raw_assessment`;
}

export function getCreditAssessment(applicantId: string): Promise<CreditAssessment | null> {
  return sqlOne<CreditAssessment>`
    select * from credit_assessments where applicant_id = ${applicantId}`;
}
