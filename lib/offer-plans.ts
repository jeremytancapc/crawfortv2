/**
 * Loan offer plan math and definitions for the /apply/approval confirmation page.
 *
 * Interest rates here are specific to the offer page - the earlier funnel uses
 * ESTIMATED_MONTHLY_INTEREST_RATE (3.92%) from lib/loan-form.ts as an estimate.
 * Do not mix them up.
 */

/** Standard offer rate: 3.92% per month. */
export const OFFER_MONTHLY_RATE = 0.0392;

export const MAX_OFFER_TENURE = 12;
export const MIN_OFFER_TENURE = 1;

/** Display name for each plan id, used on the acceptance page. */
export const PLAN_TITLES: Record<string, string> = {
  lowest_interest: "SuperSaver Plan",
  average: "ValuePro Plan",
  lowest_instalment: "FlexiPay Plan",
  custom: "Custom plan",
};

export const OFFER_CONFIRMATION_DISCLAIMER =
  "This offer stands from the time of acceptance until loan disbursement, provided there are no changes to your income and you do not apply with another lender in a way that affects your credit profile.";

/** Amortized monthly instalment (same formula as calculateMonthlyRepayment but parameterised). */
export function calculateInstalment(amount: number, months: number, monthlyRate: number): number {
  if (months <= 0 || amount <= 0) return 0;
  if (monthlyRate === 0) return amount / months;
  return (amount * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
    (Math.pow(1 + monthlyRate, months) - 1);
}

export interface OfferPlan {
  id: "lowest_interest" | "lowest_instalment" | "average" | "custom";
  title: string;
  tagline: string;
  badge?: string;
  tenure: number;
  monthlyRate: number;
  monthlyInstalment: number;
  totalInterest: number;
  totalRepayment: number;
  isPopular?: boolean;
}

export function buildOfferPlans(approvedAmount: number): [OfferPlan, OfferPlan, OfferPlan] {
  const make = (
    id: OfferPlan["id"],
    title: string,
    tagline: string,
    tenure: number,
    monthlyRate: number,
    opts?: { badge?: string; isPopular?: boolean },
  ): OfferPlan => {
    const monthlyInstalment = Math.ceil(calculateInstalment(approvedAmount, tenure, monthlyRate));
    const totalRepayment = monthlyInstalment * tenure;
    const totalInterest = totalRepayment - approvedAmount;
    return {
      id,
      title,
      tagline,
      tenure,
      monthlyRate,
      monthlyInstalment,
      totalInterest: Math.max(0, totalInterest),
      totalRepayment,
      ...opts,
    };
  };

  return [
    make(
      "lowest_interest",
      "SuperSaver Plan",
      "Shortest tenure - least interest paid",
      3,
      OFFER_MONTHLY_RATE,
    ),
    make(
      "average",
      "ValuePro Plan",
      "Even split of payments and interest",
      6,
      OFFER_MONTHLY_RATE,
      {
        badge: "Most popular - customers' top pick",
        isPopular: true,
      },
    ),
    make(
      "lowest_instalment",
      "FlexiPay Plan",
      "Smallest monthly payment, spread out longer",
      MAX_OFFER_TENURE,
      OFFER_MONTHLY_RATE,
    ),
  ];
}
