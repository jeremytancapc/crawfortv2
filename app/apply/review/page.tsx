import type { Viewport } from "next";
import { initialLoanFormData, type LoanFormData } from "@/lib/loan-form";
import { getApplySession } from "@/lib/apply-session";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { withDemoReviewMyInfo } from "@/lib/demo-review-myinfo";
import { hydrateSingpassReviewSession } from "@/lib/singpass-session-hydrate";

import { MyinfoDebugWidget } from "./myinfo-debug-widget";
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

  // Staging-only, one-click CPF/NOA removal for this application's own
  // retrieval - without a rid there is nothing to edit. Gated by
  // MYINFO_EDITOR_ENABLED, not MYINFO_CAPTURE_ENABLED - that flag also
  // diverts the real Singpass callback to the inspector, which would stop
  // a tester from ever reaching this page with a rid to edit. This flag has
  // no effect on the callback, so a real applicant's review page is never
  // touched by this either way.
  const rid = hydrated?.singpassRawKey ?? session?.singpassRawKey;
  const showMyinfoDebug = process.env.MYINFO_EDITOR_ENABLED === "true" && Boolean(rid);

  return (
    <>
      {showMyinfoDebug && rid && <MyinfoDebugWidget rid={rid} />}
      <ReviewForm initialData={initialData} />
    </>
  );
}
