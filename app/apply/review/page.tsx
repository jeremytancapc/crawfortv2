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

  return (
    <>
      <MyinfoEditorLink rid={hydrated?.singpassRawKey ?? session?.singpassRawKey} />
      <ReviewForm initialData={initialData} />
    </>
  );
}

/**
 * Staging-only shortcut to the MyInfo editor for this application's own
 * retrieval - without it a tester has no way to find their own rid, since
 * singpassRawKey only ever travels inside the signed session cookie.
 *
 * Same gate as the inspector it links to (MYINFO_CAPTURE_ENABLED): off by
 * default, so a real applicant's review page is never touched by this.
 */
function MyinfoEditorLink({ rid }: { rid?: string }) {
  if (process.env.MYINFO_CAPTURE_ENABLED !== "true" || !rid) return null;

  return (
    <a
      href={`/auth/callback-result?rid=${rid}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-3 right-3 z-50 rounded-full border border-amber-400 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-900 shadow-md hover:bg-amber-100"
    >
      Edit MyInfo (staging)
    </a>
  );
}
