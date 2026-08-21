"use client";

import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { CaretLeft, CaretRight, Minus, Plus } from "@phosphor-icons/react";

import { SidebarTrustFeatures } from "@/app/sidebar-trust-features";
import {
  APPLY_PROGRESS_APPOINTMENT,
  APPLY_PROGRESS_START,
  APPLY_PROGRESS_TOTAL,
  applyProgressHint,
} from "@/lib/apply-progress";
import { useApplyProgressStep } from "@/lib/apply-progress-store";

/**
 * Full-bleed brand-blue bar: wordmark on the left, progress meter on the right
 * like a status-bar battery. Mobile apply chrome only.
 */
export function MobileGateHeader({
  progressStep,
  progressTotal = APPLY_PROGRESS_TOTAL,
}: {
  progressStep?: number;
  progressTotal?: number;
}) {
  return (
    <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 bg-[var(--brand-blue-hex)] px-5 py-4 lg:hidden">
      <Link
        href="/"
        className="flex min-h-11 min-w-0 items-center"
        aria-label="Crawfort home"
      >
        {/* Scales down rather than pushing the badge out on narrow phones. */}
        <Image
          src="/images/crawfort-white-color-dot.png"
          alt="Crawfort"
          width={1261}
          height={155}
          className="h-5 w-auto max-w-full object-contain object-left"
          priority
        />
      </Link>
      {progressStep != null ? (
        <ApplyProgressBadge current={progressStep} total={progressTotal} />
      ) : null}
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
  progressStep,
  children,
}: {
  sidebarTitle: string;
  sidebarSubtitle: string;
  progressStep?: number;
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
        {progressStep != null ? (
          <ApplyProgressPanel current={progressStep} total={APPLY_PROGRESS_TOTAL} />
        ) : null}
        <SidebarTrustFeatures />
      </aside>

      <main className="flex flex-1 flex-col overflow-x-clip">
        <div className="flex flex-1 flex-col lg:justify-start lg:px-12 lg:py-10 xl:px-20">
          <div className="flex w-full flex-1 flex-col lg:mx-auto lg:max-w-[520px] lg:flex-none">
            <div className="theme-ios flex min-h-[100svh] flex-col lg:min-h-[calc(100dvh-5rem)]">
              <MobileGateHeader progressStep={progressStep} />
              <MobileGateSheet>
                {children}
              </MobileGateSheet>
            </div>
          </div>
        </div>
        <IosLegalFooter />
      </main>
    </div>
  );
}

/** Percent never reads 0 or a premature 100 — the visit is the last 10%. */
function progressPercent(current: number, total: number): number {
  const ratio = Math.min(1, Math.max(0, current / total));
  return current >= total ? 100 : Math.min(99, Math.max(1, Math.round(ratio * 100)));
}

const PROGRESS_DOTS = 5;

/** Waypoint the applicant is standing on, 1-5. */
function progressActiveDot(current: number, total: number): number {
  return Math.min(
    PROGRESS_DOTS,
    Math.max(1, Math.ceil((current / total) * PROGRESS_DOTS)),
  );
}

/**
 * Five waypoints across the funnel; the last one is the office visit. A
 * teardrop pin marks the dot in play at either end of the journey — the first
 * one before you begin, the last one while the appointment is outstanding.
 */
function ProgressDots({
  activeDot,
  isPinned,
  isWaiting,
}: {
  activeDot: number;
  isPinned: boolean;
  isWaiting: boolean;
}) {
  return (
    <span className="flex items-center gap-[3.5px]" aria-hidden>
      {Array.from({ length: PROGRESS_DOTS }, (_, index) => {
        const dot = index + 1;
        const isActive = dot === activeDot;
        const fill =
          isActive && isWaiting
            ? "border-[1.5px] border-white/75"
            : dot <= activeDot
              ? "bg-[var(--brand-teal-hex)]"
              : "bg-white/30";

        return (
          <span
            key={dot}
            className="relative flex h-[5px] w-[5px] items-center justify-center"
          >
            {isActive && isPinned ? (
              <>
                <span className="absolute inset-0 animate-apply-blip rounded-full border border-[var(--brand-teal-hex)]/70" />
                <span className="absolute -top-[14px] left-1/2 h-[9px] w-[9px] -translate-x-1/2 -rotate-45 rounded-[50%_50%_50%_0] bg-[var(--brand-teal-hex)]" />
              </>
            ) : null}
            <span className={`h-full w-full rounded-full ${fill}`} />
          </span>
        );
      })}
    </span>
  );
}

