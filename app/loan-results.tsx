"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowRight,
  ArrowDown,
  Warning,
  Clock,
  ArrowLeft,
  X,
  TrendUp,
  CheckCircle,
  Sparkle,
  SealCheck,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import { trackEvent } from "@/lib/analytics";
import {
  buildOfferPlans,
  calculateInstalment,
  OFFER_MONTHLY_RATE,
  MAX_OFFER_TENURE,
  MIN_OFFER_TENURE,
  OFFER_CONFIRMATION_DISCLAIMER,
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
}

function OfferHeader({ formData, revealStage }: OfferCardProps) {
  const today = new Date();
  const dateLabel = `${today.getDate()} ${FULL_MONTHS[today.getMonth()].slice(0, 3)} ${today.getFullYear()}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={revealStage >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-1.5 py-2 text-center"
    >
      <div className="flex items-center gap-2">
        <SealCheck size={18} weight="fill" style={{ color: "#06DEC0" }} />
        <span
          className="text-[11px] font-bold tracking-[0.18em] uppercase"
          style={{ color: "var(--text-tertiary)" }}
        >
          Loan offer confirmed · {dateLabel}
        </span>
      </div>

      <p
        className="tabular-nums leading-none"
        style={{
          fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
          fontSize: "clamp(2.8rem, 11vw, 3.75rem)",
          fontWeight: 800,
          letterSpacing: "-0.04em",
          background: "linear-gradient(120deg, oklch(0.32 0.16 262) 20%, oklch(0.55 0.13 190) 80%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {formatCurrency(formData.amount)}
      </p>

      <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        Approved and ready for disbursement
      </p>

      {/* Divider with centred hint */}
      <div className="mt-3 flex w-full items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
        <span className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "var(--text-tertiary)" }}>
          Now pick your plan
        </span>
        <span className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
      </div>
    </motion.div>
  );
}

// ── Plan picker ───────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: OfferPlan;
  isSelected: boolean;
  onSelect: () => void;
}

function PlanCard({ plan, isSelected, onSelect }: PlanCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative w-full text-left rounded-[var(--radius-lg)] overflow-hidden transition-all duration-200 focus:outline-none"
      style={{
        background: isSelected
          ? `radial-gradient(ellipse at 20% 50%, oklch(0.34 0.18 262) 0%, transparent 70%), linear-gradient(145deg, oklch(0.28 0.16 262) 0%, oklch(0.22 0.16 258) 100%)`
          : "var(--surface-elevated)",
        boxShadow: isSelected
          ? "0 0 0 2px #06DEC0, 0 12px 40px oklch(0.24 0.18 258 / 0.35), inset 0 1px 0 oklch(1 0 0 / 0.10)"
          : "0 0 0 1px var(--border-subtle), 0 4px 16px oklch(0.24 0.06 260 / 0.08), 0 1px 3px oklch(0.24 0.06 260 / 0.06)",
        transform: isSelected ? "scale(1.01)" : "scale(1)",
      }}
      aria-pressed={isSelected}
    >
      {/* Shine sweep on selected */}
      {isSelected && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(105deg, transparent 35%, oklch(1 0 0 / 0.04) 50%, transparent 65%)",
          }}
        />
      )}

      <div className="relative p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-lg font-bold leading-snug"
                style={{
                  fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                  color: isSelected ? "#ffffff" : "var(--text-primary)",
                  letterSpacing: "-0.02em",
                }}
              >
                {plan.title}
              </span>
              {plan.badge && (
                <span
                  className="popular-badge-glow inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide shrink-0"
                  style={{
                    background: "#F5C518",
                    color: "#0a1628",
                  }}
                >
                  <Sparkle size={10} weight="fill" className="relative z-[1]" />
                  <span className="relative z-[1]">Most Popular</span>
                </span>
              )}
            </div>
            <span
              className="text-xs font-medium leading-snug"
              style={{ color: isSelected ? "oklch(1 0 0 / 0.55)" : "var(--text-tertiary)" }}
            >
              {plan.tagline}
            </span>
          </div>

          <span
            className="flex h-7 w-7 items-center justify-center rounded-full shrink-0 transition-all duration-200"
            style={{
              border: isSelected ? "2px solid #06DEC0" : "2px solid var(--text-tertiary)",
              background: isSelected ? "#06DEC0" : "var(--surface-elevated)",
              boxShadow: isSelected
                ? "0 0 0 4px oklch(0.78 0.16 178 / 0.25)"
                : "inset 0 1px 2px oklch(0 0 0 / 0.06)",
            }}
            aria-hidden="true"
          >
            {isSelected && <CheckCircle size={16} weight="fill" style={{ color: "#0a1628" }} />}
          </span>
        </div>

        {/* Stats row — interest paid and tenure stack on the left, monthly instalment anchors the right */}
        <div
          className="flex items-stretch gap-3 rounded-[var(--radius-sm)] px-3 py-2.5"
          style={{
            background: isSelected ? "oklch(1 0 0 / 0.06)" : "var(--surface-secondary)",
          }}
        >
          <div className="flex flex-col justify-center gap-2 flex-1 min-w-0">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold tracking-[0.12em] uppercase" style={{ color: isSelected ? "oklch(1 0 0 / 0.45)" : "var(--text-tertiary)" }}>
                Interest paid
              </span>
              <span
                className="text-xl font-extrabold tabular-nums leading-none"
                style={{
                  fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                  color: isSelected ? "#ffffff" : "var(--text-primary)",
                  letterSpacing: "-0.03em",
                }}
              >
                {formatCurrency(plan.totalInterest)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold tracking-[0.12em] uppercase" style={{ color: isSelected ? "oklch(1 0 0 / 0.45)" : "var(--text-tertiary)" }}>
                Tenure
              </span>
              <span
                className="text-xl font-extrabold tabular-nums leading-none"
                style={{
                  fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                  color: isSelected ? "#ffffff" : "var(--text-primary)",
                  letterSpacing: "-0.03em",
                }}
              >
                {plan.tenure} {plan.tenure === 1 ? "month" : "months"}
              </span>
            </div>
          </div>

          <div
            className="w-px self-stretch shrink-0"
            style={{ background: isSelected ? "oklch(1 0 0 / 0.12)" : "var(--border-subtle)" }}
            aria-hidden="true"
          />

          <div className="flex flex-col items-end text-right justify-center gap-0.5 flex-[1.2] min-w-0">
            <span className="text-[9px] font-semibold tracking-[0.12em] uppercase" style={{ color: isSelected ? "oklch(1 0 0 / 0.55)" : "var(--text-tertiary)" }}>
              Monthly instalment
            </span>
            <span
              className="text-xl font-extrabold tabular-nums leading-none"
              style={{
                fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                color: isSelected ? "#06DEC0" : "var(--text-primary)",
                letterSpacing: "-0.03em",
              }}
            >
              {formatCurrency(plan.monthlyInstalment)}
            </span>
          </div>
        </div>

        {/* Rate caption */}
        <p
          className="mt-2 text-[10px]"
          style={{ color: isSelected ? "oklch(1 0 0 / 0.35)" : "var(--text-tertiary)" }}
        >
          {formatRate(plan.monthlyRate)}/month · Total repayment {formatCurrency(plan.totalRepayment)}
        </p>
      </div>
    </button>
  );
}

interface CustomPlanState {
  amount: string;
  tenure: string;
}

interface CustomPlanCardProps {
  isSelected: boolean;
  onSelect: () => void;
  approvedAmount: number;
  customPlan: CustomPlanState;
  onCustomPlanChange: (v: CustomPlanState) => void;
}

function CustomPlanCard({ isSelected, onSelect, approvedAmount, customPlan, onCustomPlanChange }: CustomPlanCardProps) {
  const amountNum = parseFloat(customPlan.amount.replace(/[^0-9.]/g, "")) || 0;
  const tenureNum = parseInt(customPlan.tenure, 10) || 0;

  const amountError =
    customPlan.amount && (amountNum < 500 || amountNum > approvedAmount)
      ? amountNum < 500
        ? "Minimum $500"
        : `Maximum ${formatCurrency(approvedAmount)}`
      : null;

  const tenureError =
    customPlan.tenure && (tenureNum < MIN_OFFER_TENURE || tenureNum > MAX_OFFER_TENURE)
      ? `Between ${MIN_OFFER_TENURE}–${MAX_OFFER_TENURE} months`
      : null;

  const previewInstalment =
    amountNum >= 500 && amountNum <= approvedAmount && tenureNum >= MIN_OFFER_TENURE && tenureNum <= MAX_OFFER_TENURE
      ? Math.ceil(calculateInstalment(amountNum, tenureNum, OFFER_MONTHLY_RATE))
      : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative w-full text-left rounded-[var(--radius-lg)] overflow-hidden transition-all duration-200 focus:outline-none"
      style={{
        background: "var(--surface-elevated)",
        boxShadow: isSelected
          ? "0 0 0 2px oklch(0.78 0.16 178 / 0.50), 0 8px 24px oklch(0.24 0.18 258 / 0.18)"
          : "0 0 0 1px var(--border-subtle), 0 4px 16px oklch(0.24 0.06 260 / 0.08), 0 1px 3px oklch(0.24 0.06 260 / 0.06)",
      }}
      aria-pressed={isSelected}
    >
      <div className="relative p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full shrink-0 transition-all duration-200"
              style={{
                border: isSelected ? "2px solid #06DEC0" : "2px solid var(--text-tertiary)",
                background: isSelected ? "#06DEC0" : "var(--surface-elevated)",
                boxShadow: isSelected
                  ? "0 0 0 4px oklch(0.78 0.16 178 / 0.25)"
                  : "inset 0 1px 2px oklch(0 0 0 / 0.06)",
              }}
              aria-hidden="true"
            >
              {isSelected && <CheckCircle size={16} weight="fill" style={{ color: "#0a1628" }} />}
            </span>
            <span className="text-sm font-bold" style={{ fontFamily: "var(--font-inter-tight), system-ui, sans-serif", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Request a custom plan
            </span>
          </div>
          <span className="text-[10px] font-medium rounded-full px-2 py-0.5" style={{ background: "var(--surface-secondary)", color: "var(--text-tertiary)" }}>
            3.92%/mo
          </span>
        </div>

        {isSelected && (
          <div
            className="flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-semibold tracking-[0.12em] uppercase" style={{ color: "var(--text-tertiary)" }}>
                  Loan amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "var(--text-tertiary)" }}>$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={500}
                    max={approvedAmount}
                    value={customPlan.amount}
                    onChange={(e) => onCustomPlanChange({ ...customPlan, amount: e.target.value })}
                    placeholder="e.g. 3000"
                    className="w-full rounded-[var(--radius-sm)] pl-6 pr-3 py-2.5 text-sm font-semibold tabular-nums outline-none transition-colors duration-150"
                    style={{
                      background: "var(--surface-secondary)",
                      border: `1px solid ${amountError ? "#dc2626" : "var(--border-subtle)"}`,
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                {amountError && <span className="text-[10px]" style={{ color: "#dc2626" }}>{amountError}</span>}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-semibold tracking-[0.12em] uppercase" style={{ color: "var(--text-tertiary)" }}>
                  Tenure (months)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_OFFER_TENURE}
                  max={MAX_OFFER_TENURE}
                  value={customPlan.tenure}
                  onChange={(e) => onCustomPlanChange({ ...customPlan, tenure: e.target.value })}
                  placeholder="1–12"
                  className="w-full rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-semibold tabular-nums outline-none transition-colors duration-150"
                  style={{
                    background: "var(--surface-secondary)",
                    border: `1px solid ${tenureError ? "#dc2626" : "var(--border-subtle)"}`,
                    color: "var(--text-primary)",
                  }}
                />
                {tenureError && <span className="text-[10px]" style={{ color: "#dc2626" }}>{tenureError}</span>}
              </div>
            </div>

            {previewInstalment !== null && (
              <div
                className="flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2.5"
                style={{ background: "oklch(0.32 0.14 260 / 0.07)", border: "1px solid oklch(0.32 0.14 260 / 0.12)" }}
              >
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Estimated monthly instalment</span>
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ fontFamily: "var(--font-inter-tight), system-ui, sans-serif", color: "var(--text-primary)", letterSpacing: "-0.02em" }}
                >
                  {formatCurrency(previewInstalment)}/mo
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

interface PlanPickerProps {
  approvedAmount: number;
  selectedPlanId: OfferPlan["id"] | "custom" | null;
  onPlanSelect: (id: OfferPlan["id"] | "custom") => void;
  customPlan: CustomPlanState;
  onCustomPlanChange: (v: CustomPlanState) => void;
  plans: OfferPlan[];
}

function PlanPicker({ approvedAmount, selectedPlanId, onPlanSelect, customPlan, onCustomPlanChange, plans }: PlanPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          isSelected={selectedPlanId === plan.id}
          onSelect={() => onPlanSelect(plan.id)}
        />
      ))}
      <CustomPlanCard
        isSelected={selectedPlanId === "custom"}
        onSelect={() => onPlanSelect("custom")}
        approvedAmount={approvedAmount}
        customPlan={customPlan}
        onCustomPlanChange={onCustomPlanChange}
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

  // suppress unused warning — selectedReason is set for tracking purposes
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
                onClick={onAccept}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-teal text-sm font-semibold text-[var(--text-primary)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              >
                <ArrowLeft size={16} weight="bold" />
                Accept the offer now
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
              <p
                className="text-2xl font-black tracking-tight text-brand-blue"
                style={{ fontFamily: "var(--font-inter-tight), system-ui, sans-serif", letterSpacing: "-0.04em" }}
              >
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

const EASE = [0.16, 1, 0.3, 1] as const;

// ── Main component ────────────────────────────────────────────────────────────

interface LoanResultsProps {
  formData: FormData;
  monthlyRepayment: number;
  onAccept: () => void;
  reminderItems?: string[];
}

export function LoanResults({
  formData,
  onAccept,
}: LoanResultsProps) {
  const [showModal, setShowModal] = useState(false);
  const { parts: expiryParts } = useCountdownParts();
  const isExpired = expiryParts.expired;

  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaButtonRef = useRef<HTMLButtonElement>(null);
  const [isCtaVisible, setIsCtaVisible] = useState(false);

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

  const scrollToCta = useCallback(() => {
    const el = ctaRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const [revealStage, setRevealStage] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setRevealStage(1), 300);
    const t2 = setTimeout(() => setRevealStage(2), 800);
    const t3 = setTimeout(() => setRevealStage(3), 1200);
    const t4 = setTimeout(() => setRevealStage(4), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const plans = buildOfferPlans(formData.amount);
  const [selectedPlanId, setSelectedPlanId] = useState<OfferPlan["id"] | "custom" | null>(null);
  const [customPlan, setCustomPlan] = useState<CustomPlanState>({ amount: "", tenure: "" });
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const getSelectedPlanPayload = useCallback(() => {
    if (selectedPlanId === null) return null;
    if (selectedPlanId === "custom") {
      const amountNum = parseFloat(customPlan.amount.replace(/[^0-9.]/g, "")) || 0;
      const tenureNum = parseInt(customPlan.tenure, 10) || 0;
      const isValid = amountNum >= 500 && amountNum <= formData.amount && tenureNum >= MIN_OFFER_TENURE && tenureNum <= MAX_OFFER_TENURE;
      if (!isValid) return null;
      return {
        planId: "custom" as const,
        tenure: tenureNum,
        amount: amountNum,
        monthlyRate: OFFER_MONTHLY_RATE,
        monthlyInstalment: Math.ceil(calculateInstalment(amountNum, tenureNum, OFFER_MONTHLY_RATE)),
      };
    }
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return null;
    return {
      planId: plan.id,
      tenure: plan.tenure,
      amount: formData.amount,
      monthlyRate: plan.monthlyRate,
      monthlyInstalment: plan.monthlyInstalment,
    };
  }, [selectedPlanId, customPlan, formData.amount, plans]);

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
        // Graceful fallback — booking proceeds regardless
      } finally {
        setIsSavingPlan(false);
      }
    }
    onAccept();
  }, [selectedPlanId, getSelectedPlanPayload, formData.leadId, onAccept]);

  const hasNoSelection = selectedPlanId === null;
  const isCustomInvalid = selectedPlanId === "custom" && getSelectedPlanPayload() === null;

  return (
    <>
      <div className="relative z-[1] flex flex-col gap-5">

        {/* Heading */}
        <motion.div
          className="flex flex-col gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <h1
            style={{
              fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
              fontSize: "clamp(1.5rem, 5vw, 1.9rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              color: isExpired ? "#7f1d1d" : "var(--text-primary)",
            }}
          >
            {isExpired ? "Your offer has expired." : "Your loan offer is confirmed."}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {isExpired
              ? "This loan offer is no longer valid. Start a new application to get a fresh offer."
              : <>Choose the repayment plan that suits you best, then book a quick appointment to collect your funds.</>
            }
          </p>
        </motion.div>

        {/* Confirmed offer header */}
        <div style={isExpired ? { opacity: 0.5, filter: "grayscale(0.4)", pointerEvents: "none" } : undefined}>
          <OfferHeader
            formData={formData}
            revealStage={revealStage}
          />
        </div>

        {/* Plan picker */}
        {!isExpired && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={revealStage >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.45, ease: EASE }}
            style={{ pointerEvents: revealStage >= 2 ? "auto" : "none" }}
          >
            <PlanPicker
              approvedAmount={formData.amount}
              selectedPlanId={selectedPlanId}
              onPlanSelect={setSelectedPlanId}
              customPlan={customPlan}
              onCustomPlanChange={setCustomPlan}
              plans={plans}
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
          className="text-[10px] leading-relaxed -mt-2"
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
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-blue text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            >
              Start a New Application
              <ArrowRight size={16} weight="bold" />
            </a>
          ) : (
            <>
              <button
                ref={ctaButtonRef}
                type="button"
                onClick={handleAccept}
                disabled={hasNoSelection || isCustomInvalid || isSavingPlan}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-teal text-sm font-semibold text-[var(--text-primary)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                {isSavingPlan ? "Saving plan…" : "Continue"}
                {!isSavingPlan && <ArrowRight size={16} weight="bold" />}
              </button>
              {hasNoSelection && (
                <p className="text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  Select a repayment plan above to continue.
                </p>
              )}
              {isCustomInvalid && (
                <p className="text-center text-[11px]" style={{ color: "#dc2626" }}>
                  Please enter a valid loan amount and tenure to continue.
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="text-center text-sm text-[var(--text-tertiary)] transition-colors duration-200 hover:text-[var(--text-secondary)]"
              >
                I need to think about it
              </button>
            </>
          )}
        </motion.div>
      </div>

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
              onClick={scrollToCta}
              className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-teal px-12 text-sm font-semibold text-[var(--text-primary)] shadow-lg shadow-brand-teal/30 transition-all duration-200 hover:brightness-110 active:scale-[0.98] whitespace-nowrap"
            >
              Secure Offer
              <ArrowDown size={16} weight="bold" />
            </button>
          )}
        </div>
      )}

      {showModal && (
        <ReconsiderModal
          onAccept={handleAccept}
          onClose={() => setShowModal(false)}
          leadId={formData.leadId ?? undefined}
        />
      )}
    </>
  );
}
