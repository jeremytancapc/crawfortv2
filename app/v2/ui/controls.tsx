"use client";

import {
  useCallback,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Minus, Plus } from "@phosphor-icons/react";

import { cx } from "@/app/v2/ui/screen";

// ── Buttons ───────────────────────────────────────────────────────────────────

type PillVariant = "primary" | "ghost" | "dark" | "singpass";

export function Pill({
  variant = "primary",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PillVariant;
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      className={cx("v2-pill", `v2-pill-${variant}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}

// ── Segmented ─────────────────────────────────────────────────────────────────

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  invalid = false,
  className,
}: {
  options: readonly SegmentedOption<T>[];
  value: T | "";
  onChange: (value: T) => void;
  ariaLabel: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      className={cx("v2-segmented", invalid && "is-invalid", className)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(option.value)}
            className="v2-segment"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Tab strip sharing the segmented look, for switching between panels. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  tabs: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cx("v2-segmented", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
          className="v2-segment"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────

export function Stepper({
  value,
  onDecrement,
  onIncrement,
  canDecrement = true,
  canIncrement = true,
  decrementLabel,
  incrementLabel,
}: {
  value: ReactNode;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement?: boolean;
  canIncrement?: boolean;
  decrementLabel: string;
  incrementLabel: string;
}) {
  return (
    <div className="v2-stepper">
      <button
        type="button"
        onClick={onDecrement}
        disabled={!canDecrement}
        aria-label={decrementLabel}
        className="v2-stepper-button"
      >
        <Minus size={16} weight="bold" />
      </button>
      <span className="v2-stepper-value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={!canIncrement}
        aria-label={incrementLabel}
        className="v2-stepper-button"
      >
        <Plus size={16} weight="bold" />
      </button>
    </div>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────────

export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("v2-rows", className)}>{children}</div>;
}

export function Row({
  label,
  value,
  wrap = false,
  action,
  onClick,
  className,
}: {
  label: ReactNode;
  value?: ReactNode;
  /** Allow the value to wrap onto two lines (addresses). */
  wrap?: boolean;
  action?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <span className="v2-row-label">{label}</span>
      <span className="flex min-w-0 items-center justify-end gap-2">
        {value !== undefined ? (
          <span className={cx("v2-row-value", wrap && "is-wrap")}>{value}</span>
        ) : null}
        {action}
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cx("v2-row", className)}>
        {content}
      </button>
    );
  }
  return <div className={cx("v2-row", className)}>{content}</div>;
}

// ── Chips / tags ──────────────────────────────────────────────────────────────

export function Chip({
  selected = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx("v2-chip", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("v2-tag", className)}>{children}</span>;
}

// ── Text field ────────────────────────────────────────────────────────────────

export function TextField({
  label,
  prefix,
  invalid = false,
  hint,
  className,
  id: idProp,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  prefix?: ReactNode;
  invalid?: boolean;
  hint?: ReactNode;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className={cx("v2-field", invalid && "is-invalid", className)}>
      <label htmlFor={id} className="v2-field-label">
        {label}
      </label>
      <div className="v2-field-control">
        {prefix ? <span className="v2-field-prefix">{prefix}</span> : null}
        <input id={id} className="v2-input" aria-invalid={invalid || undefined} {...rest} />
      </div>
      {hint ? <p className="v2-note">{hint}</p> : null}
    </div>
  );
}

// ── Amount input ──────────────────────────────────────────────────────────────

function snap(value: number, min: number, max: number, step: number): number {
  const bounded = Math.min(Math.max(value, min), max);
  return Math.min(max, Math.round(bounded / step) * step);
}

/**
 * Hero amount: a large editable number with a slider beneath. Typing is free
 * form; the value is clamped and snapped on blur, and the slider mirrors it.
 */
export function AmountInput({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  ariaLabel,
  plusAtMax = false,
  minLabel,
  maxLabel,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Fires when the user finishes an interaction (blur or slider release). */
  onCommit?: (value: number) => void;
  ariaLabel: string;
  plusAtMax?: boolean;
  minLabel?: string;
  maxLabel?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState<string | null>(null);
  const id = useId();

  const commit = useCallback(
    (next: number) => {
      onChange(next);
      onCommit?.(next);
    },
    [onChange, onCommit],
  );

  const display =
    raw !== null
      ? raw
      : `${value.toLocaleString("en-SG")}${plusAtMax && value >= max ? "+" : ""}`;
  const pct = max > min ? ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100 : 0;

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="v2-hero-num flex items-baseline gap-1">
        <span className="text-[0.62em] font-bold">$</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          aria-label={ariaLabel}
          onFocus={() => setRaw(String(value))}
          onChange={(event) => {
            const digits = event.target.value.replace(/[^0-9]/g, "").slice(0, 7);
            setRaw(digits);
            const parsed = parseInt(digits, 10);
            if (!Number.isNaN(parsed) && parsed >= min && parsed <= max) onChange(parsed);
          }}
          onBlur={() => {
            const parsed = parseInt(raw ?? "", 10);
            const next = Number.isNaN(parsed) ? min : snap(parsed, min, max, step);
            setRaw(null);
            commit(next);
          }}
          className="v2-hero-input"
        />
      </label>
      <div className="v2-slider" style={{ ["--pct" as string]: `${pct}%` }}>
        <div className="v2-slider-track" aria-hidden="true">
          <div className="v2-slider-fill" />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(Math.max(value, min), max)}
          onChange={(event) => onChange(parseInt(event.target.value, 10))}
          onPointerUp={() => onCommit?.(value)}
          onKeyUp={() => onCommit?.(value)}
          aria-label={`Adjust ${ariaLabel.toLowerCase()}`}
        />
      </div>
      {minLabel || maxLabel ? (
        <div className="flex justify-between text-[12px] text-[var(--v2-ink-3)]">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
