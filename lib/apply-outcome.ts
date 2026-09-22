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

/** Where an applicant goes once their income has been submitted and re-scored. */
export type AfterIncomeOutcome =
  | Extract<ApplyOutcome, { kind: "approved" } | { kind: "declined" }>
  | {
      kind: "in_review";
      /** The credit review queue, not a dead end. */
      destination: "/apply/pending";
      reason: string | null;
    };

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
 * Where an applicant goes after /openApi/income/credit has re-scored them.
 *
 * Deliberately not decideApplyOutcome. PENDING means two different things
 * depending on which call answered it: from apply/credit it means "no income
 * on file, send me some", and the applicant belongs on the upload page. From
 * income/credit it means the income has been taken and a human is looking -
 * and sending them back to the upload page loops them onto the documents they
 * just submitted. Seen on staging on 2026-09-18, where three payslips
 * uploaded cleanly, income/credit answered PENDING with no riskMsg, and the
 * applicant was returned to the upload screen.
 */
export function decideAfterIncome(result: AscendCreditResult): AfterIncomeOutcome {
  if (result.risk.riskStatus === "PENDING") {
    return {
      kind: "in_review",
      destination: "/apply/pending",
      reason: result.risk.riskMsg ?? null,
    };
  }

  const decided = decideApplyOutcome(result);
  // Unreachable: decideApplyOutcome only answers needs_income for PENDING,
  // which is handled above. Narrowed rather than cast so a future status
  // cannot slip through as an approval.
  if (decided.kind === "needs_income") {
    return { kind: "in_review", destination: "/apply/pending", reason: decided.reason };
  }
  return decided;
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
      /** Recorded even here: it identifies who was redirected, and why. */
      userId: string;
    }
  | {
      kind: "continue";
      /**
       * Which identifier /openApi/apply/credit should carry.
       *
       * Always "myinfo" today. The endpoint refuses a bare userId in both
       * directions: `600: The user has not authorized myinfo` before Ascend
       * holds the payload, and - observed on staging 2026-09-17 - `500: System
       * error` after it says it does. Two calls carrying the full payload
       * either side of that one succeeded.
       *
       * Kept as a union because sending the payload is the expensive half of
       * this request, and this is the single line to change when Ascend
       * accepts a userId.
       */
      creditCallUses: "userId" | "myinfo";
      /** What Ascend reported, recorded as-is rather than inferred from what we send. */
      hasMyinfo: boolean;
      /**
       * Ascend's own user id. /openApi/users is the only call that returns
       * it, and every document upload is addressed by it - so it travels with
       * the outcome rather than being fetched again later.
       */
      userId: string;
    };

export function decideIdentityOutcome(user: AscendUser): IdentityOutcome {
  // Decided before any credit pull: a Reloan Customer never reaches
  // /openApi/apply/credit, so no order is created and nothing is spent on
  // someone who was always going to be redirected (ADR-0001).
  if (!user.newCustomer) {
    return { kind: "reloan", destination: "/apply/reloan", userId: user.userId };
  }

  return {
    kind: "continue",
    // Not `user.hasMyinfo ? "userId" : "myinfo"`. Trusting hasMyinfo cost a
    // real applicant their application: Ascend reported it held the payload,
    // we sent the userId alone, and the credit call answered 500.
    creditCallUses: "myinfo",
    hasMyinfo: user.hasMyinfo,
    userId: user.userId,
  };
}

export type SubmissionDecision =
  | ApplyOutcome
  | {
      kind: "unavailable";
      destination: "/apply/pending";
      reason: string;
    };

/**
 * The whole submit-time decision.
 *
 * The local income engine is deliberately not an input. It still runs at
 * submit and its Underwritten Cap is still persisted, but since ADR-0001 it
 * decides nothing - and a number that decides nothing has no business in the
 * function that decides. Reloan Customers are filtered out earlier, by
 * Ascend's own identity check (lib/ascend/identity.ts) - not by this
 * function, and not by AirConnect.
 */
export function decideSubmission(input: {
  ascend: AscendCreditResult | null;
}): SubmissionDecision {
  const { ascend } = input;

  // No answer from Ascend is not an approval. Every other external call here
  // is written never to block, but this one cannot: without Ascend there
  // is no amount to show, so the applicant sees a failure state (ADR-0001).
  if (!ascend) {
    return {
      kind: "unavailable",
      destination: "/apply/pending",
      reason: "We could not complete your application just now. Please try again shortly.",
    };
  }

  return decideApplyOutcome(ascend);
}
