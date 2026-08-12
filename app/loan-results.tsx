"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Warning,
  Clock,
  ArrowLeft,
  X,
  TrendUp,
  CheckCircle,
  SealCheck,
  Lock,
  PencilSimple,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import { trackEvent } from "@/lib/analytics";
import {
  buildOfferPlans,
  calculateInstalment,
  OFFER_CONFIRMATION_DISCLAIMER,
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

// ── Deadline strip (airport flip-clock) ──────────────────────────────────────

const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const FLIP_TILE_W = 34;
const FLIP_TILE_H = 30;
const FLIP_DURATION_MS = 250;

const flipDigitStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  height: "200%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "0.02em",
  color: "#ffffff",
  fontVariantNumeric: "tabular-nums",
};

function FlipHalf({
  pos,
  text,
  style,
}: {
  pos: "top" | "bottom";
  text: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: pos === "top" ? 0 : "50%",
        height: "50%",
        overflow: "hidden",
        background: pos === "top" ? "#1a1a1e" : "#0e0e11",
        borderRadius: pos === "top" ? "4px 4px 0 0" : "0 0 4px 4px",
        backfaceVisibility: "hidden",
        ...style,
      }}
    >
      <span style={{ ...flipDigitStyle, top: pos === "top" ? 0 : "-100%" }}>{text}</span>
    </div>
  );
}

function FlipTile({ value, label, labelColor }: { value: number; label: string; labelColor: string }) {
  const display = String(value).padStart(2, "0");
  const [shown, setShown] = useState(display);
  const isFlipping = display !== shown;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        style={{
          position: "relative",
          width: FLIP_TILE_W,
          height: FLIP_TILE_H,
          perspective: 240,
          boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          borderRadius: 4,
        }}
      >
        <FlipHalf pos="top" text={isFlipping ? display : shown} />
        <FlipHalf pos="bottom" text={shown} />

        {isFlipping && (
          <>
            <FlipHalf
              key={`t-${display}`}
              pos="top"
              text={shown}
              style={{
                zIndex: 2,
                transformOrigin: "50% 100%",
                animation: `flip-top-down ${FLIP_DURATION_MS}ms ease-in both`,
              }}
            />
            <div
              key={`b-${display}`}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                transformOrigin: "50% 50%",
              }}
              onAnimationEnd={() => setShown(display)}
            >
              <FlipHalf
                pos="bottom"
                text={display}
                style={{
                  transformOrigin: "50% 0%",
                  animation: `flip-bottom-up ${FLIP_DURATION_MS}ms ${FLIP_DURATION_MS}ms ease-out both`,
                }}
              />
            </div>
          </>
        )}

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 1,
            background: "rgba(255,255,255,0.14)",
            zIndex: 3,
            transform: "translateY(-0.5px)",
          }}
        />
      </div>
      <span
        className="text-[9px] font-semibold tracking-wider uppercase leading-none"
        style={{ color: labelColor }}
      >
        {label}
      </span>
    </div>
  );
}

