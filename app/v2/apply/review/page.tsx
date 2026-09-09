import { initialLoanFormData, type LoanFormData } from "@/lib/loan-form";
import { getApplySession } from "@/lib/apply-session";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { withDemoReviewMyInfo } from "@/lib/demo-review-myinfo";
import { hydrateSingpassReviewSession } from "@/lib/singpass-session-hydrate";

import { ReviewScreens } from "./review-screens";

export const dynamic = "force-dynamic";

export default async function V2ReviewPage() {
  await enforceApplyFunnel("/apply/review");

  const session = await getApplySession();
  const hydrated = await hydrateSingpassReviewSession(session);
  const initialData: LoanFormData = withDemoReviewMyInfo({
    ...initialLoanFormData,
    ...hydrated,
  });

  return <ReviewScreens initialData={initialData} />;
}
