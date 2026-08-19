"use client";

import { useRouter } from "next/navigation";
import type { LoanFormData } from "@/lib/loan-form";
import { LoanResults } from "@/app/loan-results";
import { ApplyIosShell } from "@/app/apply-gate/ios-ui";

interface Props {
  formData: LoanFormData;
}

export function ApprovalView({ formData }: Props) {
  const router = useRouter();

  // Demo-only figures: derive the offer straight from the self-declared monthly
  // income captured at step 2/8, rather than the real underwriting output.
  const monthlyIncome = parseInt(formData.monthlyIncome, 10) || 0;
  const withdrawToday = monthlyIncome * 3;
  const maxCreditLimit = monthlyIncome * 6;

  const displayData = { ...formData, amount: withdrawToday };

  return (
    <ApplyIosShell
      sidebarTitle="Your loan offer is confirmed."
      sidebarSubtitle="Choose the plan that works best for you."
    >
      <div className="shrink-0 px-5 pb-6 pt-7">
        <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.022em] text-[var(--text-primary)]">
          Your loan offer is confirmed.
        </h1>
        <p className="mt-1.5 text-[17px] leading-[1.4] text-[var(--text-secondary)]">
          Choose the plan that works best for you.
        </p>
      </div>

      <div className="flex-1 px-5 pb-8">
        <LoanResults
          formData={displayData}
          creditLimit={maxCreditLimit}
          monthlyRepayment={0}
          onAccept={() => router.push("/apply/accept")}
          onCustomOfferSubmitted={() =>
            router.push(`/apply/custom-received?leadId=${formData.leadId ?? ""}`)
          }
        />
      </div>
    </ApplyIosShell>
  );
}
