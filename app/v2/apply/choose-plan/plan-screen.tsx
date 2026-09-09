"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react";

import { useApplyPath } from "@/app/use-apply-path";
import { Pill, Row, Rows, Stepper, Tabs, Tag, TextField } from "@/app/v2/ui/controls";
import { V2Body, V2Footer, V2Header, V2Screen, V2Title, cx } from "@/app/v2/ui/screen";
import { useClientValue } from "@/app/v2/ui/use-client-value";
import { trackEvent } from "@/lib/analytics";
import { approvalOfferDisplay, formatOfferAmount } from "@/lib/approval-display";
import { markApplyStepVisited } from "@/lib/apply-step-nav";
import type { LoanFormData } from "@/lib/loan-form";
import {
  MAX_OFFER_TENURE,
  MIN_OFFER_TENURE,
  OFFER_MONTHLY_RATE,
  buildOfferPlans,
  calculateInstalment,
  type OfferPlan,
} from "@/lib/offer-plans";
import {
  MIN_WITHDRAW_AMOUNT,
  WITHDRAW_STEP,
  clampWithdrawAmount,
  readStoredWithdrawAmount,
  storeWithdrawAmount,
} from "@/lib/withdraw-amount";

type PlanTab = OfferPlan["id"];

const TAB_LABELS: Record<PlanTab, string> = {
  lowest_interest: "SuperSaver",
  average: "ValuePro",
  lowest_instalment: "FlexiPay",
  custom: "Custom",
};

const DECLINE_REASONS = [
  "Shopping around",
  "Don't need it for now",
  "Amount doesn't match my expectation",
  "Rates don't match my expectation",
] as const;

function shortTitle(plan: OfferPlan): string {
  return plan.title.replace(/\s*Plan$/i, "");
}

/**
 * Plan selection as tabs: one plan on screen at a time, three figures, one
 * CTA. Same `select-plan` payloads and navigation as production.
 */
