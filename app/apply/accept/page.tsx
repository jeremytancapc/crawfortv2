import { redirect } from "next/navigation";

import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import {
  getApprovalOffer,
  mergeOfferIntoFormData,
} from "@/lib/approval-offer";
import { getApplySession } from "@/lib/apply-session";
import { createAdminClient } from "@/lib/db/client";
import { initialLoanFormData } from "@/lib/loan-form";
import {
  PLAN_TITLES,
  OFFER_MONTHLY_RATE,
  calculateInstalment,
} from "@/lib/offer-plans";

import { AcceptView } from "./accept-view";

export const dynamic = "force-dynamic";

export interface SelectedPlanData {
  planId: string;
  planTitle: string;
  amount: number;
  tenure: number;
  monthlyInstalment: number;
  monthlyRate: number;
  totalRepayment: number;
  totalInterest: number;
}

export default async function AcceptPage() {
  await enforceApplyFunnel("/apply/accept");

  const session = await getApplySession();
  const offer = await getApprovalOffer();

  const merged = {
    ...initialLoanFormData,
    ...session,
    ...(offer ? mergeOfferIntoFormData(offer) : {}),
  };

  // Resolve leadId defensively, same pattern as approval/page.tsx
  const leadId =
    (typeof session?.leadId === "string" && session.leadId.length > 0
      ? session.leadId
      : null) ??
    offer?.leadId ??
    null;

  if (!leadId) redirect("/");

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("leads")
    .select(
      "selected_plan, loan_tenure, loan_amount, plan_monthly_rate, plan_monthly_instalment",
    )
    .eq("id", leadId)
    .maybeSingle();

  // Build plan data — prefer persisted values, fall back to session/offer data
  // so the page always renders even if the select-plan DB write hasn't landed yet.
  const planId = row?.selected_plan ?? "unknown";
  const amount =
    Number(row?.loan_amount) ||
    Number(merged.approvedLoanAmount) ||
    0;
  const tenure =
    Number(row?.loan_tenure) ||
    Number(merged.tenure) ||
    0;
  const monthlyRate =
    Number(row?.plan_monthly_rate) ||
    OFFER_MONTHLY_RATE;
  const monthlyInstalment =
    Number(row?.plan_monthly_instalment) ||
    (amount > 0 && tenure > 0
      ? Math.ceil(calculateInstalment(amount, tenure, monthlyRate))
      : 0);
  const totalRepayment = monthlyInstalment * tenure;
  const totalInterest = Math.max(0, totalRepayment - amount);

  const plan: SelectedPlanData = {
    planId,
    planTitle: PLAN_TITLES[planId] ?? "Selected plan",
    amount,
    tenure,
    monthlyInstalment,
    monthlyRate,
    totalRepayment,
    totalInterest,
  };

  return <AcceptView plan={plan} />;
}