/**
 * Status-bar-sized progress readout: five waypoint dots with the percentage
 * beside them. The ends of the journey are named instead of numbered — "Start"
 * before anything is filled in, "Appointment" while the visit is outstanding.
 * Tapping it opens the detail bubble explaining what closes the gap.
 */
export function ApplyProgressBadge({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const detailId = useId();

  const percent = progressPercent(current, total);
  const isStart = current <= APPLY_PROGRESS_START;
  const isWaitingForVisit =
    current >= APPLY_PROGRESS_APPOINTMENT && current < total;
  const label = isStart ? "Start" : isWaitingForVisit ? "Appointment" : `${percent}%`;
  const hint = applyProgressHint(current);

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? detailId : undefined}
        aria-label={
          isStart
            ? "Application not started yet. Show what happens next"
            : isWaitingForVisit
              ? `Application progress ${percent} percent, appointment outstanding. Show what is left`
              : `Application progress ${percent} percent. Show what is left`
        }
        className="flex h-8 items-center gap-[7px] rounded-full border border-white/25 bg-white/15 pl-2.5 pr-3 text-[12px] font-bold leading-none tracking-[0.01em] text-white transition-transform duration-150 active:scale-95"
      >
        <ProgressDots
          activeDot={progressActiveDot(current, total)}
          isPinned={isStart || isWaitingForVisit}
          isWaiting={isWaitingForVisit}
        />
        <span className="tabular-nums">{label}</span>
      </button>

      {isOpen ? (
        <div
          role="tooltip"
          id={detailId}
          className="absolute right-0 top-full z-40 mt-2.5 w-[min(17.5rem,calc(100vw-2.5rem))] animate-fade-up rounded-[16px] bg-[var(--surface-elevated)] p-3.5 text-left shadow-[0_14px_36px_rgba(0,0,20,0.22)] ring-1 ring-black/[0.06]"
        >
          <span
            className="absolute -top-1 right-4 h-3 w-3 rotate-45 rounded-[3px] bg-[var(--surface-elevated)]"
            aria-hidden
          />
          <div className="relative">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[15px] font-bold leading-none text-[var(--brand-blue-hex)]">
                {isStart ? "Ready to start" : `${percent}% complete`}
              </p>
              <p className="text-[11px] font-semibold leading-none text-[var(--text-tertiary)]">
                Step {Math.min(current, total)} of {total}
              </p>
            </div>
            <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: isStart ? "8px" : `${percent}%`,
                  background: "linear-gradient(90deg, #0033AA, #06DEC0)",
                }}
              />
            </div>
            <p className="mt-3 text-[13px] font-bold leading-tight text-[var(--text-primary)]">
              {hint.title}
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.45] text-[var(--text-secondary)]">
              {hint.detail}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Full-width progress module for the brand-blue sidebar. Desktop hides the
 * mobile header, and the sidebar has room to name the waypoints and spell out
 * what the current step needs, so it carries progress there instead.
 */
