/**
 * Puts the applicant's chosen plan on their Ascend Order.
 *
 * Never throws and never blocks. The plan is already saved by the time this
 * runs, so a failed note is a missing note - not a lost selection, and not a
 * step the applicant has to repeat.
 */

import { getAscendOrder } from "@/lib/db/ascend-orders";
import { isDatabaseConfigured } from "@/lib/db/sql";

import { ascendAddOrderComment, AscendError } from "./client";
import { ascendConfig } from "./config";
import { formatPlanComment, type PlanComment } from "./plan-comment";

export async function recordPlanOnAscendOrder(
  applicantId: string,
  plan: PlanComment,
): Promise<void> {
  if (!ascendConfig() || !isDatabaseConfigured()) return;

  try {
    const order = await getAscendOrder(applicantId);
    // No order means Ascend never decided for this applicant - there is
    // nothing to comment on.
    if (!order) return;

    await ascendAddOrderComment({
      orderId: order.order_id,
      comments: formatPlanComment(plan),
    });
  } catch (err) {
    if (err instanceof AscendError) {
      console.error(`[ascend] order/comments failed ${err.code}: ${err.msg}`);
    } else {
      console.error("[ascend] order/comments failed", err);
    }
  }
}

/**
 * Puts a free-text note on the applicant's Ascend Order, for the staff who
 * review it. Same rules as the plan note: never throws, never blocks.
 */
export async function recordNoteOnAscendOrder(applicantId: string, note: string): Promise<void> {
  if (!ascendConfig() || !isDatabaseConfigured()) return;

  try {
    const order = await getAscendOrder(applicantId);
    if (!order) return;
    await ascendAddOrderComment({ orderId: order.order_id, comments: note });
  } catch (err) {
    if (err instanceof AscendError) {
      console.error(`[ascend] order/comments failed ${err.code}: ${err.msg}`);
    } else {
      console.error("[ascend] order/comments failed", err);
    }
  }
}
