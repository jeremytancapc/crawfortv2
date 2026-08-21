"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Buildings,
  CalendarCheck,
  CaretDown,
  Clock,
  ClockCountdown,
  Info,
  ListChecks,
  SealCheck,
  ShieldCheck,
  Warning,
  CurrencyCircleDollar,
} from "@phosphor-icons/react";

import { ApplyIosShell } from "@/app/apply-gate/ios-ui";
import { APPLY_PROGRESS } from "@/lib/apply-progress";
import { AnimatedIconBadge } from "@/app/animated-icon-badge";
import { buildPaymentSchedule } from "@/lib/offer-plans";
import { SignaturePad } from "./signature-pad";
import type { SelectedPlanData } from "./page";

// How long the just-checked step waits before auto-collapsing, and how long
// that collapse animation takes. The page-level auto-scroll (below) waits for
// both to finish before moving to the next step, so it doesn't scroll to a
// position that the collapsing card then invalidates.
const STEP_COLLAPSE_DELAY_MS = 320;
const STEP_COLLAPSE_DURATION_MS = 250;
const SCROLL_TO_NEXT_STEP_DELAY_MS = STEP_COLLAPSE_DELAY_MS + STEP_COLLAPSE_DURATION_MS + 50;
// Blue gate header is in document flow (not sticky). Keep a small inset so
// tall cards aren't flush against the top of the viewport when we pin them.
const STICKY_HEADER_OFFSET_PX = 16;

/**
 * Scroll a newly unlocked step into a comfortable viewport position.
 * Short cards are centered; tall cards (e.g. the payment schedule) are pinned
 * just below the sticky mobile header so their top isn't hidden behind it.
 */
function scrollStepIntoView(el: HTMLElement | null) {
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const absoluteTop = window.scrollY + rect.top;
  const availableHeight = window.innerHeight - STICKY_HEADER_OFFSET_PX;
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;

  let targetY: number;
  if (!isDesktop && rect.height >= availableHeight) {
    // Tall card on mobile: keep the top clear of the sticky header.
    targetY = absoluteTop - STICKY_HEADER_OFFSET_PX;
  } else {
    // Card fits (or desktop has no sticky header): center it in the viewport.
    targetY = absoluteTop - (window.innerHeight - rect.height) / 2;
  }

  window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
}

/**
 * Tracks whether a scroll container still has content below the fold.
 * Used to hide the "Scroll for more" cue once the reader reaches the bottom,
 * and bring it back if they scroll up again.
 */
function useCanScrollMore(ref: RefObject<HTMLElement | null>) {
  const [canScrollMore, setCanScrollMore] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      setCanScrollMore(remaining > 4);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [ref]);

  return canScrollMore;
}

