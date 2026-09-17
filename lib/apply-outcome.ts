/**
 * Where an applicant goes once Ascend has answered.
 *
 * One function over one response. Callers get the destination, the applicant
 * status to persist and the amounts to show, without needing to know that
 * PASS is spelled differently from `passed`, that `creditScore` is empty on
 * PENDING, or which page each outcome belongs to.
 *
 * A discriminated union rather than an object with optional fields: the
 * amounts genuinely do not exist on a pending or declined outcome, and a type
 * that admits reading `aCardLimit` off one invites showing an applicant a
 * number Ascend never gave.
 */

import type { AscendCreditResult, AscendUser } from "./ascend/client";

export type ApplyOutcome =
  | {
      kind: "approved";
      destination: "/apply/approval";
      /** A-Card Limit: what Ascend will lend. May exceed the Desired Amount. */
      aCardLimit: number;
      /** Maximum Loan Quantum: the MLCB ceiling. */
      maximumLoanQuantum: number;
    }
  | {
      kind: "needs_income";
      destination: "/apply/verify-income";
      /** Ascend's own words, e.g. "There is no income, please submit income". */
      reason: string | null;
    }
  | {
      kind: "declined";
      /** The credit review queue, not a dead end. */
      destination: "/apply/pending";
      reason: string | null;
    };

export function decideApplyOutcome(result: AscendCreditResult): ApplyOutcome {
  if (result.risk.riskStatus === "PENDING") {
    return {
      kind: "needs_income",
      destination: "/apply/verify-income",
      reason: result.risk.riskMsg ?? null,
    };
  }

  const aCardLimit = result.creditScore.creditLimit;

  // A PASS that names no limit is not an offer. Falling back to zero would
  // render "$0" to an applicant as though Ascend had decided it.
  if (result.risk.riskStatus === "REJECT" || !aCardLimit || aCardLimit <= 0) {
    return {
      kind: "declined",
      destination: "/apply/pending",
      reason: result.risk.riskMsg ?? null,
    };
  }

  return {
    kind: "approved",
    destination: "/apply/approval",
    aCardLimit,
    maximumLoanQuantum: result.creditScore.mlcbMaxLoanAmount ?? 0,
  };
}

/**
 * What to do with an applicant once Ascend has identified them.
 *
 * Two facts arrive from /openApi/users and both change what happens next, so
 * both are resolved here rather than at the call site: whether they are a
 * Reloan Customer, and whether Ascend already holds their MyInfo.
 */
export type IdentityOutcome =
  | {
      kind: "reloan";
      /** Sent to the mobile app rather than shown an online offer. */
      destination: "/apply/reloan";
    }
  | {
      kind: "continue";
      /**
       * Which identifier /openApi/apply/credit should carry. `userId` alone
       * is refused with `600: The user has not authorized myinfo` until
       * Ascend holds that person's MyInfo - which submitting it once sets.
       */
      creditCallUses: "userId" | "myinfo";
    };

export function decideIdentityOutcome(user: AscendUser): IdentityOutcome {
  // Decided before any credit pull: a Reloan Customer never reaches
  // /openApi/apply/credit, so no order is created and nothing is spent on
  // someone who was always going to be redirected (ADR-0001).
  if (!user.newCustomer) {
    return { kind: "reloan", destination: "/apply/reloan" };
  }

  return { kind: "continue", creditCallUses: user.hasMyinfo ? "userId" : "myinfo" };
}
