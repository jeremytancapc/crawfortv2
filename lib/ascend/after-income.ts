/**
 * Asking Ascend again, once income has been submitted.
 *
 * /openApi/income/credit answers immediately, and on staging that answer was
 * PENDING with an empty creditScore even though the income had been accepted -
 * the "There is no income" complaint was gone. Ascend settles the decision
 * after the call returns, so the first response is not the last word.
 *
 * /openApi/query/credit re-reads the order. It is only worth asking when the
 * submission left things pending: a PASS or a REJECT has been decided, and
 * asking again invites a different answer to a settled question.
 *
 * A failed re-ask is never read as progress. The pending answer stands, the
 * applicant waits for a human, and nobody is shown an offer Ascend did not
 * make.
 *
 * query/credit also answers something income/credit does not: `hasIncome`.
 * Against order 1550205686196785152 on 2026-09-18 it returned
 * `{"risk":{"riskStatus":"PENDING"},"creditScore":{},"hasIncome":true}` - the
 * income accepted, the decision still open. That flag is the difference
 * between "we never received your payslips" and "we have them and a human is
 * looking", which are the same screen to an applicant and very different
 * questions for support.
 */

import { ascendQueryCredit, type AscendCreditResult, type AscendCallOptions } from "./client";

export async function creditAfterIncome(
  orderId: string,
  submitted: AscendCreditResult,
  options?: { applicantId?: string | null; query?: typeof ascendQueryCredit },
): Promise<AscendCreditResult> {
  if (submitted.risk?.riskStatus !== "PENDING") return submitted;

  const query = options?.query ?? ascendQueryCredit;
  const callOptions: AscendCallOptions = { applicantId: options?.applicantId ?? null };

  try {
    const fresh = await query({ orderId }, callOptions);
    return fresh?.risk?.riskStatus ? fresh : submitted;
  } catch (err) {
    console.warn(
      `[ascend] query/credit after income failed for ${orderId}, keeping PENDING:`,
      err instanceof Error ? err.message : err,
    );
    return submitted;
  }
}
