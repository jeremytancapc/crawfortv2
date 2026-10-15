/**
 * The note Ascend's staff see when an applicant picks a plan.
 *
 * Pure: it builds the text and nothing else, so what gets written to a real
 * Order can be asserted without calling one.
 */

export type PlanComment = {
  planId: string;
  amount: number;
  tenure: number;
  monthlyInstalment?: number | null;
  additionalRequests?: string[];
  isCustomPlan?: boolean;
};

/**
 * One line, because Ascend shows comments as free text and there is no
 * endpoint to read them back - whether a second comment appends or overwrites
 * is unconfirmed, so each one has to stand alone rather than assume the
 * previous is still there.
 */
export function formatPlanComment(input: PlanComment): string {
  const money = (n: number) => `S$${n.toLocaleString("en-SG")}`;
  const parts = [
    `Plan selected: ${input.planId}`,
    `${money(input.amount)} over ${input.tenure} ${input.tenure === 1 ? "month" : "months"}`,
  ];

  if (input.monthlyInstalment && input.monthlyInstalment > 0) {
    parts.push(`monthly ${money(Math.round(input.monthlyInstalment))}`);
  }
  if (input.isCustomPlan) {
    parts.push("CUSTOM OFFER - needs staff follow-up");
  }
  if (input.additionalRequests?.length) {
    parts.push(`requests: ${input.additionalRequests.join("; ")}`);
  }

  return parts.join(" | ");
}
