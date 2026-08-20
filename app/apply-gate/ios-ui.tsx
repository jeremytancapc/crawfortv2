"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus } from "@phosphor-icons/react";

import { SidebarTrustFeatures } from "@/app/sidebar-trust-features";

/** Full-bleed brand-blue bar with the white wordmark, mobile apply chrome only. */
export function MobileGateHeader() {
  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-center bg-[var(--brand-blue-hex)] px-5 lg:hidden">
      <Link href="/" className="flex h-11 items-center" aria-label="Crawfort home">
        <Image
          src="/images/crawfort-white-color-dot.png"
          alt="Crawfort"
          width={1261}
          height={155}
          className="h-5 w-auto"
          priority
        />
      </Link>
    </header>
  );
}

/** Continues the blue header so the page body can sit in a rounded-top sheet. */
export function MobileGateSheet({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--brand-blue-hex)] lg:bg-transparent">
      <div className="flex min-h-0 flex-1 flex-col rounded-t-[32px] bg-[var(--surface-primary)] lg:rounded-none">
        {children}
      </div>
    </div>
  );
}

/** Light legal footer used on iOS apply pages instead of the blue hero footer. */
export function IosLegalFooter() {
  return (
    <footer className="px-5 pb-10 pt-8 text-[13px] leading-[1.5] text-[var(--text-secondary)] lg:hidden">
      <p>
        CF Money Pte. Ltd. (UEN No. 201406595W) is a company incorporated under
        the laws of Singapore. Customers are advised to read the{" "}
        <a
          href="https://crawfort.com/sg/terms/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Terms and Conditions
        </a>{" "}
        and{" "}
        <a
          href="https://crawfort.com/sg/privacy/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Privacy Policy
        </a>{" "}
        carefully.
      </p>
    </footer>
  );
}

/** Shared post-gate chrome: blue wordmark bar, rounded sheet, iOS sidebar + footer. */
export function ApplyIosShell({
  sidebarTitle,
  sidebarSubtitle,
  children,
}: {
  sidebarTitle: string;
  sidebarSubtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="theme-ios flex min-h-[100dvh] flex-col bg-[var(--surface-primary)] lg:flex-row">
      <aside className="relative hidden overflow-hidden bg-[var(--accent)] p-12 lg:flex lg:w-[42%] lg:flex-col lg:justify-between xl:w-[38%] xl:p-16">
        <div className="relative z-10">
          <div className="mb-16">
            <Image
              src="/images/crawfort-white.png"
              alt="Crawfort"
              width={1261}
              height={155}
              className="h-6 w-auto"
              priority
            />
          </div>
          <p className="max-w-[420px] text-[44px] font-bold leading-[1.08] tracking-[-0.024em] text-white">
            {sidebarTitle}
          </p>
          <p className="mt-5 max-w-[380px] text-[17px] leading-[1.45] text-white/70">
            {sidebarSubtitle}
          </p>
        </div>
        <SidebarTrustFeatures />
      </aside>

      <main className="flex flex-1 flex-col overflow-x-clip">
        <div className="flex flex-1 flex-col lg:justify-start lg:px-12 lg:py-10 xl:px-20">
          <div className="flex w-full flex-1 flex-col lg:mx-auto lg:max-w-[520px] lg:flex-none">
            <div className="theme-ios flex min-h-[100svh] flex-col lg:min-h-[calc(100dvh-5rem)]">
              <MobileGateHeader />
              <MobileGateSheet>{children}</MobileGateSheet>
            </div>
          </div>
        </div>
        <IosLegalFooter />
      </main>
    </div>
  );
}

const PROGRESS_SEGMENTS = 20;

function mixHex(from: string, to: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ] as const;
  const a = parse(from);
  const b = parse(to);
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t)
    .toString(16)
    .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

function progressValue(current: number, total: number) {
  const ratio = Math.min(1, Math.max(0, current / total));
  const isFirstStep = current <= 1;
  return {
    filled: isFirstStep ? 1 : Math.max(1, Math.round(ratio * PROGRESS_SEGMENTS)),
    percent: isFirstStep ? 1 : Math.round(ratio * 100),
  };
}

/** 20-tick bar that fills blue → teal. Percent sits above so arrows can share the bar row. */
export function GateProgressNav({
  current,
  total,
  label,
  leading,
  trailing,
}: {
  current: number;
  total: number;
  label?: string;
  leading: ReactNode;
  trailing: ReactNode;
}) {
  const { filled, percent } = progressValue(current, total);

  return (
    <div className="shrink-0 px-5 pt-6">
      <div className="flex items-center gap-3">
        {leading}
        <div className="relative flex min-w-0 flex-1 justify-center">
          <p
            aria-hidden
            className="absolute bottom-full left-0 right-0 mb-2 text-center text-[15px] font-bold tabular-nums leading-none text-[var(--brand-blue-hex)]"
          >
            {percent}%
          </p>
          <div
            role="progressbar"
            aria-valuenow={current}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuetext={`${percent} percent`}
            aria-label={label ?? `Step ${current} of ${total}`}
            className="flex w-[75%] gap-[3px]"
          >
            {Array.from({ length: PROGRESS_SEGMENTS }, (_, index) => {
              const isFilled = index < filled;
              const stop = filled <= 1 ? 0 : index / (filled - 1);
              return (
                <span
                  key={index}
                  className="h-[7px] min-w-0 flex-1 rounded-[2px] transition-colors duration-300"
                  style={{
                    background: isFilled
                      ? mixHex("#0033AA", "#06DEC0", stop)
                      : "var(--surface-sunken)",
                  }}
                />
              );
            })}
          </div>
        </div>
        {trailing}
      </div>
    </div>
  );
}

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
 * Segmented control. Every option is a raised outlined pill so the row reads as
 * tappable; the selected one fills with the accent colour.
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

/** Bottom action bar that stays in view and clears the iPhone home indicator.
 *  Pass `banner` for a full-bleed strip (e.g. selected-plan) that sits flush
 *  to the bar's top edge and spans the whole right pane on desktop. */
export function StickyFooter({
  banner,
  children,
}: {
  banner?: ReactNode;
  children: ReactNode;
}) {
  const hasBanner = banner != null;
  return (
    <>
      <div
        className="hidden shrink-0 lg:block"
        style={{ height: hasBanner ? 120 : 84 }}
        aria-hidden
      />
      <div className="ios-sticky-footer">
        {hasBanner ? <div className="ios-sticky-footer-banner">{banner}</div> : null}
        <div className="ios-sticky-footer-action">{children}</div>
      </div>
    </>
  );
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
