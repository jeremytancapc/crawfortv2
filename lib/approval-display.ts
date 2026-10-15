import type { LoanFormData } from "@/lib/loan-form";

/** What Ascend decided this applicant may borrow. */
export type AscendLimits = {
  /** A-Card Limit: what Ascend will lend. The offer. */
  aCardLimit: number | null;
  /** Maximum Loan Quantum: the MLCB ceiling across all licensed moneylenders. */
  maximumLoanQuantum: number | null;
};

/**
 * The figures the post-approval screens show.
 *
 * These used to be three and six times the applicant's monthly income - our
 * own arithmetic, applied to an offer that is not ours to make. ADR-0001 is
 * explicit that Ascend owns the borrowable amount, and Ascend's A-Card Limit
 * was being saved and then ignored, so an applicant could be shown a figure
 * no licensed lender had agreed to.
 *
 * So the offer is Ascend's limit, floored by the MLCB ceiling. Ascend applies
 * that ceiling on their side already; applying it again costs nothing and
 * means a wrong A-Card Limit cannot become an unlawful offer.
 *
 * Without an order - an applicant from before Ascend was switched on - the
 * amount stored on their assessment stands in. What never stands in is a
 * multiple of income, because that is the number this function existed to
 * stop inventing.
 *
 * `creditLimit` and `withdrawToday` used to always be the same figure - noted
 * here as something a future revolving product would make genuinely differ.
 * That product is the gauge's "Unlocks later" reserve: `creditLimit` is now
 * the structural ceiling Ascend's own numbers imply (double the approved
 * amount, never past MLCB), and `withdrawToday` stays what can actually be
 * drawn now. Across every real order seen so far MLCB sits 5-50x the A-Card
 * Limit, so the reserve is usually the full double - but when MLCB is the
 * tighter number, the reserve shrinks with it, and when MLCB has already
 * capped the approved amount itself, `creditLimit` collapses back to
 * `withdrawToday` and the gauge shows no reserve at all - never a locked zone
 * with nothing behind it.
 */
export function approvalOfferDisplay(formData: LoanFormData, limits?: AscendLimits) {
  const stored = Number(formData.approvedLoanAmount) || 0;

  const approved = limits ? (limits.aCardLimit ?? 0) : stored;
  const ceiling = limits?.maximumLoanQuantum ?? null;
  const offer = ceiling !== null && ceiling > 0 ? Math.min(approved, ceiling) : approved;

  // No Ascend order behind this applicant (pre-Ascend fallback): there is
  // nothing to derive a reserve from, so none is shown.
  const reserve = limits
    ? (ceiling !== null && ceiling > 0 ? Math.min(approved * 2, ceiling) : approved * 2)
    : offer;

  return {
    displayData: { ...formData, amount: offer },
    creditLimit: reserve,
    withdrawToday: offer,
  };
}

export function formatOfferAmount(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
