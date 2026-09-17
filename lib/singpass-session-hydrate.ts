import { cookies } from "next/headers";

import { decodeMyinfoCookie, MYINFO_COOKIE } from "@/lib/apply-myinfo-cookie";
import { DRAFT_LEAD_COOKIE } from "@/lib/apply-session-codec";
import type { LoanFormData } from "@/lib/loan-form";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import { withDemoReviewMyInfo } from "@/lib/demo-review-myinfo";
import {
  loadMyinfoProcessedPayload,
  processedPayloadFromRetrieval,
} from "@/lib/myinfo-profile";

/**
 * Merge CPF/NOA into session for /apply/review when the cookie was slimmed at
 * activate.
 *
 * The signed apply_myinfo cookie is tried first because it needs no round
 * trip, then myinfo_profiles, then the stored retrieval. All three are now
 * durable - the note about surviving serverless isolates described the
 * in-memory store, which is gone.
 */
export async function hydrateSingpassReviewSession(
  session: Partial<LoanFormData> | null,
): Promise<Partial<LoanFormData> | null> {
  if (!session) return withDemoReviewMyInfo(session);

  const hasBulk =
    (session.cpfContributions?.length ?? 0) > 0 ||
    (session.noaHistory?.length ?? 0) > 0;
  if (hasBulk) return session;

  const store = await cookies();

  const fromCookie = decodeMyinfoCookie(store.get(MYINFO_COOKIE)?.value ?? "");
  if (
    fromCookie &&
    (fromCookie.cpfContributions.length > 0 || fromCookie.noaHistory.length > 0)
  ) {
    return {
      ...session,
      cpfContributions: fromCookie.cpfContributions,
      noaHistory: fromCookie.noaHistory,
      dob: session.dob || fromCookie.dob,
    };
  }

  const draftLeadId = store.get(DRAFT_LEAD_COOKIE)?.value?.trim() ?? "";

  let processed = null;

  if (looksLikeLeadUuid(draftLeadId)) {
    try {
      processed = await loadMyinfoProcessedPayload(draftLeadId);
    } catch (err) {
      console.error("[hydrate] myinfo_profiles load failed:", err);
    }
  }

  if (!processed && session.singpassRawKey) {
    try {
      processed = await processedPayloadFromRetrieval(session.singpassRawKey);
    } catch (err) {
      console.error("[hydrate] myinfo_retrievals load failed:", err);
    }
  }

  if (!processed) return withDemoReviewMyInfo(session);

  return withDemoReviewMyInfo({
    ...session,
    cpfContributions: processed.cpfContributions,
    noaHistory: processed.noaHistory,
    dob: session.dob || processed.dob,
  });
}
