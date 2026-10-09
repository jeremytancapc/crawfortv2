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

/**
 * A PASS can arrive before its limit does. Against order 1558084373801472000
 * on 2026-10-09, income/credit answered `PASS` with `creditScore: {}`, and
 * query/credit moments later carried creditLimit 700, level D. Treating the
 * first answer as final sent an approved applicant to the pending page.
 *
 * So a PASS that names no limit is asked about again, a few times with a
 * pause between - long enough for the limit to land, short enough that an
 * applicant is not left on a loading screen for a limit that is not coming.
 * If it never does, the PASS stands as it is and the caller treats it as
 * unresolved, which is what it is.
 */
const LIMIT_RETRY_WAITS_MS = [1500, 2500, 3500];

function hasLimit(result: AscendCreditResult): boolean {
  return Number(result.creditScore?.creditLimit) > 0;
}

export async function creditAfterIncome(
  orderId: string,
  submitted: AscendCreditResult,
  options?: {
    applicantId?: string | null;
    query?: typeof ascendQueryCredit;
    /** Replaced in tests so they do not sleep. */
    wait?: (ms: number) => Promise<void>;
  },
): Promise<AscendCreditResult> {
  const status = submitted.risk?.riskStatus;
  const awaitingLimit = status === "PASS" && !hasLimit(submitted);
  if (status !== "PENDING" && !awaitingLimit) return submitted;

  const query = options?.query ?? ascendQueryCredit;
  const wait = options?.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const callOptions: AscendCallOptions = { applicantId: options?.applicantId ?? null };

  // A PENDING answer is re-read once, as before. A PASS without a limit is
  // re-read until the limit arrives or the tries run out.
  const tries = awaitingLimit ? LIMIT_RETRY_WAITS_MS.length + 1 : 1;
  let latest = submitted;

  for (let attempt = 0; attempt < tries; attempt++) {
    if (attempt > 0) await wait(LIMIT_RETRY_WAITS_MS[attempt - 1]);
    try {
      const fresh = await query({ orderId }, callOptions);
      if (fresh?.risk?.riskStatus) latest = fresh;
      if (!awaitingLimit || hasLimit(latest)) return latest;
    } catch (err) {
      console.warn(
        `[ascend] query/credit after income failed for ${orderId}, keeping ${latest.risk?.riskStatus}:`,
        err instanceof Error ? err.message : err,
      );
      return latest;
    }
  }
  return latest;
}
