import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";

import { VerifyIncomeScreen } from "./verify-income-screen";

export const dynamic = "force-dynamic";

export default async function V2VerifyIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  await enforceApplyFunnel("/apply/verify-income");
  const params = await searchParams;
  const view = Array.isArray(params.view) ? params.view[0] : params.view;

  return <VerifyIncomeScreen initialShowResults={view === "results"} />;
}
