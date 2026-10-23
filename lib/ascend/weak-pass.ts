/**
 * TEMPORARY - remove this file, and its one call in lib/apply-outcome.ts, when
 * Ascend answers PENDING for these cases itself.
 *
 * Ascend is meant to answer PENDING when the credit score is under 550 or the
 * credit limit is under $300. Today it answers PASS (seen in production on
 * 21 Oct: score 539, limit $1,200). Until that is fixed, such a PASS is treated
 * as a PENDING here and goes through the usual workflow - the income step,
 * then staff review - rather than being shown as an offer.
 *
 * Exactly 550 and exactly $300 are still a pass. A figure Ascend did not send
 * cannot be judged and counts as fine; a missing limit is a different case,
 * handled where the decision is made.
 *
 * Off with ASCEND_WEAK_PASS_AS_PENDING=false, for the day Ascend is fixed and
 * before this file is deleted.
 */

import type { AscendCreditResult } from "./client";

export const MIN_CREDIT_SCORE = 550;
export const MIN_CREDIT_LIMIT = 300;

function ruleIsOn(): boolean {
  return process.env.ASCEND_WEAK_PASS_AS_PENDING !== "false";
}

/** Why a PASS is too weak to stand, in words for staff and logs; null when it stands. */
export function weakPassReason(score: AscendCreditResult["creditScore"]): string | null {
  if (!ruleIsOn()) return null;
  if (typeof score.creditScore === "number" && score.creditScore < MIN_CREDIT_SCORE) {
    return `Credit score ${score.creditScore} is below ${MIN_CREDIT_SCORE}`;
  }
  if (typeof score.creditLimit === "number" && score.creditLimit < MIN_CREDIT_LIMIT) {
    return `Credit limit ${score.creditLimit} is below ${MIN_CREDIT_LIMIT}`;
  }
  return null;
}
