"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

/** Small muted caption that sits above a field or a group of controls. */
export function FieldLabel({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("block text-[12px] font-medium leading-none text-[var(--rm-ink-3)]", className)}
    >
      {children}
    </label>
  );
}

export function DashedRule({ className }: { className?: string }) {
  return (
    <hr
      aria-hidden
      className={cn("border-0 border-t border-dashed border-[var(--rm-line-strong)]", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Pill group (segmented choice)
// ---------------------------------------------------------------------------

interface PillOption<T extends string> {
  id: T;
  label: string;
}

interface PillGroupProps<T extends string> {
  options: readonly PillOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  /** Stretch pills to fill the row (used for the 3-way frequency choice). */
  fill?: boolean;
  size?: "sm" | "md";
}

export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  fill = false,
  size = "md",
}: PillGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex gap-2", fill ? "flex-nowrap" : "flex-wrap")}>
      {options.map(({ id, label }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={cn(
              "rounded-full border font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]",
              size === "sm" && "min-w-11 px-3.5 py-1.5 text-[14px]",
              size === "md" && (fill ? "px-2 py-2.5 text-[14px] lg:px-3 lg:text-[15px]" : "px-5 py-2.5 text-[15px]"),
              fill && "min-w-0 flex-1 whitespace-nowrap",
              selected
                ? "border-[var(--rm-blue)] bg-[var(--rm-blue)] text-white shadow-[0_2px_10px_rgba(0,51,170,0.28)]"
                : "border-[var(--rm-line-strong)] bg-white text-[var(--rm-ink)] hover:border-[var(--rm-blue)] hover:text-[var(--rm-blue)]",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Underline text field
// ---------------------------------------------------------------------------

interface UnderlineFieldProps {
  id?: string;
  label: string;
  /** Committed value shown when the user is not mid-edit. */
  value: string;
  /** Called with the raw, sanitised string on blur / Enter. */
  onCommit: (raw: string) => void;
  /** Characters to keep while typing. Defaults to integers. */
  mode?: "integer" | "decimal";
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Larger value type for the two headline sliders. */
  emphasis?: boolean;
  /** Extra content on the right of the value row (e.g. a clear button). */
  trailing?: ReactNode;
  className?: string;
  autoFocus?: boolean;
}

/**
 * A text field drawn as a single underline. Keeps its own draft string while
 * focused so the caller only ever receives a committed value.
 */
export function UnderlineField({
  id,
  label,
  value,
  onCommit,
  mode = "integer",
  prefix,
  suffix,
  placeholder,
  disabled,
  emphasis = false,
  trailing,
  className,
  autoFocus,
}: UnderlineFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const pattern = mode === "decimal" ? /[^0-9.]/g : /[^0-9]/g;

  // Commit on Enter as well as blur so a value is never left dangling if the
  // blur event doesn't fire (e.g. soft keyboards dismissing without focus loss).
  // The ref stops Enter's synchronous follow-up blur from committing twice.
  const committedRef = useRef(false);
  const commitDraft = () => {
    if (draft !== null && !committedRef.current) {
      committedRef.current = true;
      onCommit(draft);
    }
    setDraft(null);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <div
        className="rm-field flex items-baseline gap-1.5 pb-1.5"
        data-disabled={disabled ? "true" : undefined}
      >
        {prefix && (
          <span
            className={cn(
              "select-none font-semibold text-[var(--rm-ink-2)]",
              emphasis ? "text-[17px]" : "text-[15px]",
            )}
          >
            {prefix}
          </span>
        )}
        <input
          id={fieldId}
          type="text"
          inputMode={mode === "decimal" ? "decimal" : "numeric"}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={shown}
          className={cn(
            "w-full min-w-0 font-bold text-[var(--rm-ink)] placeholder:font-medium placeholder:text-[var(--rm-ink-3)] disabled:cursor-not-allowed",
            emphasis ? "text-[22px] leading-7" : "text-[16px] leading-6",
          )}
          onChange={(e) => {
            committedRef.current = false;
            setDraft(e.target.value.replace(pattern, ""));
          }}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            commitDraft();
            (e.target as HTMLInputElement).blur();
          }}
        />
        {suffix && (
          <span className="select-none whitespace-nowrap text-[13px] font-medium text-[var(--rm-ink-3)]">
            {suffix}
          </span>
        )}
        {trailing}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  ariaLabel: string;
  minLabel?: string;
  maxLabel?: string;
  onChange: (v: number) => void;
}

export function Slider({
  value,
  min,
  max,
  step,
  disabled,
  ariaLabel,
  minLabel,
  maxLabel,
  onChange,
}: SliderProps) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="flex flex-col">
      <div className="rm-slider-wrap" style={{ "--slider-pct": `${pct}%` } as React.CSSProperties}>
        <div className="rm-slider-track" aria-hidden>
          <div className="rm-slider-fill" />
        </div>
        <input
          type="range"
          className="rm-slider"
          aria-label={ariaLabel}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-[12px] font-medium text-[var(--rm-ink-3)]">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
