/**
 * Where a customer goes once they have chosen a plan - one answer, used by every
 * screen that lets them choose.
 *
 * Every plan, Custom included, goes to the accept page carrying the amount they
 * picked. Custom used to end on "Wait for our call", and of the customers who
 * chose it none booked.
 */

export function pathAfterPlanChosen(choice: { planId: string; amount: number }): string {
  return `/apply/accept?amount=${choice.amount}`;
}
