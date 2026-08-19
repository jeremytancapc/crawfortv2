import { cookies } from "next/headers";

import { decodeMyinfoCookie, MYINFO_COOKIE } from "@/lib/apply-myinfo-cookie";
import { DRAFT_LEAD_COOKIE } from "@/lib/apply-session-codec";
import { createAdminClient } from "@/lib/db/client";
import type { LoanFormData } from "@/lib/loan-form";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import { withDemoReviewMyInfo } from "@/lib/demo-review-myinfo";
import {
  loadMyinfoProcessedPayload,
  processedPayloadFromAuthStore,
} from "@/lib/myinfo-profile";

/**
 * Merge CPF/NOA into session for /apply/review when the cookie was slimmed at activate.
 * Prefer the signed apply_myinfo cookie - it survives serverless isolates, unlike
 * the in-memory myinfo_profiles table and auth-callback-store.
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
      const admin = createAdminClient();
      processed = await loadMyinfoProcessedPayload(admin, draftLeadId);
    } catch (err) {
      console.error("[hydrate] myinfo_profiles load failed:", err);
    }
  }

  if (!processed && session.singpassRawKey) {
    processed = processedPayloadFromAuthStore(session.singpassRawKey);
  }

  if (!processed) return withDemoReviewMyInfo(session);

  return withDemoReviewMyInfo({
    ...session,
    cpfContributions: processed.cpfContributions,
    noaHistory: processed.noaHistory,
    dob: session.dob || processed.dob,
  });
}
