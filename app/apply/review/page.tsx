import type { Viewport } from "next";
import { initialLoanFormData, type LoanFormData } from "@/lib/loan-form";
import { getApplySession } from "@/lib/apply-session";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { withDemoReviewMyInfo } from "@/lib/demo-review-myinfo";
import { suggestEmploymentType } from "@/lib/ascend/borrower-derive";
import { hydrateSingpassReviewSession, loadSingpassRecords } from "@/lib/singpass-session-hydrate";

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
  const records = await loadSingpassRecords(session);
  const hydrated = await hydrateSingpassReviewSession(session, records);

  // Pre-ticks employment from the applicant's own CPF or NOA - never from
  // the demo records hydrate fills in for display, which would tick
  // "Employed" for someone with no CPF at all. An answer they already gave
  // is left alone.
  const employmentSuggestion =
    records && !hydrated?.employmentStatus
      ? suggestEmploymentType({
          cpfContributions: records.data.cpfContributions ?? [],
          noaHistory: records.data.noaHistory ?? [],
        })
      : null;

  const initialData: LoanFormData = withDemoReviewMyInfo({
    ...initialLoanFormData,
    ...hydrated,
    ...(employmentSuggestion ? { employmentStatus: employmentSuggestion.value } : {}),
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
      <ReviewForm initialData={initialData} employmentSuggestion={employmentSuggestion} />
    </>
  );
}
