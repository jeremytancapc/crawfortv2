/**
 * Shared apply-funnel progress. Total includes the in-person visit, which is
 * never shown in-app — so the booked page tops out below 100%.
 *
 * Flip SHOW_INCOME_STEP to put self-declared income back between amount and
 * Singpass; every later step shifts by one.
 */
export const SHOW_INCOME_STEP = false;

const OFFSET = SHOW_INCOME_STEP ? 1 : 0;

export const APPLY_PROGRESS = {
  amount: 1,
  income: 2,
  singpass: 2 + OFFSET,
  verifyOrIdentity: 3 + OFFSET,
  reviewInfo: 4 + OFFSET,
  completeApp: 5 + OFFSET,
  choosePlan: 6 + OFFSET,
  confirmTerms: 7 + OFFSET,
  book: 8 + OFFSET,
  booked: 9 + OFFSET,
  visit: 10 + OFFSET,
} as const;

/** Last step is attending the appointment in person. */
export const APPLY_PROGRESS_TOTAL = APPLY_PROGRESS.visit;

/** The badge reads "Start" rather than a percentage on this step. */
export const APPLY_PROGRESS_START = APPLY_PROGRESS.amount;

/** From here the only thing left is turning up, so the badge names it. */
export const APPLY_PROGRESS_APPOINTMENT = APPLY_PROGRESS.booked;

export type ApplyProgressHint = {
  /** What the applicant has to do to move the number up. */
  title: string;
  detail: string;
};

/**
 * Keyed by step number, so steps that collapse onto the same number when
 * SHOW_INCOME_STEP is off resolve to the later entry — list them in flow order.
 */
const APPLY_PROGRESS_HINTS = new Map<number, ApplyProgressHint>([
  [
    APPLY_PROGRESS.amount,
    {
      title: "Choose your loan amount",
      detail: "Pick how much you need.",
    },
  ],
  [
    APPLY_PROGRESS.income,
    {
      title: "Confirm your monthly income",
      detail: "Enter what you earn each month.",
    },
  ],
  [
    APPLY_PROGRESS.singpass,
    {
      title: "Retrieve your details",
      detail: "Continue with Singpass.",
    },
  ],
  [
    APPLY_PROGRESS.verifyOrIdentity,
    {
      title: "Verify your income",
      detail: "Upload your payslips or bank statements.",
    },
  ],
  [
    APPLY_PROGRESS.reviewInfo,
    {
      title: "Check your details",
      detail: "Confirm everything, then submit.",
    },
  ],
  [
    APPLY_PROGRESS.completeApp,
    {
      title: "We're reviewing your application",
      detail: "Wait for our update.",
    },
  ],
  [
    APPLY_PROGRESS.choosePlan,
    {
      title: "Confirm your loan amount",
      detail: "Choose the amount and repayment plan that fits.",
    },
  ],
  [
    APPLY_PROGRESS.confirmTerms,
    {
      title: "Confirm your loan terms",
      detail: "Accept the plan you chose.",
    },
  ],
  [
    APPLY_PROGRESS.book,
    {
      title: "Book your appointment",
      detail: "Pick a date and time to visit.",
    },
  ],
  [
    APPLY_PROGRESS.booked,
    {
      title: "Your funds are reserved",
      detail: "Attend your appointment.",
    },
  ],
  [
    APPLY_PROGRESS.visit,
    {
      title: "You're all set",
      detail: "Your loan is complete.",
    },
  ],
]);

export function applyProgressHint(step: number): ApplyProgressHint {
  return (
    APPLY_PROGRESS_HINTS.get(step) ?? {
      title: "Continue",
      detail: "Finish this step.",
    }
  );
}
