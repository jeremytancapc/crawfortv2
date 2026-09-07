"use client";

import { useEffect, useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";

import { formatOfferAmount } from "@/lib/approval-display";
import {
  clampWithdrawAmount,
  MIN_WITHDRAW_AMOUNT,
} from "@/lib/withdraw-amount";

interface Props {
  value: number;
  max: number;
  onChange: (amount: number) => void;
  onCommit?: (amount: number) => void;
}

/**
 * Inline "For $25,000" editor on the plan page. Capped at the amount confirmed
 * on the previous step; live edits rebuild the plan-card instalments.
 */
export function PlanAmountField({ value, max, onChange, onCommit }: Props) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(String(value));

  useEffect(() => {
    if (!focused) setRaw(String(value));
  }, [value, focused]);

  const commit = (nextRaw: number) => {
    const next = clampWithdrawAmount(nextRaw, max);
    onChange(next);
    onCommit?.(next);
    setRaw(String(next));
  };

  const applyLive = (digits: string) => {
    setRaw(digits);
    const parsed = parseInt(digits, 10);
    if (!Number.isFinite(parsed) || parsed < MIN_WITHDRAW_AMOUNT) return;
    onChange(Math.min(parsed, max));
  };

  const display = value.toLocaleString("en-SG");

  return (
    <div className="mt-1.5">
      <label className="flex min-h-8 flex-wrap items-baseline gap-x-1.5">
        <span className="ios-type-subtitle">For</span>
        <span
          className="inline-flex items-baseline gap-0.5 border-b-[1.5px] border-dashed pb-0.5"
          style={{ borderColor: "var(--border-medium)" }}
        >
          <span
            aria-hidden
            className="ios-type-subtitle font-semibold text-[var(--text-primary)]"
          >
            $
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={focused ? raw : display}
            onFocus={() => {
              setFocused(true);
              setRaw(String(value));
            }}
            onChange={(event) => applyLive(event.target.value.replace(/[^0-9]/g, ""))}
            onBlur={() => {
              setFocused(false);
              commit(parseInt(raw, 10));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label={`Loan amount, maximum ${formatOfferAmount(max)}`}
            className="ios-display-input ios-type-subtitle m-0 border-0 bg-transparent p-0 font-semibold text-[var(--text-primary)] outline-none"
            style={{
              fieldSizing: "content",
              width: "auto",
              minWidth: `${Math.max(display.length, raw.length, 1)}ch`,
            }}
          />
          <PencilSimple
            size={14}
            weight="bold"
            className="mb-0.5 shrink-0 text-[var(--text-tertiary)]"
            aria-hidden
          />
        </span>
      </label>
    </div>
  );
}
