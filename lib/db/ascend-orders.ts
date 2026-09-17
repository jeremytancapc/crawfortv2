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

import { sqlOne } from "./sql";
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
