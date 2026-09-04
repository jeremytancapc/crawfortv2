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
  Lightning,
  Scales,
  Feather,
  Star,
  SlidersHorizontal,
  HandTap,
} from "@phosphor-icons/react";
import { PrimaryButton, StickyFooter } from "@/app/apply-gate/ios-ui";
import { useApplyStepNav } from "@/app/apply-gate/use-apply-step-nav";
import { CreditGauge } from "@/app/credit-gauge";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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

/** Legend swatch for the gauge's locked ticks. The ticks themselves run lighter
 *  (see credit-gauge.tsx); a 10px dot needs more ink to read as the same grey. */
const GAUGE_LOCKED_SWATCH = "rgba(60, 60, 67, 0.28)";

/** --offer-accent is tuned for icons; text on its tinted chip needs to go darker. */
const PRE_APPROVED_TEXT = "oklch(0.48 0.08 176)";

/** One of the two figures floating on the arc's end ticks. The dot ties the
 *  number back to the tick colour it describes. */
function GaugeStat({
  dotColor,
  label,
  value,
}: {
  dotColor: string;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex flex-col gap-[3px] rounded-[9px] px-2 py-1.5"
      style={{
        background: "var(--surface-primary)",
        boxShadow:
          "0 1px 4px rgba(60, 60, 67, 0.1), inset 0 0 0 1px rgba(60, 60, 67, 0.07)",
      }}
    >
      <span className="flex items-center gap-1 text-[9px] font-medium uppercase leading-none tracking-[0.04em] text-[var(--text-tertiary)]">
        <span
          aria-hidden="true"
          className="size-[5px] shrink-0 rounded-full"
          style={{ background: dotColor }}
        />
        {label}
      </span>
      <span className="text-[12px] font-bold leading-none tabular-nums text-[var(--text-primary)]">
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
  const hasStructuralReserve = limit > maxWithdraw;
  const canAdjust = maxWithdraw > minWithdraw;

  // Offer expiry date for the footer meta strip (static label, not a live clock).
  const renewalDate = useMemo(() => computeExpiry(new Date()), []);
  const renewalLabel = `${ordinalSuffix(renewalDate.getDate())} ${FULL_MONTHS[renewalDate.getMonth()]} ${renewalDate.getFullYear()}`;

  const commitAmount = (raw: number) => {
    const clamped = clampWithdrawAmount(raw, maxWithdraw);
    onWithdrawAmountChange(clamped);
    setAmountRaw(String(clamped));
  };

  return (
    /* One card: the gauge carries the whole story - the arc is the total
       limit, the coloured ticks are what's available today, and the figure
       in the middle is what they're taking. Expiry and the explainer sit
       below as rows of the same card. */
    <RevealOnScroll>
      <div className="ios-card">
        <div className="flex flex-col items-center px-5 pb-5 pt-6">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none"
            style={{ background: "var(--offer-accent-ring)", color: PRE_APPROVED_TEXT }}
          >
            <SealCheck size={13} weight="fill" />
            Pre-approved
          </span>

          <div className="mt-4 w-full">
            <CreditGauge
              value={withdrawAmount}
              maxToday={maxWithdraw}
              limit={limit}
              min={minWithdraw}
              step={WITHDRAW_STEP}
              onChange={commitAmount}
              disabled={!canAdjust}
              ariaLabel="Amount to withdraw today. Drag the dial or use arrow keys."
            >
              {({ value: displayValue, isIntro }) => (
              <div className="flex w-full flex-col items-center">
              <span className="mt-0.5 text-center text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--text-tertiary)]">
                Withdraw today
              </span>
              {/* Dashed rule + pencil: without them the figure reads as a
                  headline rather than a field you can tap and retype. */}
              <div
                className="ios-display-amount mt-1.5 flex items-baseline justify-center gap-1 pb-1 leading-none"
                style={
                  canAdjust
                    ? { borderBottom: "1.5px dashed var(--border-medium)" }
                    : undefined
                }
              >
                <span
                  aria-hidden="true"
                  className="text-[24px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]"
                >
                  $
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountFocused ? amountRaw : displayValue.toLocaleString("en-SG")}
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
                  readOnly={isIntro}
                  aria-label="Type the amount to withdraw today"
                  className="ios-display-input border-0 bg-transparent p-0 text-center text-[40px] font-bold leading-none tracking-[-0.03em] tabular-nums text-[var(--text-primary)] outline-none disabled:opacity-100"
                  style={{
                    fieldSizing: "content",
                    width: "auto",
                    minWidth: `${String(displayValue.toLocaleString("en-SG")).length}ch`,
                  }}
                />
              </div>
              {/* Kept short: it has to clear the two foot cards either side. */}
              {canAdjust && (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] leading-none text-[var(--text-tertiary)]">
                  <HandTap size={12} weight="fill" className="shrink-0 text-[var(--accent)]" />
                  Drag or tap to change
                </p>
              )}
              </div>
              )}
            </CreditGauge>
          </div>

          {/* Sit under the arc's two ends, so each figure lines up with the
              point on the scale it describes. */}
          <div
            className={`mt-1 flex w-full max-w-[300px] gap-2 ${
              hasStructuralReserve ? "justify-between" : "justify-center"
            }`}
          >
            {hasStructuralReserve && (
              <GaugeStat
                dotColor="var(--brand-blue-hex)"
                label="Approved"
                value={formatCurrency(maxWithdraw)}
              />
            )}
            <GaugeStat
              dotColor={GAUGE_LOCKED_SWATCH}
              label="Total limit"
              value={formatCurrency(limit)}
            />
          </div>
        </div>

        <div className="ios-row" style={{ borderTop: "1px solid var(--separator)" }}>
          <span className="flex items-center gap-2 text-[15px] font-semibold leading-tight text-[var(--text-primary)]">
            <CalendarBlank size={16} weight="bold" style={{ color: "oklch(0.62 0.17 25)" }} />
            Offer expires
          </span>
          <span className="text-[15px] leading-tight text-[var(--text-secondary)]">
            {renewalLabel}
          </span>
        </div>

        {hasStructuralReserve && (
          <div style={{ borderTop: "1px solid var(--separator)" }}>
            <button
              type="button"
              onClick={() => setIsExplainerOpen((open) => !open)}
              aria-expanded={isExplainerOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="text-[15px] leading-tight text-[var(--text-secondary)]">
                How your credit limit works
              </span>
              <CaretDown
                size={14}
                weight="bold"
                className="shrink-0 text-[var(--text-tertiary)] transition-transform duration-200"
                style={{ transform: isExplainerOpen ? "rotate(180deg)" : "none" }}
              />
            </button>
            {isExplainerOpen && (
              /* Swatches match the gauge ticks above, so the explainer reads as
                 a key to the arc rather than a wall of text. */
              <dl className="flex flex-col gap-3 px-4 pb-4">
                {[
                  {
                    color: "var(--brand-blue-hex)",
                    term: "Approved",
                    detail:
                      "Paid into your bank after you finish every step, including your in-person appointment.",
                  },
                  {
                    color: GAUGE_LOCKED_SWATCH,
                    term: "Unlocks later",
                    detail:
                      "Repay on time in the Crawfort app and the remaining credit unlocks automatically.",
                  },
                ].map((row) => (
                  <div key={row.term} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: row.color }}
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <dt className="text-[14px] font-semibold leading-tight text-[var(--text-primary)]">
                        {row.term}
                      </dt>
                      <dd className="text-[14px] leading-[1.45] text-[var(--text-secondary)]">
                        {row.detail}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
    </RevealOnScroll>
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

/** Widths where globals.css runs the plan cards as a lane - one card forward,
 *  the other two peeking behind it - instead of the even 3-up desktop grid.
 *  Kept in step with the `.plan-lane` media query. */
const LANE_MEDIA_QUERY = "(max-width: 1023.98px)";

/** How far the peeking lane cards shrink and tuck in behind the active one.
 *  Purely visual (translateX + scale, composited) - the layout box behind
 *  every card stays a fixed third of the lane at all times, so switching
 *  cards never triggers a real resize/reflow (which is what made the old
 *  flex-basis/margin version feel jittery: every frame forced the
 *  container-query text inside each card to re-measure).
 *
 *  The active card is never scaled up: every card's height is stretched to
 *  match the row (`align-items: stretch`), so growing one card's `transform`
 *  grows it past that shared row height too, with nothing to clip the
 *  overflow - it bleeds into whatever sits above/below the lane. Its ring,
 *  shadow and "Popular" badge already make it read as the front card; only
 *  the two peeking cards shrink, which is always safe since shrinking can
 *  only pull a card further inside its own box, never past it. A card two
 *  slots from the active one (only reachable when the active card sits at
 *  either end of the three) tucks in further so it still reads as "directly
 *  behind" its nearer neighbour rather than drifting off. */
function laneCardTransform(offsetFromActive: number): { x: string; scale: number } {
  if (offsetFromActive === 0) return { x: "0%", scale: 1 };
  const pull = Math.abs(offsetFromActive) >= 2 ? 36 : 20;
  const towardActive = offsetFromActive < 0 ? 1 : -1;
  return { x: `${towardActive * pull}%`, scale: 0.8 };
}

const FLIP_DURATION = 0.55;

/** Reserved strip above every card body. The "Popular" tab occupies this slot
 *  so a badge on one card can never push the other two header panels out of line. */
const PILL_SLOT_HEIGHT = "1.125rem";

const CARD_RADIUS = 16;

/** Header panel fill - each plan gets its own soft, diagonal tint so the three
 *  cards read as distinct choices at a glance rather than three copies of the
 *  same card. Kept light enough that --text-primary/--text-tertiary still sit
 *  on top cleanly. Shared between the front panel and its flipped-back twin
 *  so the identity carries through the flip. */
const PANEL_GRADIENTS = {
  lowest_interest: "linear-gradient(135deg, oklch(0.93 0.045 258) 0%, oklch(0.968 0.016 258) 100%)",
  average: "linear-gradient(135deg, oklch(0.92 0.055 95) 0%, oklch(0.965 0.022 90) 100%)",
  lowest_instalment: "linear-gradient(135deg, oklch(0.92 0.05 175) 0%, oklch(0.965 0.02 178) 100%)",
  // Violet sits outside the three standard plans' hues on purpose - a custom
  // plan is a request, not one of the offers on the table.
  custom: "linear-gradient(135deg, oklch(0.92 0.055 305) 0%, oklch(0.965 0.022 305) 100%)",
} satisfies Record<OfferPlan["id"], string>;

/** Hairline used inside a resting card. --border-subtle is too heavy here. */
const HAIRLINE = "rgba(60, 60, 67, 0.09)";

/** Resting-state CTA fill - a whisper of brand blue so the footer bar reads
 *  as its own tappable band instead of blending into the white card body. */
const CTA_GHOST_BG = "oklch(0.965 0.028 260)";

/** Tints the big watermark glyph in each header - same hue family as that
 *  plan's PANEL_GRADIENTS, just darker/more saturated so it reads at low
 *  opacity instead of washing out against its own gradient. */
const WATERMARK_TINTS = {
  lowest_interest: "oklch(0.55 0.1 258)",
  average: "oklch(0.55 0.11 95)",
  lowest_instalment: "oklch(0.55 0.1 175)",
  custom: "oklch(0.52 0.13 305)",
} satisfies Record<OfferPlan["id"], string>;

/** Darker sibling of WATERMARK_TINTS in the same hue - low enough in
 *  lightness to hold small text on top of that plan's PANEL_GRADIENTS. */
const PLAN_INK = {
  lowest_interest: "oklch(0.40 0.13 258)",
  average: "oklch(0.40 0.09 95)",
  lowest_instalment: "oklch(0.38 0.08 175)",
  custom: "oklch(0.40 0.14 305)",
} satisfies Record<OfferPlan["id"], string>;

/* Three cards share one narrow column - barely 100px each at 360px - so type is
   sized against the card itself (@container on the card root) rather than the
   viewport. Every step caps out once the column stops growing, and the floors
   are set to keep the price row inside the panel at the narrowest width. */
const TYPE = {
  planName: "text-[clamp(0.6rem,10cqi,1rem)]",
  price: "text-[clamp(0.9375rem,16cqi,1.625rem)]",
  priceUnit: "text-[clamp(0.5rem,7.8cqi,0.8125rem)]",
  cta: "text-[clamp(0.5625rem,8.6cqi,0.875rem)]",
  body: "text-[clamp(0.625rem,9cqi,0.875rem)]",
  label: "text-[clamp(0.5rem,7cqi,0.6875rem)]",
  pill: "text-[clamp(0.5rem,6.5cqi,0.6875rem)]",
  icon: "h-[clamp(0.625rem,9.5cqi,1rem)] w-[clamp(0.625rem,9.5cqi,1rem)]",
} as const;

/* Slots sized for two lines of TYPE.body, so a pitch or bullet that wraps on a
   narrow card can't knock the three cards out of step. Written out in full
   rather than composed, so Tailwind can still see the class names. */
const TWO_LINE_HEIGHT = "h-[clamp(1.5625rem,22.5cqi,2.1875rem)]";
/* Taller than two lines of TYPE.body so a wrap on one card leaves a gap
   before the next bullet, and every card's row N stays on the same line.
   Four rows: the pitch (now a "special" starred perk) plus tenure and the
   two selling points. */
const TWO_LINE_ROWS = "grid-rows-[repeat(4,clamp(2.25rem,32cqi,3rem))]";

/** Plan identity glyph. `custom` is covered for exhaustiveness only - custom
 *  offers render through CustomOfferCard, never through PlanCard. */
const PLAN_ICONS = {
  lowest_interest: Lightning,
  average: Scales,
  lowest_instalment: Feather,
  custom: Scales,
} satisfies Record<OfferPlan["id"], typeof Lightning>;

/** Ring + drop shadow drawn around the card body, outside the flipping faces.
 *  Selection is carried entirely by this blue ring/glow plus the CTA below -
 *  no background wash, so there's no color left to flash mid-flip. Colour
 *  comes from a custom property so the mobile lane can run a darker edge
 *  than the desktop grid without changing ring width. */
function cardFrameShadow(isSelected: boolean): string {
  return isSelected
    ? "0 0 0 var(--plan-ring-selected, 2px) var(--brand-blue-hex, #0033AA), 0 10px 26px oklch(0.32 0.14 260 / 0.28)"
    : "0 0 0 var(--plan-ring, 1px) var(--plan-ring-color, var(--border-subtle)), 0 1px 2px oklch(0.24 0.06 260 / 0.05)";
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
  const PlanIcon = PLAN_ICONS[plan.id];
  // The pitch leads the list as its own "special" perk - a spinning star
  // instead of a checkmark - rather than living in a separate colored band.
  const features = [
    { text: plan.pitch, special: true },
    { text: `${plan.tenure}-month tenure`, special: false },
    ...plan.sellingPoints.map((point) => ({ text: point, special: false })),
  ];

  // `perspective` forces Chrome to rasterize the whole card as a 3D layer, which
  // softens its text. Mount it only while the card is mid-flip or showing its back.
  const [isFlipping, setIsFlipping] = useState(false);

  // The card body and panels never change color for selection - only the
  // ring/glow (outside the flip) and the CTA (below) do. Gating the one-shot
  // shine on "settled" keeps it from playing mid-flip, when the front face
  // isn't even in view.
  const isSettledSelected = isSelected && !isFlipped;

  // Bumped on every tap of the CTA so the click itself gets a quick shine,
  // independent of the slower whole-panel sweep that plays once the card
  // settles back into its selected state. Keyed by the counter so each tap
  // remounts (and thus replays) the sweep even if the previous one hasn't
  // finished.
  const [ctaPulse, setCtaPulse] = useState(0);

  return (
    <div className="@container relative h-full w-full">
      {/* Ring + shadow live outside the flip so they frame the card as one unit
          and stay crisp while the faces rotate. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 transition-shadow duration-200"
        style={{
          top: isPopular ? 0 : PILL_SLOT_HEIGHT,
          borderRadius: CARD_RADIUS,
          boxShadow: cardFrameShadow(isSelected),
        }}
      />

      {/* Full-width tab, flush with the card below: rounded top, square bottom,
          like a header bar sitting on the card. Lives outside the flip so it
          never rotates, mirrors, or disappears when the details face comes
          forward. */}
      {isPopular && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[3] overflow-hidden"
          style={{
            height: PILL_SLOT_HEIGHT,
            borderTopLeftRadius: CARD_RADIUS,
            borderTopRightRadius: CARD_RADIUS,
          }}
        >
          {/* .popular-badge-glow supplies the pulse and the shine sweep; it sets
              position: relative itself, so the text needs to sit above it. */}
          <div
            className="popular-badge-glow flex h-full w-full items-center justify-center"
            style={{ background: "#F5C518" }}
          >
            <span
              className={`relative z-[1] font-bold uppercase leading-none tracking-[0.08em] ${TYPE.pill}`}
              style={{ color: "#0a1628" }}
            >
              Popular
            </span>
          </div>
        </div>
      )}

      {/* Both faces sit in the same grid cell (grid-area 1/1) rather than one
          in flow and the other absolutely positioned over it - that way the
          card's natural height is the taller of the two faces, so the back
          can never end up squeezed into less room than its content needs.
          grid-cols-1 (minmax(0,1fr)) pins the column's width to the card
          itself - without it, a grid item's default min-width:auto lets its
          content push the column (and the card) wider than its neighbors,
          which is what was bleeding one card's back face into the next. */}
      <div
        className="h-full w-full"
        style={{ perspective: isFlipped || isFlipping ? 1000 : undefined }}
      >
      <motion.div
        className="relative grid h-full w-full grid-cols-1"
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
      onClick={() => {
        onSelect();
        setCtaPulse((n) => n + 1);
      }}
      className="relative flex h-full w-full min-w-0 flex-col text-left focus:outline-none [grid-area:1/1]"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
      aria-pressed={isSelected}
      aria-label={`${shortPlanName(plan.title)}${isPopular ? ", most popular" : ""}: ${plan.pitch}, ${formatCurrency(plan.monthlyInstalment)} a month over ${plan.tenure} months.${isSelected ? " Tap again for the full breakdown." : ""}`}
      aria-hidden={isFlipped}
      tabIndex={isFlipped ? -1 : 0}
    >
      {/* Reserved tab slot - keeps header panels aligned across all three cards */}
      <div className="w-full shrink-0" style={{ height: PILL_SLOT_HEIGHT }} aria-hidden="true" />

      <div
        className="relative flex w-full flex-1 flex-col overflow-hidden"
        style={{
          borderRadius: isPopular ? `0 0 ${CARD_RADIUS}px ${CARD_RADIUS}px` : CARD_RADIUS,
          background: "var(--surface-elevated)",
        }}
      >
        {/* Plays once when the card settles into the selected state - a brief
            glassy sweep that reads as premium feedback. Gated on
            isSettledSelected (not raw isSelected) so it never plays mid-flip,
            when the front face isn't even in view. */}
        {isSettledSelected && <div aria-hidden="true" className="selected-card-shine z-[2]" />}

        {/* Header - the plan's own gradient runs flush to the card's own edges,
            clipped to its top corners by the parent's overflow-hidden, instead
            of floating as a smaller inset panel. Only a bottom hairline marks
            where it hands off to the white body below. */}
        <div
          className="relative flex shrink-0 flex-col gap-2.5 px-3.5 pt-[1.125rem] pb-3 sm:gap-3 sm:px-4 sm:pt-5 sm:pb-3.5"
          style={{
            background: PANEL_GRADIENTS[plan.id],
            boxShadow: `inset 0 -1px 0 0 ${HAIRLINE}`,
          }}
        >
          {/* Big decorative glyph bleeding off the card's top-right corner -
              the plan's identity as a watermark rather than a small inline
              icon. Painted first (DOM order) so the name/price below it
              layer on top without needing an explicit z-index. */}
          <PlanIcon
            aria-hidden="true"
            weight="fill"
            className="pointer-events-none absolute -right-3 -top-3 h-[clamp(3rem,52cqi,4.5rem)] w-[clamp(3rem,52cqi,4.5rem)] sm:-right-3.5 sm:-top-3.5"
            style={{ color: WATERMARK_TINTS[plan.id], opacity: 0.28 }}
          />

          <span
            className={`min-w-0 truncate font-semibold leading-none tracking-[-0.01em] ${TYPE.planName}`}
            style={{ color: "var(--text-primary)" }}
          >
            {shortPlanName(plan.title)}
          </span>

          {/* The monthly figure carries the most weight; tenure moves into the
              feature list below so nothing competes with it. */}
          <motion.div
            key={plan.monthlyInstalment}
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="flex items-baseline gap-0.5 whitespace-nowrap"
          >
            <span
              className={`tabular-nums font-extrabold leading-none tracking-[-0.04em] ${TYPE.price}`}
              style={{ color: "var(--text-primary)" }}
            >
              {formatCurrency(plan.monthlyInstalment)}
            </span>
            <span
              className={`font-semibold leading-none ${TYPE.priceUnit}`}
              style={{ color: "var(--text-tertiary)" }}
            >
              /mo
            </span>
          </motion.div>

        </div>

        {/* Selling features - the pitch leads as its own starred perk
            instead of living in a separate colored band. Carries its own
            side/top padding now that the card body has none; flex-1 so it
            absorbs whatever extra height items-stretch gives this card,
            pinning the CTA below to the card's bottom edge. */}
        <div className="flex flex-1 flex-col gap-2 px-3 pt-3 sm:gap-2.5 sm:px-3.5 sm:pt-3.5">
          <ul className={`plan-features grid ${TWO_LINE_ROWS}`}>
            {features.map((feature) => (
              <li key={feature.text} className="flex items-start gap-1 sm:gap-1.5">
                {feature.special ? (
                  <motion.span
                    className={`mt-px inline-flex shrink-0 ${TYPE.icon}`}
                    animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                  >
                    <Star weight="fill" className="h-full w-full" style={{ color: WATERMARK_TINTS[plan.id] }} />
                  </motion.span>
                ) : (
                  <CheckCircle
                    size={12}
                    weight="bold"
                    className={`mt-px shrink-0 ${TYPE.icon}`}
                    style={{ color: "var(--brand-blue-hex)" }}
                  />
                )}
                <span
                  className={`min-w-0 font-medium leading-tight tracking-[-0.01em] ${TYPE.body}`}
                  style={{ color: "var(--text-primary)" }}
                >
                  {feature.text}
                </span>
              </li>
            ))}
          </ul>
          {isSelected && (
            <p
              className={`mt-auto pb-1 text-center font-medium leading-none tracking-[-0.01em] ${TYPE.label}`}
              style={{ color: "var(--text-tertiary)" }}
            >
              Tap again for more details
            </p>
          )}
        </div>

        {/* CTA footer - doubles as the selection indicator: resting cards
            get a white ghost bar, the selected card gets a filled blue bar
            plus the ring and glow drawn around the whole card. Flush to the
            card's bottom corners, mirroring the header treatment above. */}
        <div
          className="relative -mx-0.5 -mb-0.5 flex shrink-0 items-center justify-center overflow-hidden px-3.5 py-2.5 sm:px-4 sm:py-3"
          style={{
            background: isSelected ? "var(--brand-blue-hex)" : CTA_GHOST_BG,
            boxShadow: isSelected ? "none" : `inset 0 1px 0 0 ${HAIRLINE}`,
          }}
        >
          {/* Quick tactile sweep on every tap - remounts on each ctaPulse
              bump so rapid re-taps replay it instead of queuing. */}
          {ctaPulse > 0 && <span key={ctaPulse} aria-hidden="true" className="cta-tap-shine" />}
          <span
            className={`flex items-center justify-center gap-1 font-semibold leading-none ${TYPE.cta}`}
            style={{ color: isSelected ? "#ffffff" : "var(--brand-blue-hex)" }}
          >
            {isSelected ? (
              <>
                <CheckCircle size={13} weight="fill" className={TYPE.icon} />
                Selected
              </>
            ) : (
              <>
                Pick this plan
                <ArrowRight size={13} weight="bold" className={TYPE.icon} />
              </>
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
          aria-label={`Hide the ${shortPlanName(plan.title)} breakdown`}
          tabIndex={isFlipped ? 0 : -1}
          aria-hidden={!isFlipped}
          className="plan-card-back relative flex h-full w-full min-w-0 flex-col text-left focus:outline-none [grid-area:1/1]"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="w-full shrink-0" style={{ height: PILL_SLOT_HEIGHT }} aria-hidden="true" />
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            style={{
              borderRadius: isPopular ? `0 0 ${CARD_RADIUS}px ${CARD_RADIUS}px` : CARD_RADIUS,
              background: "#0a0a0a",
            }}
          >
            {/* Ink-black on the flipped side - deliberately breaks from the
                front's per-plan gradient so the two faces read as distinct
                "sell" vs "detail" moods, matching the black "Tap to go back"
                footer below. */}
            <div
              className="flex shrink-0 flex-col gap-2.5 px-3.5 pt-[1.125rem] pb-3 sm:gap-3 sm:px-4 sm:pt-5 sm:pb-3.5"
              style={{
                background: "#0a0a0a",
                boxShadow: "inset 0 -1px 0 0 oklch(1 0 0 / 0.12)",
              }}
            >
              <div className="flex min-w-0 items-center gap-[3px] sm:gap-1.5">
                <PlanIcon
                  size={12}
                  weight="bold"
                  className={`shrink-0 ${TYPE.icon}`}
                  style={{ color: "#ffffff" }}
                />
                <span
                  className={`min-w-0 truncate font-semibold leading-none tracking-[-0.01em] ${TYPE.planName}`}
                  style={{ color: "#ffffff" }}
                >
                  {shortPlanName(plan.title)}
                </span>
              </div>
              {/* Replaces the price here - the monthly figure moved down
                  into the figures list below, so this row now names what
                  the rest of the face is showing. */}
              <span
                className={`font-extrabold leading-none tracking-[-0.02em] ${TYPE.price}`}
                style={{ color: "#ffffff" }}
              >
                Breakdown
              </span>
            </div>

            {/* Figures list. flex-1 so it absorbs whatever extra height
                items-stretch gives this card. Bottom padding guarantees a
                minimum gap above the "Tap to go back" footer even when
                justify-center leaves little room of its own. */}
            <div
              className="flex min-h-0 flex-1 flex-col px-2.5 pt-3 pb-3 sm:px-3.5 sm:pt-3.5 sm:pb-4"
              style={{ background: "var(--surface-elevated)" }}
            >
              <dl className="flex min-h-0 flex-1 flex-col justify-center">
                {[
                  { label: "Monthly instalment", value: `${formatCurrency(plan.monthlyInstalment)}/mo` },
                  { label: "Tenure", value: `${plan.tenure} ${plan.tenure === 1 ? "month" : "months"}` },
                  { label: "Interest rate", value: `Up to ${formatRate(plan.monthlyRate)}/mo` },
                  { label: "Processing fee", value: `Up to ${OFFER_MAX_PROCESSING_FEE_PCT}%` },
                  { label: "Total repayable", value: formatCurrency(plan.totalRepayment) },
                ].map((row, index) => (
                  <div
                    key={row.label}
                    className="flex flex-col gap-px py-[3px] sm:py-1.5"
                    style={{
                      borderTop: index === 0 ? "none" : `1px solid ${HAIRLINE}`,
                    }}
                  >
                    <dt
                      className={`font-bold uppercase leading-tight tracking-[0.07em] ${TYPE.label}`}
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {row.label}
                    </dt>
                    <dd
                      className={`tabular-nums font-semibold leading-tight ${TYPE.body}`}
                      style={{ color: "var(--text-primary)" }}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Same footer-bar shape/padding as the front's CTA, but in its
                own ink-black treatment so it reads as this face's distinct
                action rather than a repeat of the front's blue CTA. */}
            <div
              className="relative -mx-0.5 -mb-0.5 flex shrink-0 items-center justify-center px-3.5 py-2.5 sm:px-4 sm:py-3"
              style={{
                background: "#0a0a0a",
              }}
            >
              <span
                className={`font-semibold leading-none ${TYPE.cta}`}
                style={{ color: "#ffffff" }}
              >
                Tap to go back
              </span>
            </div>
          </div>
        </button>
      </motion.div>
      </div>
    </div>
  );
}

/** Same card anatomy as PlanCard - rounded body, ring/glow that carries
 *  selection, one-shot shine - stretched to the full column width. */
function CustomCardFrame({
  isSelected,
  children,
}: {
  isSelected: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="relative flex w-full flex-col overflow-hidden text-left transition-shadow duration-200"
      style={{
        borderRadius: CARD_RADIUS,
        background: "var(--surface-elevated)",
        boxShadow: cardFrameShadow(isSelected),
      }}
    >
      {isSelected && <div aria-hidden="true" className="selected-card-shine z-[2]" />}
      {children}
    </div>
  );
}

/** Header band mirroring PlanCard's: the plan's own gradient, its identity
 *  glyph bleeding off the top-right corner as a watermark, then the headline
 *  the state wants to lead with (a title while choosing, the estimated
 *  instalment once the request is set). */
function CustomCardHeader({
  children,
  compact = false,
  trailing,
}: {
  children: ReactNode;
  compact?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={
        compact
          ? "relative flex shrink-0 items-center gap-3 px-3.5 py-2.5"
          : "relative flex shrink-0 flex-col gap-2 px-4 pt-4 pb-3.5"
      }
      style={{
        background: PANEL_GRADIENTS.custom,
        boxShadow: `inset 0 -1px 0 0 ${HAIRLINE}`,
      }}
    >
      <SlidersHorizontal
        aria-hidden="true"
        weight="fill"
        className={
          compact
            ? "pointer-events-none absolute -right-3 -top-4 h-16 w-16"
            : "pointer-events-none absolute -right-4 -top-5 h-[5.5rem] w-[5.5rem]"
        }
        style={{ color: WATERMARK_TINTS.custom, opacity: compact ? 0.18 : 0.24 }}
      />

      <div className={`relative min-w-0 ${compact ? "flex flex-1 flex-col gap-1" : "contents"}`}>
        <div className="relative flex items-center gap-2">
          <span
            className={`${compact ? "text-[12px]" : "text-[13px]"} font-semibold leading-none tracking-[-0.01em]`}
            style={{ color: "var(--text-primary)" }}
          >
            Your own plan
          </span>
          <span
            className="rounded-full px-2 py-[3px] text-[9px] font-bold uppercase leading-none tracking-[0.08em]"
            style={{
              background: "oklch(1 0 0 / 0.6)",
              color: WATERMARK_TINTS.custom,
              boxShadow: "inset 0 0 0 1px oklch(0.52 0.13 305 / 0.22)",
            }}
          >
            Tentative
          </span>
        </div>

        <div className="relative">{children}</div>
      </div>

      {trailing ? <div className="relative shrink-0">{trailing}</div> : null}
    </div>
  );
}

/** Repeated in every state of the card. A custom plan is a request our team
 *  works on by hand, so nothing here may read as an approved offer. */
function TentativeRequestNote() {
  return (
    <div
      className="flex items-start gap-2 rounded-[var(--radius-md)] px-2.5 py-2"
      style={{ background: "var(--surface-secondary)" }}
    >
      {/* Amber rather than --offer-accent's teal: this note is a caution, not
          another reassurance. */}
      <Warning
        size={13}
        weight="fill"
        className="mt-[2px] shrink-0"
        style={{ color: "oklch(0.63 0.15 72)" }}
      />
      <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
          Tentative request only.
        </span>{" "}
        This is not a confirmed offer. Our team will call and WhatsApp you to check what&apos;s
        possible and confirm the final terms.
      </p>
    </div>
  );
}

/** Feature row shared with PlanCard: a spinning star for the lead perk,
 *  a checkmark for the supporting facts. */
function CustomCardPoint({
  text,
  special = false,
  spin = false,
}: {
  text: ReactNode;
  special?: boolean;
  spin?: boolean;
}) {
  return (
    <li className="flex items-start gap-1.5">
      {special ? (
        <motion.span
          className="mt-[1px] inline-flex h-3.5 w-3.5 shrink-0"
          animate={spin ? { rotate: 360 } : undefined}
          transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
        >
          <Star weight="fill" className="h-full w-full" style={{ color: WATERMARK_TINTS.custom }} />
        </motion.span>
      ) : (
        <CheckCircle
          size={14}
          weight="bold"
          className="mt-[1px] h-3.5 w-3.5 shrink-0"
          style={{ color: "var(--brand-blue-hex)" }}
        />
      )}
      <span
        className="min-w-0 text-[13px] font-medium leading-snug tracking-[-0.01em]"
        style={{ color: "var(--text-primary)" }}
      >
        {text}
      </span>
    </li>
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
  const prefersReducedMotion = useReducedMotion();
  const [isEditing, setIsEditing] = useState(true);
  const amountValue = parseInt(amount, 10);
  const tenureValue = parseInt(tenure, 10);
  const canConfirm =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    Number.isFinite(tenureValue) &&
    tenureValue > 0;

  // Indicative only - the same standard rate the three plans quote, applied to
  // whatever the customer asked for. Our team confirms the real figure.
  const estimatedInstalment = canConfirm
    ? Math.ceil(calculateInstalment(amountValue, tenureValue, OFFER_MONTHLY_RATE))
    : 0;

  // Re-open the form whenever the card is freshly selected.
  useEffect(() => {
    if (isSelected) setIsEditing(true);
  }, [isSelected]);

  if (!isSelected) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={false}
        className="group mx-auto block w-4/5 transition-transform duration-200 active:scale-[0.99] lg:w-full"
        aria-label="Customise your own loan plan. Sends a tentative request, not a confirmed offer."
      >
        <CustomCardFrame isSelected={false}>
          <CustomCardHeader
            compact
            trailing={
              <CaretDown
                size={18}
                weight="bold"
                className="shrink-0"
                style={{ color: "#000000" }}
              />
            }
          >
            <span
              className="min-w-0 text-[15px] font-extrabold leading-tight tracking-[-0.03em]"
              style={{ color: "var(--text-primary)" }}
            >
              Customise your own loan plan
            </span>
          </CustomCardHeader>
        </CustomCardFrame>
      </button>
    );
  }

  if (isEditing) {
    return (
      <CustomCardFrame isSelected>
        <CustomCardHeader>
          <div className="flex flex-col gap-1">
            <span
              className="text-[20px] font-extrabold leading-tight tracking-[-0.03em]"
              style={{ color: "var(--text-primary)" }}
            >
              Customise your own loan plan
            </span>
            <span className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Tell us the amount and tenure you want to request.
            </span>
          </div>
        </CustomCardHeader>

        <div className="flex flex-col gap-3 px-4 pt-3.5 pb-4">
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

          {canConfirm && (
            <div
              className="flex items-baseline justify-between rounded-[var(--radius-md)] px-3 py-2"
              style={{ background: "var(--surface-secondary)" }}
            >
              <span
                className="text-[11px] font-bold uppercase tracking-[0.07em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Indicative instalment
              </span>
              <span
                className="text-[15px] font-bold tabular-nums tracking-[-0.02em]"
                style={{ color: "var(--text-primary)" }}
              >
                {formatCurrency(estimatedInstalment)}/mo
              </span>
            </div>
          )}

          <TentativeRequestNote />

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
        </div>
      </CustomCardFrame>
    );
  }

  return (
    <CustomCardFrame isSelected>
      <CustomCardHeader>
        <div className="flex items-baseline gap-1 whitespace-nowrap">
          <span
            className="text-[26px] font-extrabold leading-none tabular-nums tracking-[-0.04em]"
            style={{ color: "var(--text-primary)" }}
          >
            {formatCurrency(estimatedInstalment)}
          </span>
          <span className="text-[13px] font-semibold leading-none" style={{ color: "var(--text-tertiary)" }}>
            /mo est.
          </span>
        </div>
      </CustomCardHeader>

      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-3.5">
        <ul className="flex flex-col gap-1.5">
          <CustomCardPoint special spin={!prefersReducedMotion} text="Your own amount and tenure" />
          <CustomCardPoint text={`${formatCurrency(amountValue)} requested`} />
          <CustomCardPoint text={`${tenureValue}-month tenure`} />
          <CustomCardPoint text={`Indicative rate up to ${formatRate(OFFER_MONTHLY_RATE)}/mo`} />
        </ul>
        <TentativeRequestNote />
      </div>

      <div
        className="flex shrink-0 items-center justify-between gap-2 px-4 py-2.5"
        style={{ background: "var(--brand-blue-hex)" }}
      >
        <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-none text-white">
          <CheckCircle size={14} weight="fill" />
          Request ready
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold leading-none text-white transition-colors duration-150 hover:bg-white/25"
            style={{ background: "oklch(1 0 0 / 0.16)" }}
          >
            <PencilSimple size={12} weight="bold" />
            Edit
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center rounded-full p-1.5 text-white/80 transition-colors duration-150 hover:bg-white/20 hover:text-white"
            aria-label="Remove custom plan request"
          >
            <X size={12} weight="bold" />
          </button>
        </span>
      </div>
    </CustomCardFrame>
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

  // Which card holds the lane below desktop. The popular plan starts centred,
  // so the row opens on the one most customers pick.
  const [lanePlanId, setLanePlanId] = useState<OfferPlan["id"] | undefined>(
    () => plans.find((plan) => plan.badge)?.id ?? plans[Math.floor(plans.length / 2)]?.id,
  );
  const activeLaneIndex = plans.findIndex((plan) => plan.id === lanePlanId);

  return (
    <div className="flex flex-col gap-3">
      <div className="plan-lane">
        {plans.map((plan, index) => {
          const { x: laneX, scale: laneScale } = laneCardTransform(
            activeLaneIndex === -1 ? 0 : index - activeLaneIndex,
          );
          return (
          <div
            key={plan.id}
            className="plan-lane-item"
            data-active={plan.id === lanePlanId}
          >
            {/* RevealOnScroll writes its own transform, so the lane's scale
                needs a layer of its own to sit on. */}
            <RevealOnScroll className="h-full" delay={index * 0.06}>
              <div
                className="plan-lane-card"
                style={{
                  ["--lane-x" as string]: laneX,
                  ["--lane-scale" as string]: laneScale,
                }}
              >
                <PlanCard
                  plan={plan}
                  isSelected={selectedPlanId === plan.id}
                  isFlipped={flippedPlanId === plan.id}
                  onSelect={() => {
                    // A peeking card comes forward on its first tap, so the
                    // breakdown only ever flips in at full width.
                    const comesForward =
                      plan.id !== lanePlanId &&
                      window.matchMedia(LANE_MEDIA_QUERY).matches;
                    if (comesForward || selectedPlanId !== plan.id) {
                      onPlanSelect(plan.id);
                      setLanePlanId(plan.id);
                      setFlippedPlanId(null);
                      return;
                    }
                    setFlippedPlanId(plan.id);
                  }}
                  onFlipBack={() => setFlippedPlanId(null)}
                />
              </div>
            </RevealOnScroll>
          </div>
          );
        })}
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

/** Receipt strip above the sticky CTA - names the plan the customer just
 *  tapped, in that plan's own colours, so the choice is confirmed where
 *  their thumb already is instead of only on a card further up the page. */
function SelectedPlanStrip({
  planId,
  label,
}: {
  planId: OfferPlan["id"];
  label: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const pop = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 28, mass: 0.7 };

  return (
    /* Full-bleed in the footer's banner slot — no padding, no 520px cap. */
    <motion.div
      className="flex w-full items-center justify-center gap-1.5 px-5 py-2"
      style={{
        background: PANEL_GRADIENTS[planId],
        boxShadow: `inset 0 -1px 0 0 ${HAIRLINE}`,
      }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={pop}
    >
      <motion.span
        className="inline-flex"
        initial={{ scale: 0.2 }}
        animate={{ scale: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 700, damping: 16, delay: 0.06 }
        }
      >
        <CheckCircle size={15} weight="fill" style={{ color: WATERMARK_TINTS[planId] }} />
      </motion.span>
      <span
        className="text-[13px] font-semibold leading-none"
        style={{ color: PLAN_INK[planId] }}
      >
        {label}
      </span>
    </motion.div>
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
                className="font-display text-xl font-bold tracking-tight text-[var(--text-primary)]"
                style={{ letterSpacing: "-0.03em" }}
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
                className="font-display text-xl font-bold tracking-tight text-[var(--text-primary)]"
                style={{ letterSpacing: "-0.03em" }}
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
            className="font-display text-xl font-bold tracking-tight text-[var(--text-primary)]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Send your custom plan request
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
            This is a tentative request, not a confirmed offer or an approval. Our team will call and
            WhatsApp you to check what&apos;s possible and confirm the exact terms before anything is signed.
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
  const stepNav = useApplyStepNav("approval");
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
      ? "Enter the loan amount and tenure for your custom plan."
      : null;

  /** Only once the choice is actually actionable - a custom request still
   *  missing its figures keeps showing the hint instead. */
  const selectionLabel = footerHint
    ? null
    : isCustomSelected
      ? "Your own plan selected"
      : (() => {
          const plan = plans.find((p) => p.id === selectedPlanId);
          return plan ? `${shortPlanName(plan.title)} plan selected` : null;
        })();

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
          <div className="flex flex-col gap-4 sm:gap-5">
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
              <h2 className="pb-3 text-[30px] font-bold leading-[1.12] tracking-[-0.022em] text-[var(--text-primary)]">
                Choose your loan plan
              </h2>
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

      <StickyFooter
        nav={stepNav}
        banner={
          selectionLabel && selectedPlanId ? (
            <AnimatePresence mode="wait" initial={false}>
              <SelectedPlanStrip
                key={selectedPlanId}
                planId={selectedPlanId}
                label={selectionLabel}
              />
            </AnimatePresence>
          ) : undefined
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {footerHint ? (
            <motion.p
              key="hint"
              className="mb-2 text-center text-[13px] text-[var(--text-secondary)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {footerHint}
            </motion.p>
          ) : null}
        </AnimatePresence>
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
