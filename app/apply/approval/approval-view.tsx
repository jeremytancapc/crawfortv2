"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import type { LoanFormData } from "@/lib/loan-form";
import { LoanResults } from "@/app/loan-results";
import { ApplyIosShell } from "@/app/apply-gate/ios-ui";
import { APPLY_PROGRESS } from "@/lib/apply-progress";
import { approvalOfferDisplay, formatOfferAmount } from "@/lib/approval-display";
import {
  readStoredWithdrawAmount,
  storeWithdrawAmount,
} from "@/lib/withdraw-amount";
import { PlanAmountField } from "@/app/apply/choose-plan/plan-amount-field";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";

interface Props {
  formData: LoanFormData;
  phase: "amount" | "plan";
  initialWithdrawAmount?: number;
}

export function ApprovalView({ formData, phase, initialWithdrawAmount }: Props) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const isPlan = phase === "plan";

  const { displayData, creditLimit } = approvalOfferDisplay(formData);
  const maxPlanAmount = initialWithdrawAmount ?? displayData.amount;
  const [planAmount, setPlanAmount] = useState(maxPlanAmount);

  useEffect(() => {
    if (!isPlan) return;
    const stored = readStoredWithdrawAmount(maxPlanAmount);
    if (stored != null) setPlanAmount(stored);
  }, [isPlan, maxPlanAmount]);

  const handlePlanAmountChange = (next: number) => {
    setPlanAmount(next);
    storeWithdrawAmount(next);
  };

  const persistPlanAmount = (next: number) => {
    handlePlanAmountChange(next);
    const leadId = formData.leadId;
    if (!leadId) return;
    void fetch("/api/apply/select-amount", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadId, amount: next }),
    }).catch(() => {
      /* plan cards already show the new figure */
    });
  };

  return (
    <ApplyIosShell
      sidebarTitle={isPlan ? "Choose your loan plan" : "Confirm your loan amount"}
      sidebarSubtitle={
        isPlan
          ? `For ${formatOfferAmount(planAmount)}.`
          : "Choose the loan amount that works best for you."
      }
      progressStep={isPlan ? APPLY_PROGRESS.choosePlan : APPLY_PROGRESS.confirmAmount}
      wideContent={isPlan}
    >
      <motion.div
        className="min-w-0 shrink-0 px-5 pb-6 pt-7"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="ios-type-title">
          {/* Words rise into the title a beat apart, so the step announces
              itself rather than arriving with the rest of the page. */}
          <VerticalCutReveal
            splitBy="words"
            staggerDuration={0.08}
            staggerFrom="first"
            reverse
            containerClassName="justify-start"
            wordLevelClassName="pb-[0.08em]"
            transition={{ type: "spring", stiffness: 250, damping: 32 }}
          >
            {isPlan ? "Choose your loan plan" : "Confirm your loan amount"}
          </VerticalCutReveal>
        </h1>
        {isPlan ? (
          <PlanAmountField
            value={planAmount}
            max={maxPlanAmount}
            onChange={handlePlanAmountChange}
            onCommit={persistPlanAmount}
          />
        ) : (
          <p className="ios-type-subtitle mt-1.5">
            Choose the loan amount that works best for you.
          </p>
        )}
      </motion.div>

      <LoanResults
        formData={displayData}
        creditLimit={creditLimit}
        monthlyRepayment={0}
        phase={phase}
        initialWithdrawAmount={initialWithdrawAmount}
        amount={isPlan ? planAmount : undefined}
        onAmountChange={isPlan ? handlePlanAmountChange : undefined}
        onAccept={(nextAmount) => {
          if (isPlan) {
            router.push("/apply/accept");
            return;
          }
          router.push(`/apply/choose-plan?amount=${nextAmount}`);
        }}
        onCustomOfferSubmitted={() =>
          router.push(`/apply/custom-received?leadId=${formData.leadId ?? ""}`)
        }
      />
    </ApplyIosShell>
  );
}