function DeadlineStrip() {
  const { parts, expiry } = useCountdownParts();

  const h = expiry.getHours();
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h >= 12 ? "PM" : "AM";
  const expiryDate = `${expiry.getDate()} ${FULL_MONTHS[expiry.getMonth()].slice(0, 3)} ${expiry.getFullYear()}`;
  const expiryTime = `${hour12}:${String(expiry.getMinutes()).padStart(2, "0")} ${ampm}`;

  const remainingMs = parts.expired ? 0 : (
    (parts.days * 86400 + parts.hrs * 3600 + parts.mins * 60 + parts.secs) * 1000
  );
  const totalWindowMs = 3 * 24 * 60 * 60 * 1000;
  const progress = Math.max(0, Math.min(1, remainingMs / totalWindowMs));

  const isUrgent = parts.days < 1 && !parts.expired;

  const scheme = isUrgent
    ? {
        bg: "oklch(0.96 0.03 25)",
        border: "oklch(0.85 0.06 25)",
        leftBar: "#dc2626",
        labelColor: "#7f1d1d",
        dateColor: "#450a0a",
        unitColor: "#991b1b",
        trackBg: "oklch(0.90 0.04 25)",
        barGradient: "linear-gradient(to right, #dc2626, #f97316)",
      }
    : {
        bg: "oklch(0.97 0.03 85)",
        border: "oklch(0.88 0.06 85)",
        leftBar: "#f59e0b",
        labelColor: "#78350f",
        dateColor: "var(--text-primary)",
        unitColor: "#92400e",
        trackBg: "oklch(0.92 0.04 85)",
        barGradient: "linear-gradient(to right, #f59e0b, #fbbf24)",
      };

  if (parts.expired) {
    return (
      <div
        className="w-full rounded-[var(--radius-md)] overflow-hidden flex"
        style={{
          background: "oklch(0.96 0.03 25)",
          boxShadow: "0 0 0 1px oklch(0.85 0.06 25)",
        }}
      >
        <div className="w-1 shrink-0 self-stretch" style={{ background: "#dc2626" }} aria-hidden="true" />

        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-start gap-3 px-4 py-3.5">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "oklch(0.91 0.05 25)" }}
            >
              <Warning size={17} weight="duotone" style={{ color: "#dc2626" }} />
            </span>

            <div className="flex flex-col gap-1 min-w-0">
              <p
                className="text-sm font-bold leading-snug"
                style={{
                  fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                  color: "#450a0a",
                  letterSpacing: "-0.02em",
                }}
              >
                Offer expired
              </p>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "#7f1d1d" }}
              >
                Expired {expiryDate}, {expiryTime}. Submit a new application to receive a fresh offer.
              </p>
            </div>
          </div>

          <div
            className="h-[3px] w-full"
            style={{ background: "oklch(0.90 0.04 25)" }}
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-[var(--radius-md)] overflow-hidden flex"
      style={{
        background: scheme.bg,
        boxShadow: `0 0 0 1px ${scheme.border}`,
      }}
    >
      <div
        className="w-1 shrink-0 self-stretch"
        style={{ background: scheme.leftBar }}
        aria-hidden="true"
      />

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span
              className="text-[10px] font-bold tracking-[0.16em] uppercase"
              style={{ color: scheme.labelColor }}
            >
              Offer expires
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: scheme.dateColor }}
            >
              {expiryDate}, {expiryTime}
            </span>
          </div>

          <div className="flex items-start gap-1">
            {[
              { value: parts.days, label: "d" },
              { value: parts.hrs, label: "h" },
              { value: parts.mins, label: "m" },
              { value: parts.secs, label: "s" },
            ].map(({ value, label }, i) => (
              <div key={label} className="flex items-start gap-1">
                {i > 0 && (
                  <span
                    className="text-[10px] font-bold"
                    style={{
                      color: scheme.unitColor,
                      opacity: 0.5,
                      lineHeight: `${FLIP_TILE_H}px`,
                    }}
                  >
                    :
                  </span>
                )}
                <FlipTile value={value} label={label} labelColor={scheme.unitColor} />
              </div>
            ))}
          </div>
        </div>

        <div
          className="h-[3px] w-full"
          style={{ background: scheme.trackBg }}
          aria-hidden="true"
        >
          <div
            className="h-full transition-none"
            style={{
              width: `${(progress * 100).toFixed(2)}%`,
              background: scheme.barGradient,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Term-sheet confirmed offer card ───────────────────────────────────────────

interface OfferCardProps {
  formData: FormData;
  revealStage: number;
  creditLimit?: number;
  withdrawAmount: number;
  onWithdrawAmountChange: (amount: number) => void;
}

/** Segmented meter: filled = available today, striped = reserved for later. */
function CreditLineMeter({
  limit,
  available,
  revealStage,
}: {
  limit: number;
  available: number;
  revealStage: number;
}) {
  const pct = limit > 0 ? Math.max(0, Math.min(1, available / limit)) : 0;

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={available}
      aria-label={`${formatCurrency(available)} available to withdraw today out of a ${formatCurrency(limit)} credit line`}
      className="relative h-2.5 w-full overflow-hidden rounded-full"
      style={{
        background:
          "repeating-linear-gradient(135deg, oklch(0.55 0.03 260 / 0.14) 0px, oklch(0.55 0.03 260 / 0.14) 3px, transparent 3px, transparent 7px), var(--surface-secondary)",
        boxShadow: "inset 0 1px 2px oklch(0 0 0 / 0.08)",
      }}
    >
      <motion.div
        className="credit-meter-fill absolute inset-y-0 left-0 rounded-full"
        style={{
          background: "linear-gradient(90deg, var(--offer-accent) 0%, var(--brand-teal-hex) 100%)",
        }}
        initial={{ width: "0%" }}
        animate={{ width: revealStage >= 1 ? `${pct * 100}%` : "0%" }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
      />
    </div>
  );
}

function OfferHeader({
  formData,
  revealStage,
  creditLimit,
  withdrawAmount,
  onWithdrawAmountChange,
}: OfferCardProps) {
  const [preApprovedTipOpen, setPreApprovedTipOpen] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [amountRaw, setAmountRaw] = useState(String(withdrawAmount));
  const amountInputRef = useRef<HTMLInputElement>(null);

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

  const commitAmount = (raw: number) => {
    const clamped = clampWithdrawAmount(raw, maxWithdraw);
    onWithdrawAmountChange(clamped);
    setAmountRaw(String(clamped));
  };

  const focusAmountInput = () => {
    if (!canAdjust) return;
    amountInputRef.current?.focus();
    amountInputRef.current?.select();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={revealStage >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-1.5 py-2 text-center"
    >
      {/* Credit line summary card — status, limit, and (if applicable) the
          available/reserved meter all live in one bordered, tinted object so
          this context reads as a distinct "status card" rather than loose text. */}
      <div
        className="w-full rounded-[var(--radius-lg)] px-4 py-3.5 text-left"
        style={{
          background: "oklch(0.96 0.025 176 / 0.4)",
          border: "1px solid oklch(0.72 0.08 176 / 0.35)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 pt-0.5">
            <SealCheck size={16} weight="fill" className="shrink-0" style={{ color: "var(--offer-accent)" }} />
            <span
              className="inline-flex min-w-0 flex-col items-start gap-0.5 text-[12px] font-bold tracking-[0.08em] uppercase sm:flex-row sm:items-center sm:gap-1"
              style={{ color: "var(--text-primary)" }}
            >
              <span className="whitespace-nowrap">Credit line</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                pre-approved
                <span className="relative inline-flex shrink-0 normal-case tracking-normal">
                  <button
                    type="button"
                    aria-label="What does pre-approved mean?"
                    aria-expanded={preApprovedTipOpen}
                    onClick={() => setPreApprovedTipOpen((v) => !v)}
                    onMouseEnter={() => setPreApprovedTipOpen(true)}
                    onMouseLeave={() => setPreApprovedTipOpen(false)}
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[9px] font-bold leading-none transition-colors duration-150"
                    style={{
                      borderColor: "var(--border-medium)",
                      color: "var(--text-tertiary)",
                      background: "var(--surface-primary)",
                    }}
                  >
                    ?
                  </button>
                  {preApprovedTipOpen && (
                    <div
                      role="tooltip"
                      className="absolute left-1/2 top-[calc(100%+8px)] z-50 w-[min(260px,70vw)] -translate-x-1/2 whitespace-normal rounded-[var(--radius-md)] px-3 py-2.5 text-left shadow-lg"
                      style={{
                        background: "var(--surface-elevated)",
                        boxShadow: "0 0 0 1px var(--border-subtle), 0 8px 24px oklch(0.24 0.06 260 / 0.12)",
                      }}
                    >
                      <p
                        className="text-[12px] font-medium leading-relaxed normal-case tracking-normal"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {hasStructuralReserve ? (
                          <>
                            Pre-approved means your full credit limit looks like a strong fit for you.
                            For now, you&apos;re ready to take up to{" "}
                            <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                              {formatCurrency(maxWithdraw)}
                            </span>{" "}
                            today — the rest of your line is reserved and unlocks automatically over time.
                          </>
                        ) : (
                          <>
                            Pre-approved means this credit line is confirmed and ready. Your full{" "}
                            <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                              {formatCurrency(maxWithdraw)}
                            </span>{" "}
                            is approved and available for instant disbursement.
                          </>
                        )}
                      </p>
                      <span
                        aria-hidden="true"
                        className="absolute -top-1.5 left-1/2 -translate-x-1/2 border-4 border-transparent"
                        style={{ borderBottomColor: "var(--border-subtle)" }}
                      />
                    </div>
                  )}
                </span>
              </span>
            </span>
          </div>
          <div className="shrink-0 text-right leading-none">
            <div
              className="tabular-nums text-[1.35rem] font-semibold"
              style={{
                fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                letterSpacing: "-0.03em",
                color: "var(--text-primary)",
              }}
            >
              {formatCurrency(limit)}
            </div>
            <div className="mt-1 text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-tertiary)" }}>
              Total credit limit
            </div>
          </div>
        </div>

        {hasStructuralReserve && (
          <>
            <div className="mt-2.5">
              <CreditLineMeter limit={limit} available={maxWithdraw} revealStage={revealStage} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--brand-teal-hex)" }} />
                {formatCurrency(maxWithdraw)} available today
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold leading-none"
                style={{ background: "oklch(0.94 0.05 85)", color: "#78350f" }}
              >
                <Lock size={9} weight="fill" style={{ color: "#E0B000" }} />
                +{formatCurrency(structuralReserve)} unlocks over time
              </span>
            </div>
          </>
        )}
      </div>

      {/* Hero: withdraw-today amount — the number the user is actually acting on */}
      <div className="mt-3 flex flex-col items-center gap-1.5">
        <span
          className="text-[12px] font-bold tracking-[0.16em] uppercase"
          style={{ color: "var(--text-primary)" }}
        >
          Withdraw today
        </span>

        {/* Amount stays optically centred under the label; pencil is docked to
            the right of the $amount group so it doesn't shove the figure off-centre. */}
        <div className="flex justify-center">
          <div className="relative flex items-baseline leading-none">
            <span
              aria-hidden="true"
              style={{
                fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                fontSize: "clamp(2.8rem, 11vw, 3.75rem)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--brand-blue-hex)",
              }}
            >
              $
            </span>
            <input
              ref={amountInputRef}
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
              className="tabular-nums border-0 bg-transparent text-center outline-none disabled:opacity-100"
              style={{
                fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                fontSize: "clamp(2.8rem, 11vw, 3.75rem)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--brand-blue-hex)",
                caretColor: "var(--offer-accent)",
                fieldSizing: "content",
                width: "auto",
                minWidth: "2ch",
              }}
            />
            {canAdjust && (
              <button
                type="button"
                onClick={focusAmountInput}
                aria-label="Edit withdrawal amount"
                className="absolute top-1/2 left-[calc(100%+0.35rem)] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors duration-150"
                style={{
                  background: amountFocused ? "oklch(0.9 0.07 176 / 0.45)" : "var(--surface-secondary)",
                  color: "var(--brand-blue-hex)",
                }}
              >
                <PencilSimple size={16} weight="bold" />
              </button>
            )}
          </div>
        </div>

        <span className="text-[12px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
          Instant disbursement
        </span>
      </div>

      {/* Amount adjuster — standard range control; defaults to the maximum available today */}
      {canAdjust && (
        <div className="mt-4 w-full">
          <input
            type="range"
            className="withdraw-slider w-full"
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
            style={{
              background: `linear-gradient(to right, var(--brand-teal-hex) 0%, var(--brand-teal-hex) ${sliderPct}%, var(--border-medium) ${sliderPct}%, var(--border-medium) 100%)`,
            }}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>
              {formatCurrency(minWithdraw)}
            </span>
            <button
              type="button"
              onClick={() => commitAmount(maxWithdraw)}
              disabled={isAtMax}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none transition-colors duration-150 disabled:cursor-default"
              style={{
                background: isAtMax ? "var(--surface-secondary)" : "oklch(0.9 0.07 176 / 0.35)",
                color: isAtMax ? "var(--text-tertiary)" : "var(--offer-accent)",
              }}
            >
              {isAtMax ? "Max Amount" : `Use max · ${formatCurrency(maxWithdraw)}`}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Plan picker ───────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: OfferPlan;
  isSelected: boolean;
  onSelect: () => void;
}

/** Card labels are space-constrained in the 3-up grid, so drop the trailing "Plan" suffix. */
function shortPlanName(title: string): string {
  return title.replace(/\s+Plan$/i, "");
}

function PlanCard({ plan, isSelected, onSelect }: PlanCardProps) {
  const isPopular = Boolean(plan.badge);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex h-full w-full flex-col text-center transition-all duration-200 focus:outline-none"
      style={{
        transform: isSelected ? "scale(1.02)" : "scale(1)",
      }}
      aria-pressed={isSelected}
    >
      {/* Reserved ribbon slot - keeps blue headers aligned across all three cards */}
      <div className="flex h-5 w-full shrink-0 items-center justify-center">
        {isPopular && (
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
        )}
      </div>

      <div
        className="relative flex w-full flex-1 flex-col overflow-hidden"
        style={{
          borderRadius: isPopular ? "0 0 6px 6px" : "6px",
          background: "var(--surface-elevated)",
          boxShadow: isSelected
            ? "0 0 0 3px var(--brand-blue-hex, #0033AA), 0 8px 24px oklch(0.32 0.14 260 / 0.12)"
            : "0 0 0 1px var(--border-subtle), 0 4px 16px oklch(0.24 0.06 260 / 0.08), 0 1px 3px oklch(0.24 0.06 260 / 0.06)",
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

            {/* Fixed row heights keep feature N aligned across cards; first row
                sized for 3-line wraps on narrow 3-col mobile (~70px text). */}
            <ul className="grid w-full grid-rows-[3.75rem_1.125rem] gap-2 text-left sm:grid-rows-[3.5rem_1.25rem] sm:gap-3">
              {[
                plan.tagline,
                `${formatRate(plan.monthlyRate)}/month`,
              ].map((feature) => (
                <li key={feature} className="flex min-h-0 items-start overflow-hidden">
                  <span className="flex min-w-0 items-start gap-1 sm:gap-1.5">
                    <CheckCircle
                      size={14}
                      weight="fill"
                      className="mt-0.5 shrink-0"
                      style={{ color: "#22c55e" }}
                    />
                    <motion.span
                      key={feature}
                      initial={{ opacity: 0.3 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="min-w-0 text-[11px] font-semibold leading-snug sm:text-[13px]"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {feature}
                    </motion.span>
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
                color: "var(--text-secondary)",
                border: "1.5px solid var(--border-medium)",
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
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3 items-stretch">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isSelected={selectedPlanId === plan.id}
            onSelect={() => onPlanSelect(plan.id)}
          />
        ))}
      </div>
      <CustomOfferCard
        isSelected={selectedPlanId === "custom"}
        onSelect={() => onPlanSelect("custom")}
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

const EASE = [0.16, 1, 0.3, 1] as const;

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

  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaButtonRef = useRef<HTMLButtonElement>(null);
  const planHintRef = useRef<HTMLDivElement>(null);
  const [isCtaVisible, setIsCtaVisible] = useState(false);

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

  useEffect(() => {
    const el = ctaButtonRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsCtaVisible(entry.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px -80px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** Sticky CTA: nudge to plan picker if nothing selected; otherwise scroll to the bottom CTA. */
  const scrollToStickyTarget = useCallback(() => {
    const el = hasNoSelection ? planHintRef.current : ctaRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: hasNoSelection ? "start" : "center" });
  }, [hasNoSelection]);

  const [revealStage, setRevealStage] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setRevealStage(1), 300);
    const t2 = setTimeout(() => setRevealStage(2), 800);
    const t3 = setTimeout(() => setRevealStage(3), 1200);
    const t4 = setTimeout(() => setRevealStage(4), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

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

  return (
    <>
      <div className="relative z-[1] flex flex-col gap-5">

        {/* Heading - hidden on mobile when not expired, since the parent page
            shows the equivalent heading in its blue hero band instead. The
            expiry warning always renders here (mobile included) since it's
            dynamic and can't live in the static hero. */}
        <motion.div
          className={isExpired ? "flex flex-col gap-2" : "hidden flex-col gap-2 lg:flex"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <h1
            className="font-display text-[26px] sm:text-3xl font-semibold leading-tight tracking-tight"
            style={{ color: isExpired ? "#7f1d1d" : "var(--text-primary)" }}
          >
            {isExpired ? "Your offer has expired." : "Your loan offer is confirmed."}
          </h1>
          {isExpired && (
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              This loan offer is no longer valid. Start a new application to get a fresh offer.
            </p>
          )}
        </motion.div>

        {/* Confirmed offer header */}
        <div style={isExpired ? { opacity: 0.5, filter: "grayscale(0.4)", pointerEvents: "none" } : undefined}>
          <OfferHeader
            formData={formData}
            revealStage={revealStage}
            creditLimit={creditLimit}
            withdrawAmount={withdrawAmount}
            onWithdrawAmountChange={setWithdrawAmount}
          />
        </div>

        {/* Plan picker — its own section, with the intro copy that used to live
            in the hero now anchoring this section instead of a divider banner. */}
        {!isExpired && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={revealStage >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.45, ease: EASE }}
            style={{ pointerEvents: revealStage >= 2 ? "auto" : "none" }}
            className="flex flex-col gap-2 sm:gap-5"
          >
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
                  Pick from our 3 best-selling plans for your loan.
                </p>
              </div>
            </div>
            <PlanPicker
              selectedPlanId={selectedPlanId}
              onPlanSelect={setSelectedPlanId}
              plans={plans}
              customAmount={customAmount}
              customTenure={customTenure}
              onCustomAmountChange={setCustomAmount}
              onCustomTenureChange={setCustomTenure}
            />
          </motion.div>
        )}

        {/* Deadline strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={revealStage >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.45, ease: EASE }}
          style={{ position: "relative", zIndex: 1 }}
        >
          <DeadlineStrip />
        </motion.div>

        {/* Offer validity disclaimer */}
        <motion.p
          className="text-[11px] leading-relaxed -mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: revealStage >= 3 ? 1 : 0 }}
          transition={{ duration: 0.4, delay: revealStage >= 3 ? 0.2 : 0 }}
          style={{ color: "var(--text-secondary)", position: "relative", zIndex: 1, textAlign: "center" }}
        >
          {OFFER_CONFIRMATION_DISCLAIMER}
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          ref={ctaRef}
          className="flex flex-col gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={revealStage >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.45, ease: EASE }}
          style={{ pointerEvents: revealStage >= 4 ? "auto" : "none" }}
        >
          {isExpired ? (
            <a
              ref={ctaButtonRef as unknown as React.RefObject<HTMLAnchorElement>}
              href="/"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-blue text-[15px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            >
              Start a New Application
              <ArrowRight size={16} weight="bold" />
            </a>
          ) : (
            <>
              <button
                ref={ctaButtonRef}
                type="button"
                onClick={handleReviewOfferClick}
                disabled={hasNoSelection || hasInvalidCustomInput || isSavingPlan}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-blue text-[15px] font-semibold text-[var(--text-on-brand)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                {isSavingPlan ? "Saving plan…" : "Review Offer"}
                {!isSavingPlan && <ArrowRight size={16} weight="bold" />}
              </button>
              {hasNoSelection && (
                <p className="text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  Select a repayment plan above to continue.
                </p>
              )}
              {isCustomSelected && hasInvalidCustomInput && (
                <p className="text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  Enter a loan amount and tenure for your custom offer.
                </p>
              )}
              {/* Temporarily hidden — restore to re-enable the reconsider modal entry point.
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="text-center text-sm text-[var(--text-tertiary)] transition-colors duration-200 hover:text-[var(--text-secondary)]"
              >
                I need to think about it
              </button>
              */}
            </>
          )}
        </motion.div>
      </div>

      {/* Temporarily hidden — floating sticky Review Offer CTA on mobile.
      {revealStage >= 4 && !isCtaVisible && (
        <div
          className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
          style={{ animation: "fade-up 0.4s cubic-bezier(0.16,1,0.3,1) 850ms both" }}
        >
          {isExpired ? (
            <a
              href="/"
              className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-blue px-10 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:brightness-110 active:scale-[0.98] whitespace-nowrap"
            >
              Start New Application
              <ArrowDown size={16} weight="bold" />
            </a>
          ) : (
            <button
              type="button"
              onClick={scrollToStickyTarget}
              className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-teal px-12 text-sm font-semibold text-[var(--text-primary)] shadow-lg shadow-brand-teal/30 transition-all duration-200 hover:brightness-110 active:scale-[0.98] whitespace-nowrap"
            >
              Review Offer
              {hasNoSelection ? (
                <ArrowUp size={16} weight="bold" />
              ) : (
                <ArrowDown size={16} weight="bold" />
              )}
            </button>
          )}
        </div>
      )}
      */}

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
