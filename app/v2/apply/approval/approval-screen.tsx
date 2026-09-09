"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useApplyPath } from "@/app/use-apply-path";
import { AmountInput, Pill, Row, Rows } from "@/app/v2/ui/controls";
import { ApprovedIllustration } from "@/app/v2/ui/illustrations";
import { V2Body, V2Footer, V2Header, V2Illustration, V2Screen, V2Title } from "@/app/v2/ui/screen";
import { useClientValue } from "@/app/v2/ui/use-client-value";
import { approvalOfferDisplay, formatOfferAmount } from "@/lib/approval-display";
import { markApplyStepVisited } from "@/lib/apply-step-nav";
import { APPROVAL_PAGE_DISCLAIMER, type LoanFormData } from "@/lib/loan-form";
import { MAX_OFFER_TENURE, OFFER_MONTHLY_RATE, calculateInstalment } from "@/lib/offer-plans";
import {
  MIN_WITHDRAW_AMOUNT,
  WITHDRAW_STEP,
  clampWithdrawAmount,
  readStoredWithdrawAmount,
  storeWithdrawAmount,
} from "@/lib/withdraw-amount";

/**
 * Approval: the outcome as the headline, one editable figure, one CTA.
 * Persists the chosen amount exactly like production (`sessionStorage` +
 * `POST /api/apply/select-amount`) and hands off to the plan screen.
 */
export function ApprovalScreen({ formData }: { formData: LoanFormData }) {
  const router = useRouter();
  const applyHref = useApplyPath();
  const { withdrawToday, creditLimit } = approvalOfferDisplay(formData);
  const max = Math.max(withdrawToday, MIN_WITHDRAW_AMOUNT);
  const min = Math.min(MIN_WITHDRAW_AMOUNT, max);

  const stored = useClientValue(() => readStoredWithdrawAmount(max), null);
  const [amountOverride, setAmount] = useState<number | null>(null);
  const amount = amountOverride ?? (stored != null ? clampWithdrawAmount(stored, max) : max);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    markApplyStepVisited("approval");
  }, []);

  const lowestMonthly = Math.ceil(
    calculateInstalment(amount, MAX_OFFER_TENURE, OFFER_MONTHLY_RATE),
  );

  const persistAmount = useCallback(
    async (next: number) => {
      storeWithdrawAmount(next);
      if (!formData.leadId) return;
      try {
        await fetch("/api/apply/select-amount", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ leadId: formData.leadId, amount: next }),
        });
      } catch {
        /* select-plan writes the figure again later */
      }
    },
    [formData.leadId],
  );

  const handleContinue = () => {
    if (isLeaving) return;
    setIsLeaving(true);
    void persistAmount(amount);
    router.push(applyHref(`/apply/choose-plan?amount=${amount}`));
  };

  return (
    <V2Screen>
      <V2Header progress={{ stage: "offer", fraction: 0.3 }} />
      <V2Body justify="between">
        <div className="flex flex-col gap-4">
          <V2Illustration>
            <ApprovedIllustration />
          </V2Illustration>
          <V2Title
            title={
              <>
                You&apos;re approved for{" "}
                <span className="whitespace-nowrap">{formatOfferAmount(withdrawToday)}</span>
              </>
            }
            subtitle="Choose how much to take today."
          />
        </div>

        <div className="v2-enter flex flex-col gap-1" style={{ ["--i" as string]: 1 }}>
          <AmountInput
            value={amount}
            min={min}
            max={max}
            step={WITHDRAW_STEP}
            onChange={(next) => setAmount(clampWithdrawAmount(next, max))}
            onCommit={(next) => storeWithdrawAmount(next)}
            ariaLabel="Amount to take today"
          />
          <p className="text-[15px] text-[var(--v2-ink-2)]">
            From{" "}
            <span className="font-bold tabular-nums text-[var(--v2-ink)]">
              {formatOfferAmount(lowestMonthly)}
            </span>{" "}
            a month
          </p>
        </div>

        <Rows className="v2-enter" >
          <Row label="Total credit line" value={formatOfferAmount(creditLimit)} />
        </Rows>
      </V2Body>
      <V2Footer note={APPROVAL_PAGE_DISCLAIMER}>
        <Pill onClick={handleContinue} loading={isLeaving}>
          Continue
        </Pill>
      </V2Footer>
    </V2Screen>
  );
}
