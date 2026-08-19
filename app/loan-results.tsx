"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import {
  ArrowRight,
  Warning,
  Clock,
  ArrowLeft,
  X,
  TrendUp,
  CheckCircle,
  SealCheck,
  CaretDown,
  PencilSimple,
  CalendarBlank,
} from "@phosphor-icons/react";
import { PrimaryButton, StickyFooter } from "@/app/apply-gate/ios-ui";
import { motion, useReducedMotion } from "motion/react";
import { trackEvent } from "@/lib/analytics";
import {
  buildOfferPlans,
  calculateInstalment,
  OFFER_CONFIRMATION_DISCLAIMER,
  OFFER_MAX_PROCESSING_FEE_PCT,
  OFFER_MONTHLY_RATE,
  type OfferPlan,
} from "@/lib/offer-plans";

// ── Offer expiry helpers ──────────────────────────────────────────────────────

const SG_HOLIDAYS = new Set([
  "2026-01-01", "2026-02-17", "2026-02-18", "2026-03-21",
  "2026-04-03", "2026-05-01", "2026-05-27", "2026-06-01",
  "2026-08-10", "2026-11-09", "2026-12-25", "2027-01-01",
]);

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isBusinessDay(d: Date) {
  return d.getDay() !== 0 && !SG_HOLIDAYS.has(localISO(d));
}

/** Advance `from` by exactly `n` business days and return 7:30 PM on that date. */
function computeExpiry(from: Date, n = 3): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  let counted = 0;
  while (counted < n) {
    if (isBusinessDay(d)) counted++;
    if (counted < n) d.setDate(d.getDate() + 1);
  }
  d.setHours(19, 30, 0, 0);
  return d;
}

const BLANK_PARTS = { days: 0, hrs: 0, mins: 0, secs: 0, expired: false };