export function PlanScreen({
  formData,
  initialWithdrawAmount,
}: {
  formData: LoanFormData;
  initialWithdrawAmount?: number;
}) {
  const router = useRouter();
  const applyHref = useApplyPath();
  const { withdrawToday } = approvalOfferDisplay(formData);
  const max = Math.max(initialWithdrawAmount ?? withdrawToday, MIN_WITHDRAW_AMOUNT);

  const stored = useClientValue(
    () => (initialWithdrawAmount == null ? readStoredWithdrawAmount(max) : null),
    null,
  );
  const [amountOverride, setAmount] = useState<number | null>(null);
  const amount = amountOverride ?? initialWithdrawAmount ?? stored ?? max;
  const [tab, setTab] = useState<PlanTab>("average");
  const [customAmount, setCustomAmount] = useState("");
  const [customTenure, setCustomTenure] = useState(MAX_OFFER_TENURE);
  const [customTouched, setCustomTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const persistTimer = useRef<number | null>(null);

  useEffect(() => {
    markApplyStepVisited("choosePlan");
    if (initialWithdrawAmount != null) storeWithdrawAmount(initialWithdrawAmount);
  }, [initialWithdrawAmount]);

  const plans = useMemo(() => buildOfferPlans(amount), [amount]);
  const activePlan = plans.find((plan) => plan.id === tab) ?? null;

  const changeAmount = useCallback(
    (next: number) => {
      const clamped = clampWithdrawAmount(next, max);
      setAmount(clamped);
      storeWithdrawAmount(clamped);
      if (!formData.leadId) return;
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(() => {
        void fetch("/api/apply/select-amount", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ leadId: formData.leadId, amount: clamped }),
        }).catch(() => {});
      }, 400);
    },
    [formData.leadId, max],
  );

  const customAmountValue = parseInt(customAmount.replace(/[^0-9]/g, ""), 10);
  const customValid =
    Number.isFinite(customAmountValue) && customAmountValue > 0 && customTenure > 0;

  const savePlan = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!formData.leadId) return;
      try {
        await fetch("/api/apply/select-plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ leadId: formData.leadId, ...payload }),
        });
      } catch {
        /* graceful fallback - the customer still moves on */
      }
    },
    [formData.leadId],
  );

  const choosePlan = async () => {
    if (!activePlan || isSaving) return;
    trackEvent("step_10_offer_accepted", { planId: activePlan.id });
    setIsSaving(true);
    await savePlan({
      planId: activePlan.id,
      tenure: activePlan.tenure,
      amount,
      monthlyRate: activePlan.monthlyRate,
      monthlyInstalment: activePlan.monthlyInstalment,
    });
    router.push(applyHref("/apply/accept"));
  };

  const requestCustom = async () => {
    if (isSaving) return;
    if (!customValid) {
      setCustomTouched(true);
      return;
    }
    trackEvent("step_10_offer_accepted", { planId: "custom" });
    setIsSaving(true);
    await savePlan({
      planId: "custom",
      tenure: customTenure,
      amount: customAmountValue,
      monthlyRate: OFFER_MONTHLY_RATE,
      monthlyInstalment: Math.ceil(
        calculateInstalment(customAmountValue, customTenure, OFFER_MONTHLY_RATE),
      ),
    });
    router.push(applyHref(`/apply/custom-received?leadId=${formData.leadId ?? ""}`));
  };

  const tabs = useMemo(
    () =>
      (["lowest_interest", "average", "lowest_instalment", "custom"] as PlanTab[]).map(
        (id) => ({ value: id, label: TAB_LABELS[id] }),
      ),
    [],
  );

  const customMonthly = customValid
    ? Math.ceil(calculateInstalment(customAmountValue, customTenure, OFFER_MONTHLY_RATE))
    : null;

  return (
    <V2Screen>
      <V2Header
        backHref={applyHref("/apply/approval")}
        progress={{ stage: "offer", fraction: 0.7 }}
      />
      <V2Body justify="start">
        <V2Title
          title="Pick your plan"
          subtitle={
            tab === "custom"
              ? "Tell us what works. We'll call to confirm."
              : "Same amount, three ways to repay."
          }
        />

        <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Repayment plan" />

        {activePlan ? (
          <div key={activePlan.id} className="v2-enter flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="v2-label">{shortTitle(activePlan)} · monthly</span>
                <span className="v2-hero-num">
                  {formatOfferAmount(activePlan.monthlyInstalment)}
                </span>
              </div>
              {activePlan.isPopular ? <Tag>Most chosen</Tag> : null}
            </div>
            <Rows>
              <Row
                label="Loan amount"
                action={
                  <Stepper
                    value={formatOfferAmount(amount)}
                    onDecrement={() => changeAmount(amount - WITHDRAW_STEP)}
                    onIncrement={() => changeAmount(amount + WITHDRAW_STEP)}
                    canDecrement={amount > Math.min(MIN_WITHDRAW_AMOUNT, max)}
                    canIncrement={amount < max}
                    decrementLabel="Reduce loan amount"
                    incrementLabel="Increase loan amount"
                  />
                }
              />
              <Row label="Term" value={`${activePlan.tenure} months`} />
              <Row label="Total interest" value={formatOfferAmount(activePlan.totalInterest)} />
              <Row label="Total repayable" value={formatOfferAmount(activePlan.totalRepayment)} />
            </Rows>
          </div>
        ) : (
          <div key="custom" className="v2-enter flex flex-col gap-1">
            <TextField
              label="Loan amount"
              prefix="$"
              inputMode="numeric"
              placeholder={amount.toLocaleString("en-SG")}
              value={customAmount}
              onChange={(event) => setCustomAmount(event.target.value.replace(/[^0-9,]/g, ""))}
              invalid={customTouched && !customValid}
            />
            <Rows>
              <Row
                label="Term"
                action={
                  <Stepper
                    value={`${customTenure} ${customTenure === 1 ? "month" : "months"}`}
                    onDecrement={() => setCustomTenure((t) => Math.max(MIN_OFFER_TENURE, t - 1))}
                    onIncrement={() => setCustomTenure((t) => Math.min(MAX_OFFER_TENURE, t + 1))}
                    canDecrement={customTenure > MIN_OFFER_TENURE}
                    canIncrement={customTenure < MAX_OFFER_TENURE}
                    decrementLabel="Shorter term"
                    incrementLabel="Longer term"
                  />
                }
              />
              <Row
                label="Estimated monthly"
                value={customMonthly != null ? formatOfferAmount(customMonthly) : "-"}
              />
            </Rows>
          </div>
        )}

        <button
          type="button"
          onClick={() => setDeclineOpen(true)}
          className="v2-note mt-auto self-start underline underline-offset-2"
        >
          Not what you expected?
        </button>
      </V2Body>
      <V2Footer
        note={
          tab === "custom"
            ? "A request, not an approval. Staff confirm the final terms."
            : `${(OFFER_MONTHLY_RATE * 100).toFixed(2)}% a month, reducing balance. Offer valid until disbursement.`
        }
      >
        {activePlan ? (
          <Pill onClick={() => void choosePlan()} loading={isSaving}>
            Choose {shortTitle(activePlan)}
          </Pill>
        ) : (
          <Pill onClick={() => void requestCustom()} loading={isSaving}>
            Request custom offer
          </Pill>
        )}
      </V2Footer>

      {declineOpen ? (
        <DeclineSheet leadId={formData.leadId || undefined} onClose={() => setDeclineOpen(false)} />
      ) : null}
    </V2Screen>
  );
}

/** Bottom sheet: pick a reason, we log it, the offer stays put. */
function DeclineSheet({ leadId, onClose }: { leadId?: string; onClose: () => void }) {
  const [sent, setSent] = useState<string | null>(null);

  const pick = (reason: string) => {
    if (leadId) {
      fetch("/api/apply/decline-reason", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId, reason }),
      }).catch(() => {});
    }
    trackEvent("step_offer_declined", { reason });
    setSent(reason);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[oklch(0.18_0.02_260/0.4)] sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="decline-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[440px] rounded-t-[28px] bg-[var(--v2-bg)] px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-5 sm:rounded-[28px]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="decline-title" className="v2-title !text-[22px]">
              {sent ? "Noted, thank you" : "What's holding you back?"}
            </h2>
            <p className="v2-sub !mt-1">
              {sent
                ? "Your offer stays open for 3 days. Come back any time."
                : "One tap. Your offer stays open either way."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="v2-icon-button -mr-2" aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </div>
        {sent ? (
          <Pill className="mt-5" onClick={onClose}>
            Back to my offer
          </Pill>
        ) : (
          <Rows className="mt-3">
            {DECLINE_REASONS.map((reason) => (
              <Row key={reason} label={<span className={cx("text-[var(--v2-ink)]")}>{reason}</span>} onClick={() => pick(reason)} />
            ))}
          </Rows>
        )}
      </div>
    </div>
  );
}
