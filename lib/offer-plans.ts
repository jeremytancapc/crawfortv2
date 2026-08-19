/**
 * Loan offer plan math and definitions for the /apply/approval confirmation page.
 *
 * Interest rates here are specific to the offer page - the earlier funnel uses
 * ESTIMATED_MONTHLY_INTEREST_RATE (3.92%) from lib/loan-form.ts as an estimate.
 * Do not mix them up.
 */

/** Standard offer rate: 3.92% per month. */
export const OFFER_MONTHLY_RATE = 0.0392;

/** Ceiling on the processing fee deducted at disbursement, as a % of the loan. */
export const OFFER_MAX_PROCESSING_FEE_PCT = 10;

export const MAX_OFFER_TENURE = 12;
export const MIN_OFFER_TENURE = 1;

/**
 * Display name for each plan id, used on the acceptance page. Kept short
 * (no "Plan" suffix) to match the plan cards shown on the approval page.
 */
export const PLAN_TITLES: Record<string, string> = {
  lowest_interest: "SuperSaver",
  average: "ValuePro",
  lowest_instalment: "FlexiPay",
  custom: "Custom offer",
};

/**
 * Resolves the plan id to use for display when the persisted `selected_plan`
 * value is missing or unrecognized (e.g. an older lead saved before this
 * field existed, or a write that failed to land). Falls back to matching the
 * lead's tenure against the standard plan tenures, same approach already
 * used for amount/tenure fallbacks on the acceptance page.
 */
export function resolvePlanId(
  rawPlanId: string | null | undefined,
  tenure: number,
): string {
  if (rawPlanId && PLAN_TITLES[rawPlanId]) return rawPlanId;
  if (tenure === 3) return "lowest_interest";
  if (tenure === 6) return "average";
  if (tenure === MAX_OFFER_TENURE) return "lowest_instalment";
  return "custom";
}

export const OFFER_CONFIRMATION_DISCLAIMER =
  "This offer stands from the time of acceptance until loan disbursement, provided there are no changes to your income and you do not apply with another lender in a way that affects your credit profile.";

/** Amortized monthly instalment (same formula as calculateMonthlyRepayment but parameterised). */
export function calculateInstalment(amount: number, months: number, monthlyRate: number): number {
  if (months <= 0 || amount <= 0) return 0;
  if (monthlyRate === 0) return amount / months;
  return (amount * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
    (Math.pow(1 + monthlyRate, months) - 1);
}

export interface ScheduleInstallment {
  /** 1-based instalment number. */
  index: number;
  dueDateIso: string;
  amount: number;
}

/**
 * Adds `months` calendar months to `date`, clamping the day-of-month so
 * e.g. 31 Jan + 1 month lands on 28/29 Feb instead of overflowing into
 * March (the native `Date.setMonth` behaviour).
 */
function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const daysInTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, daysInTargetMonth));
  return result;
}

/**
 * Builds the full monthly repayment schedule, one row per instalment,
 * starting exactly one month after `disbursementIso`. Every instalment is
 * the same fixed amount, matching the `totalRepayment = monthlyInstalment
 * * tenure` math used elsewhere on the acceptance page - so there's no
 * rounding remainder to special-case on the final row.
 */
export function buildPaymentSchedule(
  disbursementIso: string,
  tenure: number,
  monthlyInstalment: number,
): ScheduleInstallment[] {
  if (tenure <= 0 || monthlyInstalment <= 0) return [];
  const disbursementDate = new Date(disbursementIso);
  const schedule: ScheduleInstallment[] = [];
  for (let i = 1; i <= tenure; i++) {
    const dueDate = addMonthsClamped(disbursementDate, i);
    schedule.push({
      index: i,
      dueDateIso: dueDate.toISOString(),
      amount: monthlyInstalment,
    });
  }
  return schedule;
}

export interface OfferPlan {
  id: "lowest_interest" | "lowest_instalment" | "average" | "custom";
  title: string;
  /** Benefit-led headline on the card front - sells the plan, no figures. */
  pitch: string;
  /** Two short proof points under the pitch. Kept to ~3 words for the 3-up grid. */
  sellingPoints: [string, string];
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
    pitch: string,
    sellingPoints: [string, string],
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
      pitch,
      sellingPoints,
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
      "Pay the least overall",
      ["Least interest", "Fastest payoff"],
      3,
      OFFER_MONTHLY_RATE,
    ),
    make(
      "average",
      "ValuePro Plan",
      "Best of both worlds",
      ["Balanced monthly", "Most chosen"],
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
      "Easiest on your wallet",
      ["Lowest monthly", "Most flexible"],
      MAX_OFFER_TENURE,
      OFFER_MONTHLY_RATE,
    ),
  ];
}