function useCountdownParts() {
  const expiryRef = useRef<Date | null>(null);

  const getParts = useCallback(() => {
    if (!expiryRef.current) return BLANK_PARTS;
    const ms = expiryRef.current.getTime() - Date.now();
    if (ms <= 0) return { days: 0, hrs: 0, mins: 0, secs: 0, expired: true };
    const totalSec = Math.floor(ms / 1000);
    return {
      days: Math.floor(totalSec / 86400),
      hrs:  Math.floor((totalSec % 86400) / 3600),
      mins: Math.floor((totalSec % 3600) / 60),
      secs: totalSec % 60,
      expired: false,
    };
  }, []);

  const [parts, setParts] = useState(BLANK_PARTS);

  useEffect(() => {
    expiryRef.current = computeExpiry(new Date());
    setParts(getParts());
    const id = setInterval(() => setParts(getParts()), 1000);
    return () => clearInterval(id);
  }, [getParts]);

  return {
    parts,
    expiry: expiryRef.current ?? computeExpiry(new Date()),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

interface FormData {
  amount: number;
  tenure: number;
  urgency: string;
  authMethod: "" | "singpass" | "manual";
  idType: string;
  fullName: string;
  nric: string;
  employmentStatus: string;
  monthlyIncome: string;
  mobile: string;
  loanPurpose: string;
  postalCode: string;
  address: string;
  moneylenderPaymentHistory?: string;
  leadId?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/** "1st", "2nd", "3rd", "4th"... for human-readable renewal/expiry dates. */
function ordinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

// ── Withdraw-today amount adjuster ────────────────────────────────────────────

const MIN_WITHDRAW_AMOUNT = 500;
const WITHDRAW_STEP = 100;

/** Clamp a user-entered/dragged amount to [min(500, max), max], snapped to the nearest $100.
 *  The true max is always reachable even when it isn't a $100 boundary (e.g. $9,393). */
function clampWithdrawAmount(raw: number, max: number): number {
  const safeMax = Math.max(max, 0);
  const floor = Math.min(MIN_WITHDRAW_AMOUNT, safeMax);
  if (!Number.isFinite(raw)) return safeMax;
  if (raw >= safeMax) return safeMax;

  // Max often isn't on a step boundary. Once the drag/input crosses the last
  // stepped value below max, jump to the exact maximum so the thumb can finish.
  const lastStep = Math.floor(safeMax / WITHDRAW_STEP) * WITHDRAW_STEP;
  if (lastStep < safeMax && raw > lastStep) return safeMax;

  const snapped = Math.round(raw / WITHDRAW_STEP) * WITHDRAW_STEP;
  return Math.min(Math.max(snapped, floor), safeMax);
}

const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Term-sheet confirmed offer card ───────────────────────────────────────────

const EASE = [0.16, 1, 0.3, 1] as const;

const SCROLL_VIEWPORT = { once: true, amount: 0.28, margin: "0px 0px -56px 0px" } as const;

/** Fade-up once the block actually enters the viewport — not on page load. */
function RevealOnScroll({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={SCROLL_VIEWPORT}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.5,
        ease: EASE,
        delay: prefersReducedMotion ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  );
}

interface OfferCardProps {
  formData: FormData;
  creditLimit?: number;
  withdrawAmount: number;
  onWithdrawAmountChange: (amount: number) => void;
}

const RING_SIZE = 176;
const RING_STROKE = 12;
const RING_RESERVED_COLOR = "#D1D1D6";

/** --offer-accent is tuned for icons; text on its tinted chip needs to go darker. */
const PRE_APPROVED_TEXT = "oklch(0.48 0.08 176)";

/** Donut split into available-today and reserved arcs, with the limit in the middle. */
function CreditLineRing({
  limit,
  available,
}: {
  limit: number;
  available: number;
}) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const availableFraction = limit > 0 ? Math.max(0, Math.min(1, available / limit)) : 0;

  // Round caps overhang each arc end by half a stroke, so the notch between the
  // two segments has to be wider than the stroke to read as a gap.
  const gapFraction = (RING_STROKE + 6) / circumference;
  const availableArc = Math.max(0, availableFraction - gapFraction);
  const reservedArc = Math.max(0, 1 - availableFraction - gapFraction);
  const availableOffset = gapFraction / 2;
  const reservedOffset = availableFraction + gapFraction / 2;
  const center = RING_SIZE / 2;
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="-rotate-90"
        role="img"
        aria-label={`${formatCurrency(limit)} total credit limit, of which ${formatCurrency(available)} is available to withdraw today`}
      >
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={RING_RESERVED_COLOR}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          initial={prefersReducedMotion ? { pathLength: reservedArc, pathOffset: reservedOffset } : { pathLength: 0, pathOffset: reservedOffset }}
          whileInView={{ pathLength: reservedArc, pathOffset: reservedOffset }}
          viewport={SCROLL_VIEWPORT}
          transition={{ duration: prefersReducedMotion ? 0 : 0.7, ease: EASE, delay: prefersReducedMotion ? 0 : 0.2 }}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          initial={prefersReducedMotion ? { pathLength: availableArc, pathOffset: availableOffset } : { pathLength: 0, pathOffset: availableOffset }}
          whileInView={{ pathLength: availableArc, pathOffset: availableOffset }}
          viewport={SCROLL_VIEWPORT}
          transition={{ duration: prefersReducedMotion ? 0 : 0.7, ease: EASE, delay: prefersReducedMotion ? 0 : 0.08 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-bold leading-none tracking-[-0.03em] tabular-nums text-[var(--text-primary)]">
          {formatCurrency(limit)}
        </span>
        <span className="mt-2 text-[13px] leading-none text-[var(--text-secondary)]">
          Total credit limit
        </span>
      </div>
    </div>
  );
}

/** Ring legend entry: colour swatch and label on the left, amount on the right. */
function RingLegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex items-center gap-2.5 text-[15px] leading-tight text-[var(--text-primary)]">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
        {label}
      </span>
      <span className="text-[15px] font-semibold leading-tight tabular-nums text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

function OfferHeader({
  formData,
  creditLimit,
  withdrawAmount,
  onWithdrawAmountChange,
}: OfferCardProps) {
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [amountRaw, setAmountRaw] = useState(String(withdrawAmount));

  const maxWithdraw = formData.amount;
  const minWithdraw = Math.min(MIN_WITHDRAW_AMOUNT, maxWithdraw);
  const limit = creditLimit && creditLimit > maxWithdraw ? creditLimit : maxWithdraw;
  const structuralReserve = Math.max(0, limit - maxWithdraw);
  const hasStructuralReserve = structuralReserve > 0;
  const isAtMax = withdrawAmount >= maxWithdraw;
  const canAdjust = maxWithdraw > minWithdraw;
  const sliderPct = canAdjust
    ? ((withdrawAmount - minWithdraw) / (maxWithdraw - minWithdraw)) * 100
    : 100;

  // Offer expiry date for the footer meta strip (static label, not a live clock).
  const renewalDate = useMemo(() => computeExpiry(new Date()), []);
  const renewalLabel = `${ordinalSuffix(renewalDate.getDate())} ${FULL_MONTHS[renewalDate.getMonth()]} ${renewalDate.getFullYear()}`;

  const commitAmount = (raw: number) => {
    const clamped = clampWithdrawAmount(raw, maxWithdraw);
    onWithdrawAmountChange(clamped);
    setAmountRaw(String(clamped));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Hero card: the single figure the customer acts on, then one meta row. */}
      <RevealOnScroll>
      <div className="ios-card">
        <div className="flex flex-col items-center px-4 pb-5 pt-6">
          <span className="text-[15px] font-semibold leading-tight text-[var(--text-primary)]">
            Withdraw today
          </span>

          <div className="mt-1.5 flex w-full justify-center">
            <div className="flex items-baseline leading-none">
              <span
                aria-hidden="true"
                className="text-[34px] font-bold leading-none tracking-[-0.03em] text-[var(--text-primary)]"
              >
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amountFocused ? amountRaw : withdrawAmount.toLocaleString("en-SG")}
                onFocus={() => {
                  setAmountFocused(true);
                  setAmountRaw(String(withdrawAmount));
                }}
                onChange={(e) => setAmountRaw(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={() => {
                  setAmountFocused(false);
                  commitAmount(parseInt(amountRaw, 10));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                disabled={!canAdjust}
                aria-label="Amount to withdraw today"
                className="border-0 bg-transparent p-0 text-center text-[52px] font-bold leading-none tracking-[-0.03em] tabular-nums text-[var(--text-primary)] outline-none disabled:opacity-100"
                style={{ fieldSizing: "content", width: "auto", minWidth: "2ch" }}
              />
            </div>
          </div>

          <p className="mt-1.5 text-[15px] leading-tight text-[var(--text-tertiary)]">
            Instant disbursement
          </p>

          {canAdjust && (
            <div className="mt-3 w-full">
              <div
                className="ios-slider-wrap"
                style={{ ["--slider-pct" as string]: `${sliderPct}%` }}
              >
                <div className="ios-slider-track" aria-hidden="true">
                  <div className="ios-slider-fill" />
                </div>
                <input
                  type="range"
                  className="ios-slider w-full"
                  min={minWithdraw}
                  max={maxWithdraw}
                  step={1}
                  value={withdrawAmount}
                  onChange={(e) => {
                    const val = clampWithdrawAmount(parseInt(e.target.value, 10), maxWithdraw);
                    onWithdrawAmountChange(val);
                    setAmountRaw(String(val));
                  }}
                  aria-label="Slide to choose a lower withdrawal amount"
                />
              </div>
              <div className="flex h-5 items-center justify-between text-[13px] leading-none text-[var(--text-secondary)]">
                <span className="tabular-nums">{formatCurrency(minWithdraw)}</span>
                {isAtMax ? (
                  <span className="tabular-nums">{formatCurrency(maxWithdraw)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => commitAmount(maxWithdraw)}
                    className="font-semibold tabular-nums text-[var(--accent)] underline underline-offset-2"
                  >
                    Use max {formatCurrency(maxWithdraw)}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ios-row" style={{ borderTop: "1px solid var(--separator)" }}>
          <span className="flex items-center gap-2 text-[15px] font-semibold leading-tight text-[var(--text-primary)]">
            <CalendarBlank size={16} weight="bold" className="text-[var(--text-tertiary)]" />
            Offer expires
          </span>
          <span className="text-[15px] leading-tight text-[var(--text-secondary)]">
            {renewalLabel}
          </span>
        </div>
      </div>
      </RevealOnScroll>

      {/* Credit line: the ring carries the limit, so the figures below stay two
          quiet rows instead of a second stack of hero numbers. */}
      {hasStructuralReserve ? (
        <RevealOnScroll>
        <div className="ios-card px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[17px] font-semibold leading-tight text-[var(--text-primary)]">
              Your credit line
            </span>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none"
              style={{ background: "var(--offer-accent-ring)", color: PRE_APPROVED_TEXT }}
            >
              <SealCheck size={13} weight="fill" />
              Pre-approved
            </span>
          </div>

          <div className="flex justify-center py-5">
            <CreditLineRing limit={limit} available={maxWithdraw} />
          </div>

          <RingLegendRow
            color="var(--accent)"
            label="Available today"
            value={formatCurrency(maxWithdraw)}
          />
          <RingLegendRow
            color={RING_RESERVED_COLOR}
            label="Unlocks over time"
            value={`+${formatCurrency(structuralReserve)}`}
          />

          <button
            type="button"
            onClick={() => setIsExplainerOpen((open) => !open)}
            aria-expanded={isExplainerOpen}
            className="mt-1 flex w-full items-center justify-between gap-3 pt-3 text-left"
            style={{ borderTop: "1px solid var(--separator)" }}
          >
            <span className="text-[15px] leading-tight text-[var(--text-secondary)]">
              How your credit line works
            </span>
            <CaretDown
              size={14}
              weight="bold"
              className="shrink-0 text-[var(--text-tertiary)] transition-transform duration-200"
              style={{ transform: isExplainerOpen ? "rotate(180deg)" : "none" }}
            />
          </button>
          {isExplainerOpen && (
            <p className="pb-1 pt-2 text-[14px] leading-[1.45] text-[var(--text-secondary)]">
              Your {formatCurrency(limit)} limit is pre-approved.{" "}
              {formatCurrency(maxWithdraw)} is ready for instant disbursement today, and the rest
              unlocks as you repay on time in the Crawfort app.
            </p>
          )}
        </div>
        </RevealOnScroll>
      ) : (
        <RevealOnScroll>
        <div className="ios-card">
          <div className="ios-row">
            <span className="flex items-center gap-2 text-[15px] leading-tight text-[var(--text-primary)]">
              <SealCheck size={16} weight="fill" style={{ color: "var(--offer-accent)" }} />
              Pre-approved credit line
            </span>
            <span className="text-[15px] font-semibold leading-tight tabular-nums text-[var(--text-primary)]">
              {formatCurrency(limit)}
            </span>
          </div>
        </div>
        </RevealOnScroll>
      )}
    </div>
  );
}

// ── Plan picker ───────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: OfferPlan;
  isSelected: boolean;
  isFlipped: boolean;
  onSelect: () => void;
  onFlipBack: () => void;
}

/** Card labels are space-constrained in the 3-up grid, so drop the trailing "Plan" suffix. */
function shortPlanName(title: string): string {
  return title.replace(/\s+Plan$/i, "");
}

const FLIP_DURATION = 0.55;

/** Height of the reserved ribbon slot above every card - keeps the blue headers aligned. */
const RIBBON_HEIGHT = "1.25rem";

/** Ring + drop shadow drawn around a whole card, ribbon included. */
function cardFrameShadow(isSelected: boolean): string {
  return isSelected
    ? "0 0 0 3px var(--brand-blue-hex, #0033AA), 0 8px 24px oklch(0.32 0.14 260 / 0.12)"
    : "0 0 0 1px var(--border-subtle), 0 4px 16px oklch(0.24 0.06 260 / 0.08), 0 1px 3px oklch(0.24 0.06 260 / 0.06)";
}

function PlanCard({
  plan,
  isSelected,
  isFlipped,
  onSelect,
  onFlipBack,
}: PlanCardProps) {
  const isPopular = Boolean(plan.badge);
  const prefersReducedMotion = useReducedMotion();

  // `perspective` forces Chrome to rasterize the whole card as a 3D layer, which
  // softens its text. Mount it only while the card is mid-flip or showing its back.
  const [isFlipping, setIsFlipping] = useState(false);

  return (
    <div className="relative h-full w-full">
      {/* Ring + shadow live outside the flip so they frame the ribbon and the
          card as one unit, and stay crisp while the faces rotate. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 rounded-[6px] transition-shadow duration-200"
        style={{
          top: isPopular ? 0 : RIBBON_HEIGHT,
          boxShadow: cardFrameShadow(isSelected),
        }}
      />

      {/* Popular ribbon also sits outside the flip so it never rotates, mirrors,
          or disappears when the details face comes forward. */}
      {isPopular && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[3]"
          style={{ height: RIBBON_HEIGHT }}
        >
          {/* .popular-badge-glow sets position: relative, so the positioning has
              to live on the wrapper above it. */}
          <div
            className="popular-badge-glow flex h-full w-full items-center justify-center rounded-t-[6px]"
            style={{ background: "#F5C518" }}
          >
            <span
              className="relative z-[1] text-[8px] font-bold uppercase tracking-wide"
              style={{ color: "#0a1628" }}
            >
              Popular
            </span>
          </div>
        </div>
      )}

      {/* The front face stays in flow so the grid row keeps sizing to it; the
          details face is layered on top, pre-rotated. */}
      <div
        className="h-full w-full"
        style={{ perspective: isFlipped || isFlipping ? 1000 : undefined }}
      >
      <motion.div
        className="relative flex h-full w-full flex-col"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        onAnimationStart={() => setIsFlipping(true)}
        onAnimationComplete={() => setIsFlipping(false)}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: FLIP_DURATION, ease: [0.22, 1, 0.36, 1] }
        }
      >
    <button
      type="button"
      onClick={onSelect}
      className="relative flex h-full w-full flex-col text-center focus:outline-none"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
      aria-pressed={isSelected}
      aria-label={`${shortPlanName(plan.title)}${isPopular ? ", most popular" : ""}: ${plan.pitch}, ${formatCurrency(plan.monthlyInstalment)} a month over ${plan.tenure} months. Shows the full breakdown.`}
      aria-hidden={isFlipped}
      tabIndex={isFlipped ? -1 : 0}
    >
      {/* Reserved ribbon slot - keeps blue headers aligned across all three cards */}
      <div className="w-full shrink-0" style={{ height: RIBBON_HEIGHT }} aria-hidden="true" />

      <div
        className="relative flex w-full flex-1 flex-col overflow-hidden"
        style={{
          borderRadius: isPopular ? "0 0 6px 6px" : "6px",
          background: "var(--surface-elevated)",
        }}
      >
        {/* Plays once when the card becomes selected - a brief glassy sweep
            that reads as premium feedback without tinting the resting card. */}
        {isSelected && <div aria-hidden="true" className="selected-card-shine z-[2]" />}

        {/* Header - plan name + tenure, with shiny overlay */}
        <div
          className="relative flex w-full shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden px-1 py-1.5 sm:gap-1 sm:px-1.5 sm:py-2"
          style={{ background: "var(--brand-blue-hex)" }}
        >
          {/* Corner sheen - kept off the centred text (which now spans two lines) by
              sitting in the top-left and bottom-right corners rather than a middle sweep. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(130% 70% at 0% 0%, oklch(1 0 0 / 0.24) 0%, transparent 55%), radial-gradient(130% 70% at 100% 100%, oklch(1 0 0 / 0.14) 0%, transparent 55%)",
            }}
          />
          <span
            className="relative min-w-0 max-w-full truncate text-[15px] font-semibold leading-snug text-white"
            style={{
              fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            {shortPlanName(plan.title)}
          </span>
          <span
            className="relative inline-flex max-w-full items-center truncate rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-[0.04em] text-white sm:px-2.5 sm:text-[10px] sm:tracking-[0.06em]"
            style={{ background: "oklch(1 0 0 / 0.18)" }}
          >
            {plan.tenure} {plan.tenure === 1 ? "month" : "months"} tenure
          </span>
        </div>

        <div className="relative flex flex-1 flex-col items-center gap-4 px-2 py-3 sm:gap-6 sm:px-3 sm:py-5">
          <div className="flex w-full flex-col items-center gap-2.5 sm:gap-3">
            {/* Price block - tenure lives in the header above so the monthly figure
                can carry the most visual weight. */}
            <div className="flex w-full flex-col items-center gap-1">
              <span
                className="text-[9px] font-bold tracking-[0.1em] uppercase sm:text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Monthly
              </span>
              <motion.span
                key={plan.monthlyInstalment}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="tabular-nums text-[1.25rem] leading-none sm:text-[1.875rem]"
                style={{
                  fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                  fontWeight: 600,
                  color: isSelected ? "var(--brand-blue-hex)" : "var(--text-primary)",
                  letterSpacing: "-0.02em",
                }}
              >
                {formatCurrency(plan.monthlyInstalment)}
              </motion.span>
            </div>

            {/* Benefit-led pitch, then proof points. Fixed slot heights keep the
                pitch and bullet N aligned across all three cards. */}
            <span
              className="flex h-[2.25rem] w-full items-start justify-center text-[12px] font-bold leading-tight tracking-[-0.01em] sm:text-[14px]"
              style={{
                fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                color: isSelected ? "var(--brand-blue-hex)" : "var(--text-primary)",
              }}
            >
              {plan.pitch}
            </span>

            <ul className="grid w-full grid-rows-[2rem_2rem] gap-1 text-left sm:gap-1.5">
              {plan.sellingPoints.map((point) => (
                <li key={point} className="flex min-h-0 items-start overflow-hidden">
                  <span className="flex min-w-0 items-start gap-1 sm:gap-1.5">
                    <CheckCircle
                      size={13}
                      weight="fill"
                      className="mt-px shrink-0"
                      style={{ color: "#22c55e" }}
                    />
                    <span
                      className="min-w-0 text-[10.5px] font-semibold leading-snug sm:text-[12px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {point}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pick-this-plan footer doubles as the selection indicator */}
          <span
            className="mt-auto flex w-full shrink-0 items-center justify-center gap-1 rounded-[var(--radius-md)] px-1 py-2 text-[10px] font-semibold leading-none transition-all duration-200 sm:py-2.5 sm:text-[12px]"
            style={{
              background: isSelected ? "var(--brand-blue-hex)" : "transparent",
              color: isSelected ? "#ffffff" : "var(--text-secondary)",
              border: isSelected ? "none" : "1.5px solid var(--border-medium)",
            }}
          >
            {isSelected ? (
              <>
                <CheckCircle size={13} weight="fill" />
                Selected
              </>
            ) : (
              "Pick this plan"
            )}
          </span>
        </div>
      </div>
    </button>

        {/* Details face - the whole thing is the flip-back target, so a tap
            anywhere on the card returns to the sales side. */}
        <button
          type="button"
          onClick={onFlipBack}
          aria-label={`Hide the ${shortPlanName(plan.title)} numbers`}
          tabIndex={isFlipped ? 0 : -1}
          aria-hidden={!isFlipped}
          className="absolute inset-0 flex flex-col text-left focus:outline-none"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="w-full shrink-0" style={{ height: RIBBON_HEIGHT }} aria-hidden="true" />
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            style={{
              borderRadius: isPopular ? "0 0 6px 6px" : "6px",
              background: "var(--surface-elevated)",
            }}
          >
            <div
              className="flex shrink-0 items-center justify-between gap-1 px-1.5 py-1.5"
              style={{ background: "var(--brand-blue-hex)" }}
            >
              <span className="min-w-0 truncate text-[10px] font-semibold text-white sm:text-[11px]">
                The numbers
              </span>
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: "oklch(1 0 0 / 0.18)" }}
              >
                <ArrowLeft size={10} weight="bold" />
              </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col justify-center px-1.5">
              {[
                { label: "Monthly instalment", value: formatCurrency(plan.monthlyInstalment), isKey: true },
                { label: "Tenure", value: `${plan.tenure} ${plan.tenure === 1 ? "month" : "months"}` },
                { label: "Interest rate", value: `Up to ${formatRate(plan.monthlyRate)}/mo` },
                { label: "Processing fee", value: `Up to ${OFFER_MAX_PROCESSING_FEE_PCT}%` },
                { label: "Total repayable", value: formatCurrency(plan.totalRepayment) },
              ].map((row, index, rows) => (
                <div
                  key={row.label}
                  className="flex flex-col gap-px py-[3px]"
                  style={{
                    borderBottom:
                      index === rows.length - 1 ? "none" : "1px solid var(--separator)",
                  }}
                >
                  <span
                    className="text-[8px] font-bold uppercase leading-tight tracking-[0.06em] sm:text-[9px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {row.label}
                  </span>
                  <span
                    className="tabular-nums text-[11px] font-semibold leading-tight sm:text-[12px]"
                    style={{
                      color: row.isKey ? "var(--brand-blue-hex)" : "var(--text-primary)",
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <span
              className="shrink-0 px-1.5 pb-1.5 pt-1 text-[8px] leading-tight sm:text-[9px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Tap anywhere to go back
            </span>
          </div>
        </button>
      </motion.div>
      </div>
    </div>
  );
}

function CustomOfferCard({
  isSelected,
  onSelect,
  onCancel,
  amount,
  tenure,
  onAmountChange,
  onTenureChange,
}: {
  isSelected: boolean;
  onSelect: () => void;
  onCancel: () => void;
  amount: string;
  tenure: string;
  onAmountChange: (value: string) => void;
  onTenureChange: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(true);
  const [tipOpen, setTipOpen] = useState(false);
  const amountValue = parseInt(amount, 10);
  const tenureValue = parseInt(tenure, 10);
  const canConfirm =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    Number.isFinite(tenureValue) &&
    tenureValue > 0;

  // Re-open the form whenever the card is freshly selected.
  useEffect(() => {
    if (isSelected) setIsEditing(true);
  }, [isSelected]);

  if (!isSelected) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="group flex w-full flex-col items-center gap-3 rounded-[var(--radius-lg)] p-4 text-center transition-all duration-200 hover:bg-[var(--surface-secondary)] active:scale-[0.99]"
        style={{ boxShadow: "0 0 0 1px var(--border-subtle)" }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Want a different amount or tenure?
          </span>
          <span className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Tell us what loan plan you need and our team will follow up to confirm the details.
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold text-white transition-all duration-200 group-hover:brightness-110 group-active:scale-[0.97]"
          style={{ background: "var(--brand-blue-hex)" }}
        >
          Request custom loan amount & tenure
          <ArrowRight size={12} weight="bold" />
        </span>
      </button>
    );
  }

  return (
    <div
      className="relative flex flex-col gap-4 overflow-hidden rounded-[var(--radius-lg)] p-4"
      style={{
        background: "var(--surface-elevated)",
        boxShadow: "0 0 0 3px var(--brand-blue-hex, #0033AA), 0 8px 24px oklch(0.32 0.14 260 / 0.12)",
      }}
    >
      {/* Plays once when the custom-offer panel opens - same brief glassy
          sweep used on the selected plan cards. */}
      <div aria-hidden="true" className="selected-card-shine z-[2]" />

      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Custom offer
        </span>
        <span className="relative inline-flex shrink-0">
          <button
            type="button"
            aria-label="About custom offers"
            aria-expanded={tipOpen}
            onClick={() => setTipOpen((v) => !v)}
            onMouseEnter={() => setTipOpen(true)}
            onMouseLeave={() => setTipOpen(false)}
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[9px] font-bold leading-none transition-colors duration-150"
            style={{
              borderColor: "var(--border-medium)",
              color: "var(--text-secondary)",
              background: "var(--surface-secondary)",
            }}
          >
            ?
          </button>
          {tipOpen && (
            <div
              role="tooltip"
              className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(260px,70vw)] whitespace-normal rounded-[var(--radius-md)] px-3 py-2.5 text-left shadow-lg"
              style={{
                background: "var(--surface-elevated)",
                boxShadow: "0 0 0 1px var(--border-subtle), 0 8px 24px oklch(0.24 0.06 260 / 0.18)",
              }}
            >
              <p
                className="text-[12px] font-medium leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                Outside our standard plans and not a final approval. Our team will call and WhatsApp you to confirm the exact terms.
              </p>
            </div>
          )}
        </span>
      </div>

      {isEditing ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-tertiary)" }}>
                Loan amount
              </span>
              <div
                className="flex items-center gap-1 rounded-[var(--radius-md)] px-3 py-2.5"
                style={{ background: "var(--surface-elevated)", boxShadow: "0 0 0 1px var(--border-medium)" }}
              >
                <span className="text-[15px] font-semibold" style={{ color: "var(--text-tertiary)" }}>$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  className="w-full bg-transparent text-[15px] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-tertiary)" }}>
                Tenure (months)
              </span>
              <div
                className="flex items-center gap-1 rounded-[var(--radius-md)] px-3 py-2.5"
                style={{ background: "var(--surface-elevated)", boxShadow: "0 0 0 1px var(--border-medium)" }}
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  value={tenure}
                  onChange={(e) => onTenureChange(e.target.value)}
                  className="w-full bg-transparent text-[15px] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  style={{ color: "var(--text-primary)" }}
                />
                <span className="text-[13px] font-medium" style={{ color: "var(--text-tertiary)" }}>mo</span>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex h-11 w-full items-center justify-center rounded-[var(--radius-md)] text-[13px] font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              style={{
                background: "transparent",
                color: "oklch(0.62 0.17 25)",
                border: "1.5px solid oklch(0.62 0.17 25 / 0.35)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={!canConfirm}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] text-[13px] font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              style={{ background: "var(--brand-blue-hex)", color: "#ffffff" }}
            >
              <CheckCircle size={15} weight="fill" />
              Confirm details
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-tertiary)" }}>
                Loan amount
              </span>
              <span className="text-[18px] font-semibold tabular-nums" style={{ color: "var(--brand-blue-hex)" }}>
                {formatCurrency(amountValue)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-tertiary)" }}>
                Tenure
              </span>
              <span className="text-[18px] font-semibold tabular-nums" style={{ color: "var(--brand-blue-hex)" }}>
                {tenureValue} {tenureValue === 1 ? "month" : "months"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] text-[13px] font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1.5px solid var(--border-medium)",
            }}
          >
            <PencilSimple size={14} weight="bold" />
            Edit details
          </button>
        </div>
      )}
    </div>
  );
}

interface PlanPickerProps {
  selectedPlanId: OfferPlan["id"] | null;
  onPlanSelect: (id: OfferPlan["id"] | null) => void;
  plans: OfferPlan[];
  customAmount: string;
  customTenure: string;
  onCustomAmountChange: (value: string) => void;
  onCustomTenureChange: (value: string) => void;
}

function PlanPicker({
  selectedPlanId,
  onPlanSelect,
  plans,
  customAmount,
  customTenure,
  onCustomAmountChange,
  onCustomTenureChange,
}: PlanPickerProps) {
  const [flippedPlanId, setFlippedPlanId] = useState<OfferPlan["id"] | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3 items-stretch">
        {plans.map((plan, index) => (
          <RevealOnScroll key={plan.id} className="h-full" delay={index * 0.06}>
            <PlanCard
              plan={plan}
              isSelected={selectedPlanId === plan.id}
              isFlipped={flippedPlanId === plan.id}
              onSelect={() => {
                onPlanSelect(plan.id);
                setFlippedPlanId(plan.id);
              }}
              onFlipBack={() => setFlippedPlanId(null)}
            />
          </RevealOnScroll>
        ))}
      </div>
      <RevealOnScroll>
      <CustomOfferCard
        isSelected={selectedPlanId === "custom"}
        onSelect={() => {
          onPlanSelect("custom");
          setFlippedPlanId(null);
        }}
        onCancel={() => {
          onPlanSelect(null);
          onCustomAmountChange("");
          onCustomTenureChange("");
        }}
        amount={customAmount}
        tenure={customTenure}
        onAmountChange={onCustomAmountChange}
        onTenureChange={onCustomTenureChange}
      />
      </RevealOnScroll>
    </div>
  );
}

// ── Reconsider Modal ──────────────────────────────────────────────────────────

const SURVEY_REASONS = [
  { emoji: "🔍", label: "Shopping around" },
  { emoji: "⏳", label: "Don't need for now" },
  { emoji: "💰", label: "Loan amount doesn't match my expectation" },
  { emoji: "📊", label: "Rates don't match my expectations" },
];

const DETERRENT_ITEMS = [
  {
    icon: Clock,
    heading: "Offer expires in 3 days",
    body: "This confirmed loan offer is time-limited. If it expires, you will need to submit a full application again.",
  },
  {
    icon: TrendUp,
    heading: "Rates may change on reapplication",
    body: "Interest rates are assessed at the time of application. A future application is not guaranteed the same rate.",
  },
  {
    icon: Warning,
    heading: "Your credit check is already done",
    body: "We have already performed a soft credit assessment for this offer. Reapplying later triggers a fresh check.",
  },
] as const;

function OfferCountdown() {
  const { parts } = useCountdownParts();
  if (parts.expired) return <>Offer expired</>;
  if (parts.days > 0) return <>{parts.days}d {parts.hrs}h {parts.mins}m {String(parts.secs).padStart(2, "0")}s</>;
  return <>{String(parts.hrs).padStart(2, "0")}:{String(parts.mins).padStart(2, "0")}:{String(parts.secs).padStart(2, "0")}</>;
}

type ModalStep = "deterrent" | "survey" | "final";

function ReconsiderModal({
  onAccept,
  onClose,
  leadId,
}: {
  onAccept: () => void;
  onClose: () => void;
  leadId?: string;
}) {
  const [step, setStep] = useState<ModalStep>("deterrent");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleReasonSelect = (label: string) => {
    setSelectedReason(label);
    if (leadId) {
      fetch("/api/apply/decline-reason", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId, reason: label }),
      }).catch(() => {});
    }
    trackEvent("step_offer_declined", { reason: label });
    setStep("final");
  };

  // suppress unused warning - selectedReason is set for tracking purposes
  void selectedReason;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4"
      style={{
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        background: "oklch(0.18 0.02 260 / 0.55)",
        animation: "fade-up 0.25s cubic-bezier(0.16,1,0.3,1) both",
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[480px] rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] px-6 pb-8 pt-6 flex flex-col gap-6"
        style={{ background: "var(--surface-elevated)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {step !== "final" && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[var(--surface-secondary)] active:scale-[0.95]"
            aria-label="Close"
          >
            <X size={16} weight="bold" className="text-[var(--text-tertiary)]" />
          </button>
        )}

        {step === "deterrent" && (
          <>
            <div className="flex flex-col gap-2 pr-8">
              <p
                className="text-xl font-bold tracking-tight text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-inter-tight), system-ui, sans-serif", letterSpacing: "-0.03em" }}
              >
                Are you sure?
              </p>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                Your loan offer is confirmed. Here is what you stand to lose by waiting.
              </p>
            </div>

            <ul className="flex flex-col gap-5">
              {DETERRENT_ITEMS.map(({ icon: Icon, heading, body }, i) => (
                <li
                  key={i}
                  className="flex items-start gap-4"
                  style={{ opacity: 0, animation: `fade-up 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 70}ms both` }}
                >
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
                    style={{ background: "oklch(0.78 0.16 178 / 0.10)" }}
                  >
                    <Icon size={15} weight="duotone" className="text-brand-teal" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {i === 0 ? (
                        <span className="inline-flex items-baseline gap-1.5 flex-wrap">
                          Loan offer expires in:
                          <span className="font-black tracking-tight tabular-nums text-red-500">
                            <OfferCountdown />
                          </span>
                        </span>
                      ) : heading}
                    </p>
                    <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="h-px bg-[var(--border-subtle)]" />

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-teal text-sm font-semibold text-[var(--text-primary)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              >
                <ArrowLeft size={16} weight="bold" />
                Back to offer
              </button>
              <button
                type="button"
                onClick={() => setStep("survey")}
                className="text-center text-xs text-[var(--text-tertiary)] transition-colors duration-200 hover:text-[var(--text-secondary)]"
              >
                I understand, I still need more time
              </button>
            </div>
          </>
        )}

        {step === "survey" && (
          <>
            <div
              className="flex flex-col gap-2 pr-8"
              style={{ animation: "fade-up 0.3s cubic-bezier(0.16,1,0.3,1) both" }}
            >
              <p
                className="text-xl font-bold tracking-tight text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-inter-tight), system-ui, sans-serif", letterSpacing: "-0.03em" }}
              >
                No worries, mind sharing why?
              </p>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                Help us understand so we can improve. Your answer won&apos;t affect your application.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SURVEY_REASONS.map(({ emoji, label }, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleReasonSelect(label)}
                  className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-secondary)] px-3 py-4 text-center transition-all duration-200 hover:border-brand-blue hover:bg-[var(--surface-elevated)] active:scale-[0.97]"
                  style={{ opacity: 0, animation: `fade-up 0.35s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both` }}
                >
                  <span className="text-2xl leading-none">{emoji}</span>
                  <span className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === "final" && (
          <>
            <div
              className="flex flex-col items-center gap-3 pt-2 text-center"
              style={{ animation: "fade-up 0.35s cubic-bezier(0.16,1,0.3,1) both" }}
            >
              <span className="text-4xl">⚡</span>
              <p className="font-display text-2xl font-semibold tracking-tight text-brand-blue">
                Final Chance!
              </p>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)] max-w-[320px]">
                Your confirmed loan offer is reserved. Once it expires, you&apos;ll need to reapply from scratch.
              </p>
            </div>

            <div className="h-px bg-[var(--border-subtle)]" />

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onAccept}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-blue text-sm font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                style={{ animation: "fade-up 0.4s cubic-bezier(0.16,1,0.3,1) 100ms both" }}
              >
                <ArrowRight size={16} weight="bold" />
                Yes, book my appointment now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Custom offer confirm modal ────────────────────────────────────────────────

function CustomOfferConfirmModal({
  amount,
  tenure,
  isSubmitting,
  onConfirm,
  onClose,
}: {
  amount: number;
  tenure: number;
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4"
      style={{
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        background: "oklch(0.18 0.02 260 / 0.55)",
        animation: "fade-up 0.25s cubic-bezier(0.16,1,0.3,1) both",
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[440px] rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] px-6 pb-8 pt-6 flex flex-col gap-6"
        style={{ background: "var(--surface-elevated)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[var(--surface-secondary)] active:scale-[0.95]"
          aria-label="Close"
        >
          <X size={16} weight="bold" className="text-[var(--text-tertiary)]" />
        </button>

        <div className="flex flex-col gap-2 pr-8">
          <p
            className="text-xl font-bold tracking-tight text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-inter-tight), system-ui, sans-serif", letterSpacing: "-0.03em" }}
          >
            Confirm your custom offer request
          </p>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            You&apos;re requesting{" "}
            <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(amount)}</span> over{" "}
            <span className="font-semibold text-[var(--text-primary)]">
              {tenure} {tenure === 1 ? "month" : "months"}
            </span>
            , outside our standard plans.
          </p>
        </div>

        <div
          className="flex items-start gap-3 rounded-[var(--radius-md)] p-4"
          style={{ background: "var(--surface-secondary)" }}
        >
          <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-[var(--offer-accent)]" />
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
            This isn&apos;t a final approval. Our team will call and WhatsApp you to confirm the exact terms
            before anything is signed.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-blue text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
          >
            {isSubmitting ? "Submitting…" : "Yes, submit my request"}
            {!isSubmitting && <ArrowRight size={16} weight="bold" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-center text-sm text-[var(--text-tertiary)] transition-colors duration-200 hover:text-[var(--text-secondary)]"
          >
            Go back and adjust
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface LoanResultsProps {
  formData: FormData;
  monthlyRepayment: number;
  onAccept: () => void;
  /** Called instead of `onAccept` once a custom offer request has been submitted.
   *  Falls back to `onAccept` when not provided. */
  onCustomOfferSubmitted?: () => void;
  reminderItems?: string[];
  /** Originally requested amount. When greater than `formData.amount`, the header
   *  presents `formData.amount` as "available today" against this as the credit limit. */
  creditLimit?: number;
}

export function LoanResults({
  formData,
  onAccept,
  onCustomOfferSubmitted,
  creditLimit,
}: LoanResultsProps) {
  const [showModal, setShowModal] = useState(false);
  const { parts: expiryParts } = useCountdownParts();
  const isExpired = expiryParts.expired;

  const planHintRef = useRef<HTMLDivElement>(null);

  const [withdrawAmount, setWithdrawAmount] = useState(formData.amount);
  const plans = buildOfferPlans(withdrawAmount);
  const [selectedPlanId, setSelectedPlanId] = useState<OfferPlan["id"] | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [customTenure, setCustomTenure] = useState("");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const hasNoSelection = selectedPlanId === null;
  const isCustomSelected = selectedPlanId === "custom";
  const customAmountValue = parseInt(customAmount, 10);
  const customTenureValue = parseInt(customTenure, 10);
  const hasInvalidCustomInput =
    isCustomSelected &&
    (!Number.isFinite(customAmountValue) ||
      customAmountValue <= 0 ||
      !Number.isFinite(customTenureValue) ||
      customTenureValue <= 0);

  const getSelectedPlanPayload = useCallback(() => {
    if (selectedPlanId === null) return null;
    if (selectedPlanId === "custom") {
      if (hasInvalidCustomInput) return null;
      return {
        planId: "custom" as const,
        tenure: customTenureValue,
        amount: customAmountValue,
        monthlyRate: OFFER_MONTHLY_RATE,
        monthlyInstalment: Math.ceil(
          calculateInstalment(customAmountValue, customTenureValue, OFFER_MONTHLY_RATE),
        ),
      };
    }
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return null;
    return {
      planId: plan.id,
      tenure: plan.tenure,
      amount: withdrawAmount,
      monthlyRate: plan.monthlyRate,
      monthlyInstalment: plan.monthlyInstalment,
    };
  }, [selectedPlanId, withdrawAmount, plans, hasInvalidCustomInput, customAmountValue, customTenureValue]);

  const handleAccept = useCallback(async () => {
    trackEvent("step_10_offer_accepted", { planId: selectedPlanId });
    const payload = getSelectedPlanPayload();
    if (payload && formData.leadId) {
      setIsSavingPlan(true);
      try {
        await fetch("/api/apply/select-plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ leadId: formData.leadId, ...payload }),
        });
      } catch {
        // Graceful fallback - booking proceeds regardless
      } finally {
        setIsSavingPlan(false);
      }
    }
    onAccept();
  }, [selectedPlanId, getSelectedPlanPayload, formData.leadId, onAccept]);

  /** "Review Offer" opens a confirm-and-explain modal for custom requests instead of accepting immediately. */
  const handleReviewOfferClick = useCallback(() => {
    if (isCustomSelected) {
      setIsCustomModalOpen(true);
      return;
    }
    void handleAccept();
  }, [isCustomSelected, handleAccept]);

  const handleCustomOfferSubmit = useCallback(async () => {
    trackEvent("step_10_offer_accepted", { planId: "custom" });
    const payload = getSelectedPlanPayload();
    if (payload && formData.leadId) {
      setIsSubmittingCustom(true);
      try {
        await fetch("/api/apply/select-plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ leadId: formData.leadId, ...payload }),
        });
      } catch {
        // Graceful fallback - the customer still lands on the confirmation screen
      } finally {
        setIsSubmittingCustom(false);
      }
    }
    setIsCustomModalOpen(false);
    (onCustomOfferSubmitted ?? onAccept)();
  }, [getSelectedPlanPayload, formData.leadId, onCustomOfferSubmitted, onAccept]);

  const footerHint = hasNoSelection
    ? "Select a repayment plan to continue"
    : isCustomSelected && hasInvalidCustomInput
      ? "Enter a loan amount and tenure for your custom offer."
      : null;

  return (
    <>
      <div className="flex-1 px-5 pb-8">
      <div className="relative z-[1] flex flex-col gap-5">

        {/* Expiry notice only. The confirmed-offer heading lives in the page
            shell at every breakpoint, so repeating it here would double it up. */}
        {isExpired && (
          <RevealOnScroll className="flex flex-col gap-2">
            <h1
              className="text-[26px] font-bold leading-tight tracking-[-0.022em] sm:text-3xl"
              style={{ color: "#7f1d1d" }}
            >
              Your offer has expired.
            </h1>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              This loan offer is no longer valid. Start a new application to get a fresh offer.
            </p>
          </RevealOnScroll>
        )}

        {/* Confirmed offer header */}
        <div style={isExpired ? { opacity: 0.5, filter: "grayscale(0.4)", pointerEvents: "none" } : undefined}>
          <OfferHeader
            formData={formData}
            creditLimit={creditLimit}
            withdrawAmount={withdrawAmount}
            onWithdrawAmountChange={setWithdrawAmount}
          />
        </div>

        {/* Plan picker — its own section, with the intro copy that used to live
            in the hero now anchoring this section instead of a divider banner. */}
        {!isExpired && (
          <div className="flex flex-col gap-2 sm:gap-5">
            <RevealOnScroll>
            <div ref={planHintRef} className="flex flex-col gap-2.5 sm:gap-3">
              <div
                aria-hidden="true"
                className="h-px w-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, var(--border-medium) 12%, var(--border-medium) 88%, transparent 100%)",
                }}
              />
              <div className="flex flex-col gap-1">
                <h2
                  className="font-display text-xl sm:text-2xl font-semibold leading-tight tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  Choose your repayment plan
                </h2>
                <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Tap a plan to see the rate, fees and total repayable.
                </p>
              </div>
            </div>
            </RevealOnScroll>
            <PlanPicker
              selectedPlanId={selectedPlanId}
              onPlanSelect={setSelectedPlanId}
              plans={plans}
              customAmount={customAmount}
              customTenure={customTenure}
              onCustomAmountChange={setCustomAmount}
              onCustomTenureChange={setCustomTenure}
            />
          </div>
        )}

        {/* Offer validity disclaimer */}
        <RevealOnScroll>
        <p
          className="text-[11px] leading-relaxed"
          style={{ color: "var(--text-secondary)", position: "relative", zIndex: 1, textAlign: "center" }}
        >
          {OFFER_CONFIRMATION_DISCLAIMER}
        </p>
        </RevealOnScroll>

      </div>
      </div>

      <StickyFooter>
        {footerHint && (
          <p className="mb-2 text-center text-[13px] text-[var(--text-secondary)]">
            {footerHint}
          </p>
        )}
        {isExpired ? (
          <PrimaryButton onClick={() => { window.location.href = "/"; }}>
            Start a New Application
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={handleReviewOfferClick}
            disabled={hasNoSelection || hasInvalidCustomInput || isSavingPlan}
          >
            {isSavingPlan ? "Saving plan…" : "Review Offer"}
          </PrimaryButton>
        )}
      </StickyFooter>

      {showModal && (
        <ReconsiderModal
          onAccept={handleAccept}
          onClose={() => setShowModal(false)}
          leadId={formData.leadId ?? undefined}
        />
      )}

      {isCustomModalOpen && (
        <CustomOfferConfirmModal
          amount={customAmountValue}
          tenure={customTenureValue}
          isSubmitting={isSubmittingCustom}
          onConfirm={handleCustomOfferSubmit}
          onClose={() => setIsCustomModalOpen(false)}
        />
      )}
    </>
  );
}
