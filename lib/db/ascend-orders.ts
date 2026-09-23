/**
 * The Ascend Order: created once per applicant, consumed by signing and
 * disbursement.
 *
 * Writing one is the moment ADR-0001's guarantee becomes real. The guard is
 * the UNIQUE constraint on applicant_id, not a check in this function: two
 * concurrent submits both pass a `select ... if not exists` and only one
 * survives an insert, and the difference is a duplicate credit pull against
 * a real person.
 */

import { toRiskStatus, type AscendCreditResult } from "@/lib/ascend/client";

import { sql, sqlOne } from "./sql";
import type { AscendOrder } from "./types";

/** Postgres raises 23505 for a unique violation. */
const UNIQUE_VIOLATION = "23505";

export class DuplicateAscendOrderError extends Error {
  readonly applicantId: string;

  constructor(applicantId: string) {
    super(`An Ascend order already exists for applicant ${applicantId}`);
    this.name = "DuplicateAscendOrderError";
    this.applicantId = applicantId;
  }
}

/**
 * Persists what Ascend decided, and returns the stored row.
 *
 * Throws DuplicateAscendOrderError when this applicant already has an order,
 * so the caller can show the existing decision rather than buying a second
 * one. Every other database error propagates untouched.
 */
export async function recordAscendOrder(
  applicantId: string,
  result: AscendCreditResult,
): Promise<AscendOrder> {
  try {
    const row = await sqlOne<AscendOrder>`
      insert into ascend_orders (
        applicant_id, order_id, risk_status,
        a_card_limit, maximum_loan_quantum, new_customer,
        credit_level, credit_score
      ) values (
        ${applicantId},
        ${result.orderId},
        ${toRiskStatus(result.risk.riskStatus)},
        ${result.creditScore.creditLimit ?? null},
        ${result.creditScore.mlcbMaxLoanAmount ?? null},
        ${result.newCustomer},
        ${result.creditScore.creditLevel ?? null},
        ${result.creditScore.creditScore ?? null}
      )
      returning *`;

    if (!row) throw new Error("recordAscendOrder returned no row");
    return row;
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new DuplicateAscendOrderError(applicantId);
    }
    throw err;
  }
}

export function getAscendOrder(applicantId: string): Promise<AscendOrder | null> {
  return sqlOne<AscendOrder>`select * from ascend_orders where applicant_id = ${applicantId}`;
}

/**
 * A stored order read back as the decision Ascend gave - the inverse of
 * recordAscendOrder, so an application that already has an order can be
 * decided from it rather than by buying a second credit pull.
 *
 * `userId` is not kept on the order (it lives on the applicant) and nothing
 * that decides a destination reads it. A missing risk_status reads as
 * PENDING: unknown is not approved.
 */
export function orderAsCreditResult(order: AscendOrder): AscendCreditResult {
  const amount = (value: string | null) => (value === null ? undefined : Number(value));
  return {
    orderId: order.order_id,
    userId: "",
    newCustomer: order.new_customer ?? true,
    risk: {
      riskStatus:
        order.risk_status === "passed" ? "PASS" : order.risk_status === "rejected" ? "REJECT" : "PENDING",
    },
    creditScore: {
      creditLimit: amount(order.a_card_limit),
      mlcbMaxLoanAmount: amount(order.maximum_loan_quantum),
      creditLevel: order.credit_level ?? undefined,
      creditScore: amount(order.credit_score),
    },
  };
}

/**
 * Overwrites an order's decision after Ascend has re-scored it.
 *
 * Submitting income turns a PENDING order into a PASS or a REJECT, and the
 * amounts arrive with it. The order_id does not change - this is the same
 * Order, decided.
 */
export async function updateAscendOrderDecision(
  applicantId: string,
  result: AscendCreditResult,
): Promise<void> {
  await sql`
    update ascend_orders set
      risk_status = ${toRiskStatus(result.risk.riskStatus)},
      a_card_limit = ${result.creditScore.creditLimit ?? null},
      maximum_loan_quantum = ${result.creditScore.mlcbMaxLoanAmount ?? null},
      credit_level = ${result.creditScore.creditLevel ?? null},
      credit_score = ${result.creditScore.creditScore ?? null}
    where applicant_id = ${applicantId}`;
}
