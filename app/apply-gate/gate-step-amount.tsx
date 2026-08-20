"use client";

import { useCallback, useMemo, useState } from "react";
import type { LoanFormData as FormData } from "@/lib/loan-form";
import {
  TENURE_OPTIONS,
  URGENCY_OPTIONS,
  type UrgencyValue,
} from "@/app/loan-application-form";
import {
  Card,
  SectionLabel,
  SegmentedControl,
  StepperRow,
} from "@/app/apply-gate/ios-ui";

const MIN_AMOUNT = 500;
const MAX_AMOUNT = 20000;
const AMOUNT_STEP = 500;

/** Shorter labels than the funnel defaults - the segments are narrow on a phone. */
const URGENCY_SHORT_LABELS: Record<string, string> = {
  today: "24 hours",
  this_week: "7 days",
  not_sure: "Flexible",
};

function clampAmount(value: number): number {
  const bounded = Math.min(Math.max(value, MIN_AMOUNT), MAX_AMOUNT);
  return Math.round(bounded / AMOUNT_STEP) * AMOUNT_STEP;
}

/** Index of the tenure option matching `tenure`, or the closest one for restored sessions. */
function nearestTenureIndex(tenure: number): number {
  let best = 0;
  for (let i = 1; i < TENURE_OPTIONS.length; i++) {
    if (
      Math.abs(TENURE_OPTIONS[i] - tenure) <
      Math.abs(TENURE_OPTIONS[best] - tenure)
    ) {
      best = i;
    }
  }
  return best;
}

/**
 * First gate step: the loan amount is the hero, tenure and urgency are
 * demoted to compact grouped rows underneath.
 */
export function GateStepAmount({
  formData,
  updateField,
}: {
  formData: FormData;
  updateField: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}) {
  const [amountRaw, setAmountRaw] = useState(String(formData.amount));
  const [amountFocused, setAmountFocused] = useState(false);

  const handleAmountChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value.replace(/[^0-9]/g, "").slice(0, 6);
      setAmountRaw(raw);
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed >= MIN_AMOUNT && parsed <= MAX_AMOUNT) {
        updateField("amount", parsed);
      }
    },
    [updateField],
  );

  const handleAmountBlur = useCallback(() => {
    setAmountFocused(false);
    const parsed = parseInt(amountRaw, 10);
    const clamped = Number.isNaN(parsed) ? MIN_AMOUNT : clampAmount(parsed);
    updateField("amount", clamped);
    setAmountRaw(String(clamped));
  }, [amountRaw, updateField]);

  const handleSliderChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = parseInt(event.target.value, 10);
      updateField("amount", next);
      setAmountRaw(String(next));
    },
    [updateField],
  );

  const tenureIndex = useMemo(
    () => nearestTenureIndex(formData.tenure),
    [formData.tenure],
  );

  const sliderPercentage =
    ((formData.amount - MIN_AMOUNT) / (MAX_AMOUNT - MIN_AMOUNT)) * 100;

  const amountDisplay = amountFocused
    ? amountRaw
    : `${formData.amount.toLocaleString("en-SG")}${formData.amount >= MAX_AMOUNT ? "+" : ""}`;

  const urgencyOptions = useMemo(
    () =>
      URGENCY_OPTIONS.map(({ value, label }) => ({
        value,
        label: URGENCY_SHORT_LABELS[value] ?? label,
      })),
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionLabel>Loan amount</SectionLabel>
        <Card className="px-4 pb-4 pt-5">
          <label
            htmlFor="loan-amount-input"
            className="ios-display-amount flex items-baseline gap-1"
          >
            <span className="text-[34px] font-bold leading-none tracking-[-0.022em] text-[var(--text-primary)]">
              $
            </span>
            <input
              id="loan-amount-input"
              type="text"
              inputMode="numeric"
              value={amountDisplay}
              onFocus={() => {
                setAmountFocused(true);
                setAmountRaw(String(formData.amount));
              }}
              onBlur={handleAmountBlur}
              onChange={handleAmountChange}
              aria-label="Loan amount in dollars"
              className="ios-display-input w-full min-w-0 border-0 bg-transparent p-0 text-[44px] font-bold leading-[1.05] tracking-[-0.03em] tabular-nums text-[var(--text-primary)] outline-none"
            />
          </label>

          <div
            className="ios-slider-wrap mt-4"
            style={{ ["--slider-pct" as string]: `${sliderPercentage}%` }}
          >
            <div className="ios-slider-track" aria-hidden="true">
              <div className="ios-slider-fill" />
            </div>
            <input
              type="range"
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              step={AMOUNT_STEP}
              value={formData.amount}
              onChange={handleSliderChange}
              aria-label="Adjust loan amount"
              className="ios-slider w-full"
            />
          </div>

          <div className="flex justify-between text-[13px] text-[var(--text-secondary)]">
            <span>$500</span>
            <span>$20,000+</span>
          </div>
        </Card>
      </section>

      <section>
        <SectionLabel>Repayment period</SectionLabel>
        <Card>
          <StepperRow
            label="Loan term"
            value={`${TENURE_OPTIONS[tenureIndex]} ${TENURE_OPTIONS[tenureIndex] === 1 ? "month" : "months"}`}
            onDecrement={() =>
              updateField("tenure", TENURE_OPTIONS[tenureIndex - 1])
            }
            onIncrement={() =>
              updateField("tenure", TENURE_OPTIONS[tenureIndex + 1])
            }
            canDecrement={tenureIndex > 0}
            canIncrement={tenureIndex < TENURE_OPTIONS.length - 1}
            decrementLabel="Shorter loan term"
            incrementLabel="Longer loan term"
          />
        </Card>
      </section>

      <section>
        <SectionLabel>Your preferred payout time</SectionLabel>
        <SegmentedControl<UrgencyValue>
          options={urgencyOptions}
          value={formData.urgency as UrgencyValue | ""}
          onChange={(value) => updateField("urgency", value)}
          ariaLabel="When do you need the funds"
        />
      </section>
    </div>
  );
}
