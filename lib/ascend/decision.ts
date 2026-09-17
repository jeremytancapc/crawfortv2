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
import { myinfoPersonData } from "@/lib/myinfo";
import { isDatabaseConfigured } from "@/lib/db/sql";

import { ascendApplyCredit, AscendError, type AscendCreditResult } from "./client";
import { ascendConfig } from "./config";
import { insertApiLog } from "@/lib/db/events";

export async function requestAscendDecision(input: {
  desiredAmount: number;
  /** Key into myinfo_retrievals, carried in the session from the callback. */
  singpassRawKey: string | undefined;
  /** Ascend's own user id, when /openApi/users has already run. */
  ascendUserId: string | null;
}): Promise<AscendCreditResult | null> {
  // Each `return null` below means no Order, and therefore an applicant who
  // submitted but never appears in Ascend. Recording why is the difference
  // between support answering that question in a minute and not at all.
  const skip = (reason: string) => {
    void insertApiLog({
      tag: "[ascend]skipped",
      method: "POST",
      url: "/openApi/apply/credit",
      response_ok: false,
      error: reason,
    });
    console.warn(`[ascend] apply/credit skipped: ${reason}`);
    return null;
  };

  if (!ascendConfig()) return skip("Ascend is not configured in this environment");

  // Prefer the userId: it is a far smaller request, and Ascend accepts it
  // once it already holds that person's MyInfo. Otherwise the whole payload
  // has to travel, or the call is refused with
  // `600: The user has not authorized myinfo`.
  let myinfo: Record<string, unknown> | undefined;
  if (!input.ascendUserId) {
    if (!input.singpassRawKey || !isDatabaseConfigured()) {
      return skip(
        input.singpassRawKey
          ? "no database, so the stored MyInfo could not be read"
          : "no MyInfo key in the session",
      );
    }
    const stored = await getMyinfoRetrieval(input.singpassRawKey);
    // The retrieval expires. Without it there is nothing to identify the
    // applicant to Ascend, and inventing one is not an option.
    if (!stored) return skip("the stored MyInfo retrieval has expired or was never written");

    // Unwrapped, not forwarded verbatim. A FAPI 2.0 payload wraps the person
    // in `person_info` alongside sub, iss and aud; Ascend was verified
    // against the flat shape and looks for `uinfin` at the top level, so
    // handing it the envelope would find nothing there.
    myinfo = myinfoPersonData(stored);
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