function ScrollForMoreHint({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center pb-1"
          style={{
            height: 56,
            background:
              "linear-gradient(to bottom, transparent, var(--surface-elevated) 48%, var(--surface-elevated) 100%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <span
            className="flex items-center gap-1 text-[10px] font-bold tracking-[0.06em] uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            Scroll for more
            <CaretDown size={9} weight="bold" />
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/** e.g. "22 December 2025 22:30" - matches the reference receipt's plain, formal timestamp. */
function formatReceiptDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getDate();
  const month = date.toLocaleString("en-SG", { month: "long" });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

/** Derives a stable, receipt-style reference number from the lead's UUID. */
function formatReferenceId(leadId: string): string {
  const alphanumeric = leadId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `ID${alphanumeric.slice(0, 9)}`;
}

/** e.g. "12 Sep 2026" - compact date used for schedule due dates. */
function formatScheduleDate(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getDate();
  const month = date.toLocaleString("en-SG", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// ── Approval stamp badge ─────────────────────────────────────────────────────
// Mimics a rubber stamp hitting paper: the badge drops in with a rotational
// overshoot, an ink-ring ripples outward on impact, and the seal briefly
// squashes before settling - all in one short, unobtrusive burst on mount.

function ApprovalStampBadge({
  background,
  ringColor,
  iconColor,
  iconClassName,
}: {
  background: string;
  ringColor: string;
  iconColor?: string;
  iconClassName?: string;
}) {
  return (
    <AnimatedIconBadge background={background} ringColor={ringColor}>
      <SealCheck size={28} weight="fill" style={iconColor ? { color: iconColor } : undefined} className={iconClassName} />
    </AnimatedIconBadge>
  );
}

// ── T&C content ───────────────────────────────────────────────────────────────

const DRAWDOWN_NOTICE =
  "Final drawdown of funds must be completed face to face at our office, as required by anti-money laundering (AML) and know-your-customer (KYC) regulations. If the loan is not drawn down within 3 business days, this loan agreement will be void and a re-application will be required. Every re-application may affect your subsequent approval.";

// The three facts that most often catch customers out. They're pulled out of
// the fine print and confirmed one at a time (see `LoanTermsStepContent`) so
// nobody can tick a single blanket "I agree" without seeing them. Titles are
// written in the first person because the customer is making the statement,
// not reading one; the terms under each are kept short and literal so they
// still hold up as contract wording.
const KEY_TERM_ACKS = [
  {
    key: "collectInPerson",
    Icon: Buildings,
    title: "I need to collect my funds in person",
    terms: [
      "Final drawdown is completed face to face at our office.",
      "This is required under anti-money laundering (AML) and know-your-customer (KYC) regulations.",
    ],
  },
  {
    key: "drawdownWindow",
    Icon: ClockCountdown,
    title: "I need to draw down within 3 business days",
    terms: [
      "The loan must be drawn down within 3 business days.",
      "After that, this agreement is void and a new application is required.",
      "Every re-application may affect your next approval.",
    ],
  },
  {
    key: "lateCharges",
    Icon: Warning,
    title: "I will make payments on time",
    terms: [
      "Late interest of up to 4% per month on the overdue amount.",
      "A late fee of $60 for every month a payment is late.",
    ],
  },
] as const;

type KeyTermAckKey = (typeof KEY_TERM_ACKS)[number]["key"];

const KEY_TERM_ACK_COUNT = KEY_TERM_ACKS.length;

const DISBURSEMENT_NOTICE_ITEMS = [
  "Funds are disbursed via PayNow on the spot at your appointment.",
  "Your PayNow must be linked to your NRIC - we'll pay out to your NRIC-linked PayNow, not your mobile number.",
  "Cash disbursement is strongly discouraged.",
];

const TC_ITEMS = [
  "This loan is granted by CF Money Pte Ltd, a licensed moneylender (Licence No. 86/2026) under the Moneylenders Act (Cap. 188).",
  "Repayment is in equal monthly instalments. Interest is charged at your agreed monthly rate on a reducing-balance basis.",
  "Late payments incur late interest (up to 4%/month) and a late fee of $60 per month. Repayments are applied to late charges first, then interest, then principal.",
  "If you default, the full outstanding balance becomes immediately payable and all recovery costs (including legal costs) are borne by you.",
  "No partial early redemption is allowed. Full early settlement may incur one month's interest at the moneylender's discretion.",
  "You authorise CF Money Pte Ltd to conduct credit checks and disclose your loan information to the Moneylenders Credit Bureau, Credit Bureau (Singapore), and related regulatory agencies.",
  "Additional loan amount and loan tenure requests in previous screen will be discussed with you physically during the loan assessment appointment at our office.",
];

const TC_CLOSING =
  "The full Note of Contract will be explained and signed at your appointment. You will receive a copy, together with your repayment schedule, before funds are disbursed.";

// Everything the customer isn't asked to tick individually, kept verbatim (the
// drawdown notice included) so the complete terms remain on the page.
const FINE_PRINT_ITEMS = [DRAWDOWN_NOTICE, ...TC_ITEMS];

// ── Plan summary card ─────────────────────────────────────────────────────────

/** Hairline rule rendered as short dashes, echoing a printed receipt's tear-off perforation. */
function DashedDivider() {
  return (
    <div
      aria-hidden="true"
      className="h-px w-full shrink-0"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to right, var(--border-medium) 0, var(--border-medium) 5px, transparent 5px, transparent 11px)",
      }}
    />
  );
}

function ReceiptRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span
        className={emphasize ? "text-[13.5px] font-bold" : "text-[13.5px] font-medium"}
        style={{ color: emphasize ? "var(--text-primary)" : "var(--text-tertiary)" }}
      >
        {label}
      </span>
      <span
        className={
          emphasize
            ? "text-[15px] font-semibold tabular-nums text-right"
            : "text-[13.5px] font-semibold tabular-nums text-right"
        }
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

function PlanSummaryCard({
  plan,
  leadId,
  acceptedAt,
}: {
  plan: SelectedPlanData;
  leadId: string;
  acceptedAt: string;
}) {
  const referenceId = formatReferenceId(leadId);
  const dateTimeLabel = formatReceiptDateTime(acceptedAt);

  return (
    <div
      className="w-full rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        background: "var(--surface-elevated)",
        boxShadow:
          "0 0 0 1px var(--border-subtle), 0 8px 28px oklch(0.24 0.06 260 / 0.07)",
      }}
    >
      {/* Approval header - shown here on desktop only; mobile shows the
          equivalent heading in the blue hero band above this card. */}
      <div className="hidden lg:flex flex-col items-center gap-2.5 px-6 pt-9 pb-6 text-center">
        <ApprovalStampBadge
          background="oklch(0.94 0.06 152)"
          ringColor="oklch(0.7 0.15 152 / 0.55)"
          iconColor="#16a34a"
        />
        <h2 className="font-display text-xl font-semibold tracking-tight leading-snug" style={{ color: "var(--text-primary)" }}>
          Your Loan Is Approved
        </h2>
        <p
          className="text-[13px] leading-relaxed max-w-[300px]"
          style={{ color: "var(--text-secondary)" }}
        >
          Review your plan details and accept the terms below to proceed.
        </p>
      </div>

      <div className="px-5 pb-6 pt-5 lg:pt-0 flex flex-col gap-4">
        {/* Meta row */}
        <div
          className="flex items-center justify-between text-[12px] font-medium"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span>{dateTimeLabel}</span>
          <span className="font-semibold tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {referenceId}
          </span>
        </div>

        {/* Loan amount highlight */}
        <div
          className="flex items-center justify-between rounded-[var(--radius-sm)] px-4 py-3.5"
          style={{ background: "oklch(0.95 0.025 258)" }}
        >
          <span className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>
            Loan amount
          </span>
          <span className="font-display text-lg font-semibold tracking-tight tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatCurrency(plan.amount)}
          </span>
        </div>

        <DashedDivider />

        {/* Key-value breakdown */}
        <div className="flex flex-col gap-3">
          <ReceiptRow label="Plan" value={plan.planTitle} />
          <ReceiptRow
            label="Loan term"
            value={`${plan.tenure} ${plan.tenure === 1 ? "month" : "months"}`}
          />
          <ReceiptRow label="Interest Rate" value={`${formatRate(plan.monthlyRate)}/month`} />
          <ReceiptRow
            label="Total amount you'll pay"
            value={formatCurrency(plan.totalRepayment)}
          />
          {plan.additionalRequests.length > 0 && (
            <ReceiptRow
              label="Additional requests"
              value={plan.additionalRequests.join(", ")}
            />
          )}
          <ReceiptRow
            label="Monthly payment (fixed)"
            value={formatCurrency(plan.monthlyInstalment)}
            emphasize
          />
        </div>
      </div>
    </div>
  );
}

// Standalone note shown between the receipt card and the acceptance steps
// below. Pulled out of PlanSummaryCard (rather than sitting inside it as
// another receipt row) so it isn't lost among the plan's line items. Framed
// with dashed dividers - echoing the receipt card's own divider style - rather
// than another boxed panel, since the rest of the page is already made up of
// boxes. Deliberately left-aligned behind an info icon, with no chevrons or
// tinted panel, so it reads as a note rather than something to tap.
function NextStepsBanner() {
  return (
    <div className="flex flex-col gap-3">
      <DashedDivider />
      <div className="flex items-start gap-2.5 px-0.5">
        <Info
          size={16}
          weight="fill"
          className="mt-[2px] shrink-0"
          style={{ color: "var(--text-tertiary)" }}
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1">
          <span
            className="text-[11px] font-bold tracking-[0.12em] uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            What happens next
          </span>
          <p className="text-[13.5px] leading-relaxed font-medium" style={{ color: "var(--text-secondary)" }}>
            Complete the three steps and signature below, then book an
            appointment to collect your funds in person.
          </p>
        </div>
      </div>
      <DashedDivider />
    </div>
  );
}

// ── Acceptance step card ──────────────────────────────────────────────────────
// Shared chrome for the three sequential "read → tick" steps below. Each step
// stays visible even while locked (so a curious reader can scan ahead) but its
// content and checkbox are dimmed and made non-interactive, mirroring the
// `disabled` treatment SignaturePad already uses for consistency.
//
// Once a step is ticked, it auto-collapses down to just its header - like an
// FAQ accordion - so the page shrinks as the customer works through the list
// instead of staying at full height. The header remains clickable so the
// customer can re-expand and review anything they've already read.

function AcceptanceStepCard({
  step,
  totalSteps,
  icon,
  iconBg,
  title,
  titleAccessory,
  subtitle,
  locked,
  checked,
  onToggle,
  checkboxLabel,
  children,
}: {
  step: number;
  totalSteps: number;
  icon: ReactNode;
  iconBg: string;
  title: string;
  /** Optional small logo/badge rendered inline beside the title, e.g. PayNow's mark for the disbursement step. */
  titleAccessory?: ReactNode;
  subtitle: string;
  locked: boolean;
  checked: boolean;
  /** Omit both to let the step's own content drive completion (see step 1). */
  onToggle?: () => void;
  checkboxLabel?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const wasCheckedRef = useRef(checked);

  // Collapse shortly after ticking (so the checkmark lands first), and
  // re-expand automatically if the customer unticks the box to revisit it.
  useEffect(() => {
    if (checked && !wasCheckedRef.current) {
      const timeout = setTimeout(() => setExpanded(false), STEP_COLLAPSE_DELAY_MS);
      wasCheckedRef.current = checked;
      return () => clearTimeout(timeout);
    }
    if (!checked && wasCheckedRef.current) {
      setExpanded(true);
    }
    wasCheckedRef.current = checked;
  }, [checked]);

  // Collapsing is only meaningful once the customer has actually accepted
  // this step - before that there's nothing to hide, so no chevron and the
  // header isn't clickable yet.
  const canToggle = checked && !locked;
  const showContent = locked || !checked || expanded;

  return (
    <div
      className="w-full rounded-[var(--radius-lg)] overflow-hidden transition-shadow duration-300"
      style={{
        background: "var(--surface-elevated)",
        boxShadow: checked
          ? "0 0 0 1.5px #16a34a"
          : "0 0 0 1px var(--border-subtle)",
      }}
    >
      <button
        type="button"
        onClick={() => canToggle && setExpanded((v) => !v)}
        aria-expanded={showContent}
        disabled={!canToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left disabled:cursor-default"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: iconBg }}
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className="text-[10px] font-bold tracking-[0.14em] uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            Step {step} of {totalSteps}
          </span>
          {/* Logo is centered against title + subtitle only (not the step
              eyebrow above), so it reads as part of that label pair. */}
          <span className="flex items-center gap-2">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {title}
              </span>
              <span className="text-[12.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>
                {subtitle}
              </span>
            </span>
            {titleAccessory && <span className="shrink-0">{titleAccessory}</span>}
          </span>
        </span>
        {checked && (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{ background: "#16a34a" }}
            aria-hidden="true"
          >
            <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
              <path
                d="M1 4L4 7L10 1"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
        {canToggle && (
          <CaretDown
            size={14}
            weight="bold"
            className="shrink-0"
            style={{
              color: "var(--text-tertiary)",
              transform: showContent ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease",
            }}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {showContent && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: STEP_COLLAPSE_DURATION_MS / 1000, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="px-5 pb-4 pt-1 flex flex-col gap-4 transition-opacity duration-300"
              style={{
                opacity: locked ? 0.45 : 1,
                pointerEvents: locked ? "none" : "auto",
              }}
            >
              {children}

              {checkboxLabel && onToggle && (
                <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <AgreeCheckbox checked={checked} onToggle={onToggle} label={checkboxLabel} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Step 1: loan terms ────────────────────────────────────────────────────────
// Rather than a wall of legal text under one blanket "I agree", the three
// facts that actually change what the customer has to do are surfaced as
// individual confirmations. The step only completes - and the card only
// collapses - once all three are ticked; everything else stays available as
// fine print behind a disclosure.

// Fine print is capped to a scrollable window (matching the payment schedule
// below) so opening it doesn't push the CTA far down the page.
const FINE_PRINT_MAX_HEIGHT_PX = 260;

/** One headline fact, confirmed with a tap. Reuses `AgreeCheckbox`'s tinted
 * panel and left accent bar so a confirmed point looks the same wherever it
 * appears on this page.
 *
 * Confirmation is one-way: this is a statement the customer is making about a
 * loan agreement, so it shouldn't be something they can quietly take back. The
 * button disables itself once confirmed. */
function KeyTermAckRow({
  icon,
  title,
  terms,
  checked,
  onConfirm,
}: {
  icon: ReactNode;
  title: string;
  terms: readonly string[];
  checked: boolean;
  onConfirm: () => void;
}) {
  const accentColor = checked ? "#16a34a" : "var(--brand-blue-hex, #0033AA)";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-readonly={checked}
      disabled={checked}
      onClick={onConfirm}
      className="flex w-full items-start gap-3 rounded-[var(--radius-sm)] px-4 py-3.5 text-left transition-colors duration-300 disabled:cursor-default"
      style={{
        background: checked ? "oklch(0.95 0.05 152)" : "oklch(0.95 0.03 258)",
        borderLeft: `4px solid ${accentColor}`,
      }}
    >
      <span
        className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all duration-150"
        style={{
          border: `2px solid ${accentColor}`,
          background: checked ? accentColor : "transparent",
        }}
        aria-hidden="true"
      >
        {checked && (
          <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
            <path
              d="M1 4L4 7L10 1"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Titles can wrap to two lines, so the icon is pinned to the first
            line rather than centred across the whole block. */}
        <span className="flex items-start gap-1.5">
          <span className="mt-[3px] shrink-0" style={{ color: accentColor }} aria-hidden="true">
            {icon}
          </span>
          <span className="text-sm font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
            {title}
          </span>
        </span>
        {/* Bullets are spans rather than a real list: a <ul> isn't valid
            inside a <button>, and the whole panel needs to stay tappable. */}
        <span className="flex flex-col gap-1.5">
          {terms.map((term) => (
            <span key={term} className="flex items-start gap-2">
              <span
                className="mt-[7px] h-1 w-1 shrink-0 rounded-full transition-colors duration-300"
                style={{ background: checked ? "#16a34a" : "var(--text-tertiary)" }}
                aria-hidden="true"
              />
              <span
                className="text-[13px] leading-relaxed font-medium transition-colors duration-300"
                style={{ color: checked ? "var(--text-tertiary)" : "var(--text-secondary)" }}
              >
                {term}
              </span>
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

/** Mounted only while the disclosure is open, so the scroll-hint hook measures
 * a list that's actually in the DOM. */
function FinePrintList() {
  const listRef = useRef<HTMLUListElement>(null);
  const canScrollMore = useCanScrollMore(listRef);

  return (
    <div className="relative pt-3">
      <ul
        ref={listRef}
        className="flex flex-col gap-3 overflow-y-auto pr-1 pb-6"
        style={{ maxHeight: FINE_PRINT_MAX_HEIGHT_PX }}
      >
        {FINE_PRINT_ITEMS.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
              style={{
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
              }}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <p className="text-[13px] leading-relaxed font-medium" style={{ color: "var(--text-secondary)" }}>
              {item}
            </p>
          </li>
        ))}
      </ul>
      <ScrollForMoreHint visible={canScrollMore} />
    </div>
  );
}

function FinePrintDisclosure() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          Full terms and conditions
        </span>
        <CaretDown
          size={13}
          weight="bold"
          className="shrink-0"
          style={{
            color: "var(--text-tertiary)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="fine-print"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <FinePrintList />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoanTermsStepContent({
  acks,
  onConfirmAck,
}: {
  acks: Record<KeyTermAckKey, boolean>;
  onConfirmAck: (key: KeyTermAckKey) => void;
}) {
  const confirmedCount = KEY_TERM_ACKS.filter(({ key }) => acks[key]).length;
  const allConfirmed = confirmedCount === KEY_TERM_ACK_COUNT;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--text-secondary)" }}>
          {allConfirmed
            ? "All terms accepted."
            : "Tap each point to confirm. Confirmations are final."}
        </p>
        <span
          className="shrink-0 text-[11px] font-bold tabular-nums tracking-[0.06em]"
          style={{ color: allConfirmed ? "#16a34a" : "var(--text-tertiary)" }}
        >
          {confirmedCount}/{KEY_TERM_ACK_COUNT}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {KEY_TERM_ACKS.map(({ key, Icon, title, terms }) => (
          <KeyTermAckRow
            key={key}
            icon={<Icon size={15} weight="duotone" />}
            title={title}
            terms={terms}
            checked={acks[key]}
            onConfirm={() => onConfirmAck(key)}
          />
        ))}
      </div>

      <p className="text-[13px] leading-relaxed font-medium" style={{ color: "var(--text-secondary)" }}>
        {TC_CLOSING}
      </p>

      <FinePrintDisclosure />
    </>
  );
}

// ── Step 2: payment schedule ──────────────────────────────────────────────────
// Full monthly due-date/amount breakdown, anchored to today (the assumed
// disbursement date) per the loan's tenure. Capped to a scrollable window once
// it grows past a handful of rows so a 12-month plan doesn't turn the page
// into an endless list.

/** One row of the schedule - a numbered badge (matching the T&C list's badge
 * exactly) plus an instalment label, a muted due-date subline, and the
 * amount, all set at the same type sizes already used elsewhere on this
 * page (`TC_ITEMS`, `ReceiptRow`) rather than introducing new one-off sizes. */
function ScheduleRow({ index, dueDateIso, amount }: { index: number; dueDateIso: string; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
          style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}
          aria-hidden="true"
        >
          {index}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
            Instalment {index}
          </span>
          <span className="text-[12px] font-medium" style={{ color: "var(--text-tertiary)" }}>
            Due {formatScheduleDate(dueDateIso)}
          </span>
        </span>
      </div>
      <span className="text-[13.5px] font-semibold tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function PaymentScheduleStepContent({
  plan,
  acceptedAt,
}: {
  plan: SelectedPlanData;
  acceptedAt: string;
}) {
  const schedule = buildPaymentSchedule(acceptedAt, plan.tenure, plan.monthlyInstalment);
  const isScrollable = schedule.length > 4;
  const scheduleRef = useRef<HTMLDivElement>(null);
  const canScrollMore = useCanScrollMore(scheduleRef);

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
          Your {plan.tenure}-month schedule
        </p>
        <p className="text-[13px] leading-relaxed font-medium" style={{ color: "var(--text-secondary)" }}>
          Assuming disbursement date: {formatScheduleDate(acceptedAt)}
        </p>
      </div>

      <div className="relative">
        <div
          ref={scheduleRef}
          className={isScrollable ? "flex flex-col gap-3 overflow-y-auto pr-1 pb-6" : "flex flex-col gap-3"}
          style={isScrollable ? { maxHeight: 224 } : undefined}
        >
          {schedule.map((installment) => (
            <ScheduleRow
              key={installment.index}
              index={installment.index}
              dueDateIso={installment.dueDateIso}
              amount={installment.amount}
            />
          ))}
        </div>
        {isScrollable && <ScrollForMoreHint visible={canScrollMore} />}
      </div>

      <DashedDivider />

      <ReceiptRow label="Total repayment" value={formatCurrency(plan.totalRepayment)} emphasize />

      <p className="text-[13px] leading-relaxed font-medium" style={{ color: "var(--text-secondary)" }}>
        The actual repayment dates may change depending on your actual loan
        disbursement date and plan accepted.
      </p>
    </>
  );
}

// ── Step 3: funds disbursement ────────────────────────────────────────────────

function FundsDisbursementStepContent() {
  return (
    <ul className="flex flex-col gap-3">
      {DISBURSEMENT_NOTICE_ITEMS.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span
            className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <p className="text-[13px] leading-relaxed font-medium" style={{ color: "var(--text-primary)" }}>
            {item}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ── Agree checkbox ────────────────────────────────────────────────────────────

// A brand-blue tinted panel with a colored left accent bar - the same visual
// language used for "action needed" callouts - flips to a green tint once
// ticked. Bolder than the surrounding text without resorting to a jarring
// full black/white reversal, so it still reads as an intentional accent
// within the page's palette rather than a UI element from a different app.
function AgreeCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  const accentColor = checked ? "#16a34a" : "var(--brand-blue-hex, #0033AA)";

  return (
    <label
      className="flex items-center gap-3 cursor-pointer select-none rounded-[var(--radius-sm)] py-3.5 pl-4 pr-4 transition-colors duration-300"
      style={{
        background: checked ? "oklch(0.95 0.05 152)" : "oklch(0.95 0.03 258)",
        borderLeft: `4px solid ${accentColor}`,
      }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all duration-150"
        style={{
          border: `2px solid ${accentColor}`,
          background: checked ? accentColor : "transparent",
        }}
      >
        {checked && (
          <svg width="11" height="8" viewBox="0 0 11 8" fill="none" aria-hidden="true">
            <path
              d="M1 4L4 7L10 1"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <span className="text-sm leading-snug font-semibold" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
    </label>
  );
}

// ── Appointment reminder modal ────────────────────────────────────────────────
// Shown once, right before leaving for the booking step, so the customer
// isn't surprised by an in-person requirement after they've already
// committed to signing. Kept short and single-purpose - one fact (how long
// it takes), one reason (why it's required by law), one way out (acknowledge
// and continue) - rather than restating everything already covered in step 1.

function AppointmentReminderModal({
  onAcknowledge,
}: {
  onAcknowledge: () => void;
}) {
  // Lock page scroll while the modal is up so the blurred backdrop doesn't
  // shift under the customer's thumb.
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div
      className="theme-ios fixed inset-0 z-[200] flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appointment-reminder-title"
      aria-describedby="appointment-reminder-description"
    >
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="relative w-full max-w-[360px] rounded-[20px] bg-[var(--surface-elevated)] px-6 pb-7 pt-8 shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
      >
        <div className="flex flex-col items-center text-center">
          <AnimatedIconBadge background="oklch(0.32 0.14 260 / 0.12)" ringColor="var(--brand-blue-hex, #0033AA)">
            <Buildings size={26} weight="fill" style={{ color: "var(--brand-blue-hex, #0033AA)" }} />
          </AnimatedIconBadge>
          <h2 id="appointment-reminder-title" className="mt-5 flex flex-col items-center gap-0.5">
            <span
              className="text-[20px] font-bold leading-tight tracking-[-0.02em]"
              style={{ color: "var(--text-primary)" }}
            >
              Next step
            </span>
            <span className="text-[14.5px] font-semibold leading-snug" style={{ color: "var(--text-secondary)" }}>
              Book your appointment
            </span>
          </h2>
          <div
            className="mt-3 flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{ background: "oklch(0.95 0.03 258)" }}
          >
            <Clock size={13} weight="bold" style={{ color: "var(--brand-blue-hex, #0033AA)" }} />
            <span className="text-[12.5px] font-bold" style={{ color: "var(--brand-blue-hex, #0033AA)" }}>
              Takes around 30 minutes
            </span>
          </div>
          {/* Split into short, scannable statements rather than one dense
              paragraph - each line is a single fact the customer can absorb
              at a glance. */}
          <div id="appointment-reminder-description" className="mt-3 flex flex-col gap-1.5">
            <p className="text-[14px] leading-snug" style={{ color: "var(--text-secondary)" }}>
              You&apos;ll collect your funds physically at our office.
            </p>
            <p className="text-[14px] leading-snug" style={{ color: "var(--text-secondary)" }}>
              This is required by Know-Your-Customer (KYC) and Anti-Money
              Laundering (AML) regulations.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAcknowledge}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-blue text-[15px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
        >
          <ShieldCheck size={16} weight="bold" />
          I understand
        </button>
      </motion.div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface AcceptViewProps {
  plan: SelectedPlanData;
  leadId: string;
  /** ISO timestamp captured server-side so SSR and hydration render identical text. */
  acceptedAt: string;
}

export function AcceptView({ plan, leadId, acceptedAt }: AcceptViewProps) {
  const router = useRouter();
  // Step 1 has no single "I agree" box - it completes only once every key term
  // has been confirmed individually, and each confirmation is one-way.
  const [termAcks, setTermAcks] = useState<Record<KeyTermAckKey, boolean>>({
    collectInPerson: false,
    drawdownWindow: false,
    lateCharges: false,
  });
  const [checks, setChecks] = useState({
    repaySchedule: false,
    paynowNric: false,
  });
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showAppointmentReminder, setShowAppointmentReminder] = useState(false);
  const hasAcceptedTerms = KEY_TERM_ACKS.every(({ key }) => termAcks[key]);
  const allChecked = hasAcceptedTerms && checks.repaySchedule && checks.paynowNric;
  const canProceed = allChecked && signatureDataUrl !== null;

  function toggleCheck(key: keyof typeof checks) {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function confirmTermAck(key: KeyTermAckKey) {
    setTermAcks((prev) => ({ ...prev, [key]: true }));
  }

  // Guides the reader down the page as each step unlocks: tick a box and the
  // next step (or the signature pad, once all three are ticked) glides into
  // view instead of requiring a manual scroll.
  const scheduleStepRef = useRef<HTMLDivElement>(null);
  const disbursementStepRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasAcceptedTerms) return;
    const timeout = setTimeout(
      () => scrollStepIntoView(scheduleStepRef.current),
      SCROLL_TO_NEXT_STEP_DELAY_MS,
    );
    return () => clearTimeout(timeout);
  }, [hasAcceptedTerms]);

  useEffect(() => {
    if (!checks.repaySchedule) return;
    const timeout = setTimeout(
      () => scrollStepIntoView(disbursementStepRef.current),
      SCROLL_TO_NEXT_STEP_DELAY_MS,
    );
    return () => clearTimeout(timeout);
  }, [checks.repaySchedule]);

  useEffect(() => {
    if (!checks.paynowNric) return;
    const timeout = setTimeout(
      () => scrollStepIntoView(signatureRef.current),
      SCROLL_TO_NEXT_STEP_DELAY_MS,
    );
    return () => clearTimeout(timeout);
  }, [checks.paynowNric]);

  return (
    <ApplyIosShell
      sidebarTitle="Confirm your loan terms"
      sidebarSubtitle="Review your selected plan and accept the loan terms to secure your funds."
      progressStep={APPLY_PROGRESS.confirmTerms}
    >
      <div className="shrink-0 px-5 pb-6 pt-7">
        <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.022em] text-[var(--text-primary)]">
          Confirm your loan terms
        </h1>
        <p className="mt-1.5 text-[17px] leading-[1.4] text-[var(--text-secondary)]">
          Review your plan details and accept the terms below to proceed.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 pb-8">
              {/* Plan summary card - carries the page's heading and subtitle */}
              <PlanSummaryCard plan={plan} leadId={leadId} acceptedAt={acceptedAt} />

              {/* Next steps - standalone banner so it reads as an instruction
                  rather than another line item inside the receipt card */}
              <NextStepsBanner />

              {/* Step 1: loan terms */}
              <AcceptanceStepCard
                step={1}
                totalSteps={3}
                icon={<ListChecks size={16} weight="duotone" style={{ color: "var(--brand-blue-hex, #0033AA)" }} />}
                iconBg="oklch(0.32 0.14 260 / 0.08)"
                title="Loan acceptance terms"
                subtitle={`${KEY_TERM_ACK_COUNT} key points to confirm`}
                locked={false}
                checked={hasAcceptedTerms}
              >
                <LoanTermsStepContent acks={termAcks} onConfirmAck={confirmTermAck} />
              </AcceptanceStepCard>

              {/* Step 2: payment schedule — unlocks once terms are ticked */}
              <div ref={scheduleStepRef}>
                <AcceptanceStepCard
                  step={2}
                  totalSteps={3}
                  icon={<CalendarCheck size={16} weight="duotone" style={{ color: "var(--brand-blue-hex, #0033AA)" }} />}
                  iconBg="oklch(0.32 0.14 260 / 0.08)"
                  title="Payment schedule"
                  subtitle="Your monthly due dates and amounts"
                  locked={!hasAcceptedTerms}
                  checked={checks.repaySchedule}
                  onToggle={() => toggleCheck("repaySchedule")}
                  checkboxLabel="I agree to repay as per the payment schedule stated above"
                >
                  <PaymentScheduleStepContent plan={plan} acceptedAt={acceptedAt} />
                </AcceptanceStepCard>
              </div>

              {/* Step 3: funds disbursement — unlocks once the schedule is ticked */}
              <div ref={disbursementStepRef}>
                <AcceptanceStepCard
                  step={3}
                  totalSteps={3}
                  icon={<CurrencyCircleDollar size={16} weight="duotone" style={{ color: "#0d9488" }} />}
                  iconBg="oklch(0.7 0.13 178 / 0.14)"
                  title="Funds disbursement method"
                  titleAccessory={
                    <Image
                      src="/images/paynow-logo.png"
                      alt="PayNow"
                      width={228}
                      height={148}
                      className="h-9 w-auto"
                    />
                  }
                  subtitle="How your loan will be paid out"
                  locked={!checks.repaySchedule}
                  checked={checks.paynowNric}
                  onToggle={() => toggleCheck("paynowNric")}
                  checkboxLabel="I acknowledge that my paynow is linked to my NRIC number to have the funds disbursed to me"
                >
                  <FundsDisbursementStepContent />
                </AcceptanceStepCard>
              </div>

              {/* Signature — the closing act of the contract, unlocked once all boxes are ticked */}
              <div ref={signatureRef}>
                <SignaturePad
                  disabled={!allChecked}
                  onSigned={(dataUrl) => setSignatureDataUrl(dataUrl)}
                  onCleared={() => setSignatureDataUrl(null)}
                />
              </div>

              {/* CTA - opens the appointment reminder first; navigation only
                  happens once the customer acknowledges it below. */}
              <button
                type="button"
                disabled={!canProceed}
                onClick={() => setShowAppointmentReminder(true)}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-blue text-[15px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                Next: Get your funds
                <ArrowRight size={16} weight="bold" />
              </button>

              {!canProceed && (
                <p
                  className="text-center text-[11px] -mt-2"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {allChecked
                    ? "Please sign above to continue."
                    : "Please complete all three steps and sign above to continue."}
                </p>
              )}
      </div>

      <AnimatePresence>
        {showAppointmentReminder && (
          <AppointmentReminderModal
            onAcknowledge={() => router.push("/apply/book")}
          />
        )}
      </AnimatePresence>
    </ApplyIosShell>
  );
}
