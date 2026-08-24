"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import type { LoanFormData } from "@/lib/loan-form";
import { LoanResults } from "@/app/loan-results";
import { ApplyIosShell } from "@/app/apply-gate/ios-ui";
import { APPLY_PROGRESS } from "@/lib/apply-progress";

interface Props {
  formData: LoanFormData;
}

export function ApprovalView({ formData }: Props) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  // Demo-only figures: 3× / 6× monthly income. After submit the session often
  // drops the self-declared string, so fall back to verified income, then the
  // approved amount that already gated this page.
  const monthlyIncome =
    parseInt(formData.monthlyIncome.replace(/,/g, ""), 10) ||
    Number(formData.verifiedMonthlyIncome) ||
    0;
  const withdrawToday = monthlyIncome > 0 ? monthlyIncome * 3 : formData.approvedLoanAmount;
  const maxCreditLimit = monthlyIncome > 0 ? monthlyIncome * 6 : formData.approvedLoanAmount * 2;

  const displayData = { ...formData, amount: withdrawToday };

  return (
    <ApplyIosShell
      sidebarTitle="Confirm your loan amount"
      sidebarSubtitle="Choose the loan amount and repayment period that works best for you."
      progressStep={APPLY_PROGRESS.choosePlan}
    >
      <motion.div
        className="shrink-0 px-5 pb-6 pt-7"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.022em] text-[var(--text-primary)]">
          Confirm your loan amount
        </h1>
        <p className="mt-1.5 text-[17px] leading-[1.4] text-[var(--text-secondary)]">
          Choose the loan amount and repayment period that works best for you.
        </p>
      </motion.div>

      <LoanResults
        formData={displayData}
        creditLimit={maxCreditLimit}
        monthlyRepayment={0}
        onAccept={() => router.push("/apply/accept")}
        onCustomOfferSubmitted={() =>
          router.push(`/apply/custom-received?leadId=${formData.leadId ?? ""}`)
        }
      />
    </ApplyIosShell>
  );
}
