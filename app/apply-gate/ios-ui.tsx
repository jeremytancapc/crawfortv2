"use client";

import type { ReactNode } from "react";
import { Minus, Plus } from "@phosphor-icons/react";

/** White grouped-list container. Direct `CardRow` children get hairline dividers. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`ios-card ${className}`.trim()}>{children}</div>;
}

/** Single grouped-list row: label on the left, control or value on the right. */
export function CardRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`ios-row ${className}`.trim()}>{children}</div>;
}

/** Small caption that sits above a card, iOS grouped-table style. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 px-1 text-[13px] font-semibold leading-tight text-[var(--text-secondary)]">
      {children}
    </p>
  );
}

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

/**
 * iOS segmented control. Selected segment is white with an accent border;
 * unselected segments sit flat on the sunken track.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly SegmentedOption<T>[];
  value: T | "";
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="ios-segment" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-selected={isSelected}
            onClick={() => onChange(option.value)}
            className="ios-segment-item"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Grouped-list row with a minus/plus stepper on the trailing edge. */
export function StepperRow({
  label,
  value,
  onDecrement,
  onIncrement,
  canDecrement,
  canIncrement,
  decrementLabel,
  incrementLabel,
}: {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement: boolean;
  canIncrement: boolean;
  decrementLabel: string;
  incrementLabel: string;
}) {
  return (
    <CardRow>
      <span className="text-[17px] leading-tight text-[var(--text-primary)]">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">
          {value}
        </span>
        <div className="ios-stepper">
          <button
            type="button"
            onClick={onDecrement}
            disabled={!canDecrement}
            aria-label={decrementLabel}
          >
            <Minus size={16} weight="bold" />
          </button>
          <button
            type="button"
            onClick={onIncrement}
            disabled={!canIncrement}
            aria-label={incrementLabel}
          >
            <Plus size={16} weight="bold" />
          </button>
        </div>
      </div>
    </CardRow>
  );
}

/** Bottom action bar that stays in view and clears the iPhone home indicator. */
export function StickyFooter({ children }: { children: ReactNode }) {
  return <div className="ios-sticky-footer">{children}</div>;
}

/** Full-width blue pill, the single primary action on every gate step. */
export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex h-[52px] w-full items-center justify-center rounded-full bg-[var(--accent)] text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
