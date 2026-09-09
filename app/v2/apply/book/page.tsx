import { redirect } from "next/navigation";

import { getApplySession } from "@/lib/apply-session";
import { getApprovalOffer, mergeOfferIntoFormData } from "@/lib/approval-offer";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { applyRedirectPath } from "@/lib/apply-variant-server";
import { initialLoanFormData } from "@/lib/loan-form";

import { BookScreen } from "./book-screen";

export const dynamic = "force-dynamic";

export default async function V2BookPage() {
  await enforceApplyFunnel("/apply/book");

  const session = await getApplySession();
  const offer = await getApprovalOffer();

  if (!session && !offer) redirect(await applyRedirectPath("/"));

  const formData = {
    ...initialLoanFormData,
    ...session,
    ...(offer ? mergeOfferIntoFormData(offer) : {}),
  };

  if (!formData.leadId) redirect(await applyRedirectPath("/"));

  return <BookScreen formData={formData} />;
}
