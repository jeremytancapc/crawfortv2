/**
 * Who this applicant is to Ascend, decided before any credit pull.
 *
 * ADR-0001: a Reloan Customer is sent to the mobile app and never reaches
 * /openApi/apply/credit, so nothing is spent on a credit pull for someone who
 * was always going to be redirected. decideIdentityOutcome has encoded that
 * since the ADR was written; nothing called it, so every returning borrower
 * has been going through the full web funnel and being credit-pulled.
 *
 * /openApi/users also returns the userId that everything afterwards needs -
 * the credit call, and every document upload, which are addressed by Ascend's
 * user rather than by our applicant id. Skipping this step is why
 * ascend_user_id was null on the one Order that was ever created, and why a
 * PENDING applicant sent to verify-income could not have uploaded anything.
 */

import { ascendUsers, AscendError } from "./client";
import { ascendConfig } from "./config";
import { decideIdentityOutcome, type IdentityOutcome } from "../apply-outcome";
import { insertApiLog } from "../db/events";

export async function resolveAscendIdentity(input: {
  /** NRIC or FIN. Ascend keys its user on this plus the phone. */
  idNumber: string | null | undefined;
  /** E.164, as Ascend expects it. */
  phone: string | null | undefined;
  applicantId: string;
}): Promise<IdentityOutcome | null> {
  if (!ascendConfig()) return null;

  if (!input.idNumber || !input.phone) {
    // Not an error: a manual applicant has no NRIC to identify with, and the
    // journey continues exactly as it did before this step existed.
    return null;
  }

  try {
    const user = await ascendUsers(
      { idNumber: input.idNumber, phone: input.phone },
      { applicantId: input.applicantId },
    );
    return decideIdentityOutcome(user);
  } catch (err) {
    // Deliberately open, not closed. Failing here would block a new customer
    // from applying at all, which is worse than the cost of one credit pull -
    // and the caller falls back to sending the whole MyInfo payload, which is
    // what it did before this step existed. The log says it happened so the
    // cost is visible rather than silent.
    const reason =
      err instanceof AscendError ? `${err.code}: ${err.msg}` : String(err);
    void insertApiLog({
      tag: "[ascend]identity-unresolved",
      method: "POST",
      url: "/openApi/users",
      response_ok: false,
      applicant_id: input.applicantId,
      error: `could not identify applicant, continuing with MyInfo: ${reason}`,
    });
    console.warn(`[ascend] /openApi/users failed, continuing with MyInfo: ${reason}`);
    return null;
  }
}
