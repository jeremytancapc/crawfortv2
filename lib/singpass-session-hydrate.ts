import { cookies } from "next/headers";

import { decodeMyinfoCookie, MYINFO_COOKIE } from "@/lib/apply-myinfo-cookie";
import { DRAFT_LEAD_COOKIE } from "@/lib/apply-session-codec";
import type { LoanFormData } from "@/lib/loan-form";
import { looksLikeLeadUuid } from "@/lib/lead-id";
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
/**
 * The applicant's real CPF and NOA, wherever they are held - or null when
 * none can be found. Never the demo records `hydrateSingpassReviewSession`
 * fills in for display, so anything that draws a conclusion about the
 * applicant (the employment pre-selection) reads this instead.
 */
export async function loadSingpassRecords(
  session: Partial<LoanFormData> | null,
): Promise<{ data: Partial<LoanFormData>; fromStore: boolean } | null> {
  if (!session) return null;

  const hasBulk =
    (session.cpfContributions?.length ?? 0) > 0 ||
    (session.noaHistory?.length ?? 0) > 0;
  if (hasBulk) return { data: session, fromStore: false };

  const store = await cookies();

  const fromCookie = decodeMyinfoCookie(store.get(MYINFO_COOKIE)?.value ?? "");
  if (
    fromCookie &&
    (fromCookie.cpfContributions.length > 0 || fromCookie.noaHistory.length > 0)
  ) {
    return {
      data: {
        ...session,
        cpfContributions: fromCookie.cpfContributions,
        noaHistory: fromCookie.noaHistory,
        dob: session.dob || fromCookie.dob,
      },
      fromStore: false,
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

  if (!processed) return null;

  return {
    data: {
      ...session,
      cpfContributions: processed.cpfContributions,
      noaHistory: processed.noaHistory,
      dob: session.dob || processed.dob,
    },
    fromStore: true,
  };
}

/**
 * The review page's data: the applicant's real CPF and NOA exactly as
 * Singpass returned them, or the session unchanged when none was found. It
 * never fills in or assumes a field - a foreigner with NOA and no CPF is
 * shown that, not a fixture. Pass `loaded` when the caller has already called
 * loadSingpassRecords, to save the round trip.
 */
export async function hydrateSingpassReviewSession(
  session: Partial<LoanFormData> | null,
  loaded?: Awaited<ReturnType<typeof loadSingpassRecords>>,
): Promise<Partial<LoanFormData> | null> {
  const records = loaded === undefined ? await loadSingpassRecords(session) : loaded;
  return records?.data ?? session;
}
