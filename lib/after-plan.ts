/**
 * Where a customer goes once they have chosen a plan - one answer, used by every
 * screen that lets them choose.
 *
 * A standard plan goes to the accept page, which shows the amount and what will
 * be repaid. A custom plan goes straight to booking: it used to end on "Wait for
 * our call", and of the customers who chose it none booked. It skips accept
 * because a custom amount can be well above what Ascend approved, and that page
 * would read as approving it. Staff still see the request in the note saved with
 * the plan.
 */

export function pathAfterPlanChosen(choice: { planId: string; amount: number }): string {
  if (choice.planId === "custom") return "/apply/book";
  return `/apply/accept?amount=${choice.amount}`;
}
