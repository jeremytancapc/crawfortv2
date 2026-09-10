/**
 * The six stages a customer sees in the /v2 header. Coarser than
 * `APPLY_PROGRESS` on purpose - the header bar is a glanceable "how much is
 * left", not a step counter.
 */
export const V2_STAGES = [
  "setup",
  "verify",
  "review",
  "offer",
  "accept",
  "book",
] as const;

export type V2Stage = (typeof V2_STAGES)[number];

/**
 * Copy for the desktop sidebar stepper, where the same six stages have room
 * for a name and one supporting line. Phones only ever see the bar.
 */
export const V2_STAGE_META: Record<V2Stage, { label: string; detail: string }> = {
  setup: { label: "Loan", detail: "Amount, term and payout" },
  verify: { label: "Income", detail: "Payslips or Singpass" },
  review: { label: "Details", detail: "Confirm who you are" },
  offer: { label: "Offer", detail: "Your approved plan" },
  accept: { label: "Accept", detail: "Terms and signature" },
  book: { label: "Collect", detail: "Book a visit to our office" },
};

/**
 * Canonical (unprefixed - pass through `useApplyPath`) entry route for each
 * stage. Shared by the desktop rail (clicking a step) and the setup
 * screen's forward control (clicking the logo, or the header's own forward
 * chevron, to resume at the furthest point reached this session).
 */
export const V2_STAGE_HREF: Record<V2Stage, string> = {
  setup: "/",
  verify: "/apply/verify-income",
  review: "/apply/review",
  offer: "/apply/approval",
  accept: "/apply/accept",
  book: "/apply/book",
};

export interface V2Progress {
  stage: V2Stage;
  /** 0-1 fill of the current stage's segment. Defaults to a started stage. */
  fraction?: number;
}

/** Per-segment fill (0-1) for the header bar. */
export function v2ProgressFills(progress: V2Progress): number[] {
  const index = V2_STAGES.indexOf(progress.stage);
  const fraction = Math.min(1, Math.max(0.15, progress.fraction ?? 0.15));
  return V2_STAGES.map((_, i) => {
    if (i < index) return 1;
    if (i === index) return fraction;
    return 0;
  });
}
