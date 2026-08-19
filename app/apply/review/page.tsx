import type { Viewport } from "next";
import { initialLoanFormData, type LoanFormData } from "@/lib/loan-form";
import { getApplySession } from "@/lib/apply-session";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { withDemoReviewMyInfo } from "@/lib/demo-review-myinfo";
import { hydrateSingpassReviewSession } from "@/lib/singpass-session-hydrate";

import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

/**
 * Unified continuation after step 3 (manual or Singpass).
 * Steps 4-9 only run here - not on `/`.
 */
export default async function ReviewPage() {
  await enforceApplyFunnel("/apply/review");

  const session = await getApplySession();
  const hydrated = await hydrateSingpassReviewSession(session);
  const initialData: LoanFormData = withDemoReviewMyInfo({
    ...initialLoanFormData,
    ...hydrated,
  });

  return <ReviewForm initialData={initialData} />;
}
