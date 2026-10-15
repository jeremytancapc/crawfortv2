import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs against a real Postgres, because the behaviour under test is a
 * Postgres behaviour: the UNIQUE constraint that stops a second Ascend order
 * being created against one applicant. A fake would assert nothing.
 *
 *   bash scripts/db-test-server.sh start
 *   TEST_DATABASE_URL=$(bash scripts/db-test-server.sh start) npx vitest run lib/db
 */
const TEST_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_URL)("recordAscendOrder", () => {
  let recordAscendOrder: typeof import("./ascend-orders").recordAscendOrder;
  let DuplicateAscendOrderError: typeof import("./ascend-orders").DuplicateAscendOrderError;
  let insertApplicant: typeof import("./applicants").insertApplicant;
  let sql: typeof import("./sql").sql;

  let applicantId: string;

  beforeAll(async () => {
    // Set before the pool is first opened: sql.ts reads DATABASE_URL lazily.
    process.env.DATABASE_URL = TEST_URL;
    ({ recordAscendOrder, DuplicateAscendOrderError } = await import("./ascend-orders"));
    ({ insertApplicant } = await import("./applicants"));
    ({ sql } = await import("./sql"));

    applicantId = await insertApplicant({
      desiredAmount: 5000,
      loanTenure: 6,
      authMethod: "singpass",
      status: "in_progress",
    });
  });

  afterAll(async () => {
    if (applicantId) await sql`delete from applicants where id = ${applicantId}`;
  });

  it("stores Ascend's decision against the applicant", async () => {
    const order = await recordAscendOrder(applicantId, {
      orderId: "1549849627749851136",
      userId: "1426270128715821056",
      newCustomer: false,
      risk: { riskStatus: "PASS" },
      creditScore: {
        creditLevel: "A",
        creditLimit: 8000,
        creditScore: 588.26,
        mlcbMaxLoanAmount: 45807.28,
      },
    });

    // The id survives as a string: 1549849627749851136 is past
    // Number.MAX_SAFE_INTEGER and would round to ...851000 as a number.
    expect(order.order_id).toBe("1549849627749851136");
    // PASS on the wire, `passed` in the glossary and the database.
    expect(order.risk_status).toBe("passed");
    expect(order.a_card_limit).toBe("8000.00");
  });

  it("refuses a second order for the same applicant", async () => {
    // ADR-0001: the credit call happens once per applicant. Two concurrent
    // submits would otherwise each spend a credit pull on one real person.
    await expect(
      recordAscendOrder(applicantId, {
        orderId: "9999999999999999999",
        userId: "1426270128715821056",
        newCustomer: false,
        risk: { riskStatus: "PASS" },
        creditScore: { creditLimit: 1000, mlcbMaxLoanAmount: 1000 },
      }),
    ).rejects.toBeInstanceOf(DuplicateAscendOrderError);

    const rows = await sql`select order_id from ascend_orders where applicant_id = ${applicantId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].order_id).toBe("1549849627749851136");
  });
});
