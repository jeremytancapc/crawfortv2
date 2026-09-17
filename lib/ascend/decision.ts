/**
 * Asking Ascend for a credit decision, from the funnel's point of view.
 *
 * Wraps the client call in everything the route would otherwise have to know:
 * whether Ascend is switched on, where the verbatim MyInfo payload is kept,
 * which identifier the call should carry, and what to do when it fails.
 *
 * Returns null rather than throwing. The caller turns null into a failure
 * state (ADR-0001), and that is a decision about what the applicant sees -
 * not something to express by unwinding the request.
 */

import { getMyinfoRetrieval } from "@/lib/db/myinfo-retrievals";
import { isDatabaseConfigured } from "@/lib/db/sql";

import { ascendApplyCredit, AscendError, type AscendCreditResult } from "./client";
import { ascendConfig } from "./config";

export async function requestAscendDecision(input: {
  desiredAmount: number;
  /** Key into myinfo_retrievals, carried in the session from the callback. */
  singpassRawKey: string | undefined;
  /** Ascend's own user id, when /openApi/users has already run. */
  ascendUserId: string | null;
}): Promise<AscendCreditResult | null> {
  if (!ascendConfig()) return null;

  // Prefer the userId: it is a far smaller request, and Ascend accepts it
  // once it already holds that person's MyInfo. Otherwise the whole payload
  // has to travel, or the call is refused with
  // `600: The user has not authorized myinfo`.
  let myinfo: Record<string, unknown> | undefined;
  if (!input.ascendUserId) {
    if (!input.singpassRawKey || !isDatabaseConfigured()) return null;
    myinfo = (await getMyinfoRetrieval(input.singpassRawKey)) ?? undefined;
    // The retrieval expires. Without it there is nothing to identify the
    // applicant to Ascend, and inventing one is not an option.
    if (!myinfo) return null;
  }

  try {
    return await ascendApplyCredit({
      desiredAmount: input.desiredAmount,
      ...(input.ascendUserId ? { userId: input.ascendUserId } : { myinfo }),
    });
  } catch (err) {
    // Logged with Ascend's own code and message: `600` covers a bad signature,
    // a busy service and an order that already exists, and the message is the
    // only thing that separates them.
    if (err instanceof AscendError) {
      console.error(`[ascend] apply/credit failed ${err.code}: ${err.msg}`);
    } else {
      console.error("[ascend] apply/credit failed", err);
    }
    return null;
  }
}
