import { trackEvent } from "@/lib/analytics";
import type { LoanFormData } from "@/lib/loan-form";
import { postSubmitUrl } from "@/lib/post-submit-nav";

export const NRIC_PATTERN = /^[STFGM]\d{7}[A-Z]$/i;
export const SG_MOBILE_PATTERN = /^[89]\d{7}$/;

export function isValidNric(value: string): boolean {
  return NRIC_PATTERN.test(value.trim());
}

export function isValidSgMobile(value: string): boolean {
  return SG_MOBILE_PATTERN.test(value.replace(/\s/g, ""));
}

/**
 * "Yes, I confirm" on the review step creates a partial lead so a customer who
 * drops off before submitting can still be followed up. The draft endpoint
 * sets a cookie server-side; nothing comes back that the client needs.
 * Failures are non-blocking - submit falls back to INSERT.
 */
export async function saveReviewDraft(formData: LoanFormData): Promise<void> {
  try {
    await fetch("/api/apply/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(formData),
    });
  } catch {
    /* non-blocking */
  }
}

export interface SubmitReviewResult {
  /** Canonical (un-prefixed) path to continue on, with `?leadId=` appended. */
  nextPath: string;
  isEligible: boolean;
  leadId: string | null;
}

/**
 * Submits the application. Resolves to the canonical continuation path
 * (approval or pending) or `null` when the request failed.
 */
export async function submitReview(
  formData: LoanFormData,
): Promise<SubmitReviewResult | null> {
  const res = await fetch("/api/apply/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(formData),
  });
  if (!res.ok) {
    console.error("Submit failed", await res.text());
    return null;
  }
  const result = (await res.json()) as { isEligible: boolean; leadId?: string };
  const leadId = typeof result.leadId === "string" ? result.leadId : null;
  const base = result.isEligible ? "/apply/approval" : "/apply/pending";
  if (result.isEligible) trackEvent("step_09_offer_presented");
  return {
    nextPath: postSubmitUrl(base, leadId),
    isEligible: result.isEligible,
    leadId,
  };
}