export function ApplyProgressPanel({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const percent = progressPercent(current, total);
  const isStart = current <= APPLY_PROGRESS_START;
  const isWaitingForVisit =
    current >= APPLY_PROGRESS_APPOINTMENT && current < total;
  const activeDot = progressActiveDot(current, total);
  const hint = applyProgressHint(current);

  return (
    <section className="relative z-10 my-8 max-w-[420px] rounded-[18px] border border-white/[0.14] bg-white/[0.07] px-6 pb-6 pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[32px] font-bold leading-none tracking-[-0.024em] text-white">
          {percent}%
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
          Step {Math.min(current, total)} of {total}
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={1}
        aria-valuemax={100}
        aria-valuetext={`${percent} percent`}
        aria-label="Application progress"
        className="mt-8 flex items-center"
      >
        {Array.from({ length: PROGRESS_DOTS }, (_, index) => {
          const dot = index + 1;
          const isDone = dot <= activeDot;
          const isActive = dot === activeDot;
          const isWaiting = isActive && isWaitingForVisit;

          return (
            <Fragment key={dot}>
              {index > 0 ? (
                <span
                  className={`h-[2px] flex-1 rounded-full ${isDone ? "bg-[var(--brand-teal-hex)]/60" : "bg-white/20"}`}
                />
              ) : null}
              <span className="relative flex h-[10px] w-[10px] shrink-0 items-center justify-center">
                {isActive ? (
                  <>
                    <span className="absolute inset-0 animate-apply-blip rounded-full border border-[var(--brand-teal-hex)]/70" />
                    <span className="absolute -top-[22px] left-1/2 h-[15px] w-[15px] -translate-x-1/2 -rotate-45 rounded-[50%_50%_50%_0] bg-[var(--brand-teal-hex)]" />
                  </>
                ) : null}
                <span
                  className={`h-full w-full rounded-full ${
                    isWaiting
                      ? "border-2 border-white/75"
                      : isDone
                        ? "bg-[var(--brand-teal-hex)]"
                        : "bg-white/25"
                  }`}
                />
              </span>
            </Fragment>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-4 text-[12px] font-semibold">
        <span className={isStart ? "text-white" : "text-white/45"}>Start</span>
        <span className={isWaitingForVisit ? "text-white" : "text-white/45"}>
          Appointment
        </span>
      </div>

      <p className="mt-5 text-[15px] font-bold leading-tight text-white">
        {hint.title}
      </p>
      <p className="mt-1.5 text-[13.5px] leading-[1.45] text-white/60">
        {hint.detail}
      </p>
    </section>
  );
}

/**
 * Sidebar progress for the gate landing pages, where the live step lives in
 * client state inside the form rather than on the server-rendered page.
 */
export function LiveApplyProgressPanel({
  fallbackStep,
  total = APPLY_PROGRESS_TOTAL,
}: {
  fallbackStep: number;
  total?: number;
}) {
  const current = useApplyProgressStep(fallbackStep);
  return <ApplyProgressPanel current={current} total={total} />;
}

/**
 * Step navigation intent, declared once per step and rendered in two places:
 * a small row above the content on desktop, and inside the sticky footer on
 * mobile. Both directions always render so the primary action stays centered;
 * omit onClick (or set disabled) to keep a side visible but not tappable.
 */
export type StepNavControls = {
  back?: { onClick?: () => void; disabled?: boolean };
  next?: { onClick?: () => void; disabled?: boolean };
};

function StepNavButton({
  direction,
  size,
  onClick,
  disabled = false,
  className = "",
}: {
  direction: "back" | "next";
  size: "sm" | "lg";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const isBack = direction === "back";
  const Icon = isBack ? CaretLeft : CaretRight;
  const skin =
    size === "sm"
      ? "h-9 w-9 bg-[var(--surface-elevated)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
      : "h-[52px] w-[52px] bg-[var(--surface-sunken)]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isBack ? "Previous step" : "Next step"}
      className={`flex shrink-0 items-center justify-center rounded-full text-[var(--text-primary)] transition-transform duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-30 ${skin} ${className}`.trim()}
    >
      <Icon size={size === "sm" ? 16 : 20} weight="bold" />
    </button>
  );
}

/** Desktop-only nav row. On mobile the same controls sit in the sticky footer,
 *  within thumb reach, so this row would only crowd the heading. */
export function GateStepNav({ nav }: { nav?: StepNavControls }) {
  if (nav == null) return null;

  return (
    <div className="hidden shrink-0 items-center justify-between gap-3 px-5 pt-4 lg:flex">
      <StepNavButton
        direction="back"
        size="sm"
        onClick={nav.back?.onClick}
        disabled={nav.back?.disabled || !nav.back?.onClick}
      />
      <StepNavButton
        direction="next"
        size="sm"
        onClick={nav.next?.onClick}
        disabled={nav.next?.disabled || !nav.next?.onClick}
      />
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
  nav,
  children,
}: {
  banner?: ReactNode;
  nav?: StepNavControls;
  children?: ReactNode;
}) {
  const hasBanner = banner != null;
  const hasAction = children != null && children !== false;
  const hasNav = nav != null;

  if (!hasAction && !hasNav) return null;

  return (
    <>
      {hasAction ? (
        <div
          className="hidden shrink-0 lg:block"
          style={{ height: hasBanner ? 120 : 84 }}
          aria-hidden
        />
      ) : null}
      {/* A nav-only bar exists for mobile alone: desktop keeps its controls up top. */}
      <div className={`ios-sticky-footer${hasAction ? "" : " lg:hidden"}`}>
        {hasBanner ? <div className="ios-sticky-footer-banner">{banner}</div> : null}
        <div className="ios-sticky-footer-action">
          {hasNav ? (
            <div className="flex items-end gap-2.5">
              <StepNavButton
                direction="back"
                size="lg"
                onClick={nav.back?.onClick}
                disabled={nav.back?.disabled || !nav.back?.onClick}
                className="lg:hidden"
              />
              <div className="min-w-0 flex-1">{children}</div>
              <StepNavButton
                direction="next"
                size="lg"
                onClick={nav.next?.onClick}
                disabled={nav.next?.disabled || !nav.next?.onClick}
                className="lg:hidden"
              />
            </div>
          ) : (
            children
          )}
        </div>
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
