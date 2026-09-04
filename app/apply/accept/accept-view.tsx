"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { Transition } from "motion/react";
import {
  ArrowRight,
  Buildings,
  CaretDown,
  Clock,
  Info,
  SealCheck,
  ShieldCheck,
} from "@phosphor-icons/react";

import { ApplyIosShell, StickyFooter } from "@/app/apply-gate/ios-ui";
import { useApplyStepNav } from "@/app/apply-gate/use-apply-step-nav";
import { APPLY_PROGRESS, applyProgressAlong } from "@/lib/apply-progress";
import { AnimatedIconBadge } from "@/app/animated-icon-badge";
import { SignaturePad } from "./signature-pad";
import { TermsDeck } from "./terms-deck";
import { FINE_PRINT_ITEMS, TC_CLOSING } from "./accept-content";
import {
  CARD_SHADOW,
  DashedDivider,
  NumberBadge,
  ReceiptRow,
  SUCCESS_GREEN,
  ScrollForMoreHint,
  formatCurrency,
  formatRate,
  formatReceiptDateTime,
  formatReferenceId,
  scrollSectionIntoView,
  useCanScrollMore,
} from "./accept-ui";
import type { SelectedPlanData } from "./page";

const REVEAL_TRANSITION: Transition = { duration: 0.2, ease: "easeOut" };
const COLLAPSE_TRANSITION: Transition = { duration: 0.25, ease: "easeInOut" };
// Each reveal waits for the block it replaces to finish animating out, so the
// page never scrolls to a position the transition then invalidates.
const DECK_REVEAL_SCROLL_MS = 520;
const SIGNATURE_REVEAL_SCROLL_MS = 620;

// Fine print is capped to a scrollable window so opening it doesn't push the
// signature and CTA far down the page.
const FINE_PRINT_MAX_HEIGHT_PX = 260;

// ── Approval stamp badge ─────────────────────────────────────────────────────
// Mimics a rubber stamp hitting paper: the badge drops in with a rotational
// overshoot, an ink-ring ripples outward on impact, and the seal briefly
// squashes before settling - all in one short, unobtrusive burst on mount.

function ApprovalStampBadge() {
  return (
    <AnimatedIconBadge
      background="oklch(0.94 0.06 152)"
      ringColor="oklch(0.7 0.15 152 / 0.55)"
    >
      <SealCheck size={28} weight="fill" style={{ color: SUCCESS_GREEN }} />
    </AnimatedIconBadge>
  );
}

// ── Plan summary card ─────────────────────────────────────────────────────────
// The receipt for the plan the customer picked. It opens at full height while
// they're still reading it, then folds down to a single headline row once they
// start confirming terms, so the deck below gets the screen. The row stays
// tappable - the figures they're agreeing to should never be more than one tap
// away.

function PlanSummaryCard({
  plan,
  leadId,
  acceptedAt,
  collapsible,
  expanded,
  onToggle,
}: {
  plan: SelectedPlanData;
  leadId: string;
  acceptedAt: string;
  collapsible: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const referenceId = formatReferenceId(leadId);
  const dateTimeLabel = formatReceiptDateTime(acceptedAt);

  return (
    <div
      className="w-full rounded-[var(--radius-lg)] overflow-hidden"
      style={{ background: "var(--surface-elevated)", boxShadow: CARD_SHADOW }}
    >
      {collapsible && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full items-center gap-3 px-5 py-4 text-left"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "oklch(0.94 0.06 152)" }}
          >
            <SealCheck size={17} weight="fill" style={{ color: SUCCESS_GREEN }} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              className="text-[10px] font-bold tracking-[0.14em] uppercase"
              style={{ color: "var(--text-tertiary)" }}
            >
              Your approved loan
            </span>
            <span
              className="text-[13px] font-bold leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {formatCurrency(plan.amount)} &middot; {plan.tenure} months &middot;{" "}
              {formatCurrency(plan.monthlyInstalment)}/mo
            </span>
          </span>
          <CaretDown
            size={14}
            weight="bold"
            className="shrink-0"
            style={{
              color: "var(--text-tertiary)",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease",
            }}
          />
        </button>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="receipt"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={COLLAPSE_TRANSITION}
            style={{ overflow: "hidden" }}
          >
            {/* Approval header - shown here on desktop only; mobile shows the
                equivalent heading in the blue hero band above this card. Once
                the header row above takes over, this would just be a second
                heading for the same card. */}
            {!collapsible && (
              <div className="hidden lg:flex flex-col items-center gap-2.5 px-6 pt-9 pb-6 text-center">
                <ApprovalStampBadge />
                <h2
                  className="font-display text-xl font-semibold tracking-tight leading-snug"
                  style={{ color: "var(--text-primary)" }}
                >
                  Your Loan Is Approved
                </h2>
                <p
                  className="text-[13px] leading-relaxed max-w-[300px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Review and accept your terms below.
                </p>
              </div>
            )}

            <div
              className={
                collapsible
                  ? "px-5 pb-6 pt-1 flex flex-col gap-4"
                  : "px-5 pb-6 pt-5 lg:pt-0 flex flex-col gap-4"
              }
            >
              {/* Meta row */}
              <div
                className="flex items-center justify-between text-[12px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                <span>{dateTimeLabel}</span>
                <span
                  className="font-semibold tabular-nums"
                  style={{ color: "var(--text-secondary)" }}
                >
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
                <span
                  className="font-display text-lg font-semibold tracking-tight tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Standalone note shown between the receipt card and the confirm button.
// Pulled out of PlanSummaryCard (rather than sitting inside it as another
// receipt row) so it isn't lost among the plan's line items. Framed with
// dashed dividers - echoing the receipt card's own divider style - rather than
// another boxed panel, since the rest of the page is already made up of boxes.
// Deliberately left-aligned behind an info icon, with no chevrons or tinted
// panel, so it reads as a note rather than something to tap.
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
            style={{ color: "var(--text-primary)" }}
          >
            What happens next
          </span>
          <p
            className="text-[13.5px] leading-relaxed font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Read and agree to the important terms, then sign to accept.
          </p>
        </div>
      </div>
      <DashedDivider />
    </div>
  );
}

// ── Fine print ────────────────────────────────────────────────────────────────
// Everything the customer isn't asked to confirm card by card. It sits below
// the deck rather than inside a card so the complete terms stay on the page for
// the whole flow, not just while one particular step is open.

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
        {FINE_PRINT_ITEMS.map((item, index) => (
          <li key={item} className="flex items-start gap-2.5">
            <span className="mt-[3px]">
              <NumberBadge value={index + 1} />
            </span>
            <p
              className="text-[13px] leading-relaxed font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {item}
            </p>
          </li>
        ))}
      </ul>
      <ScrollForMoreHint visible={canScrollMore} />
    </div>
  );
}

function TermsFootnoteCard() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 px-0.5">
      <DashedDivider />
      <p
        className="text-[13px] leading-relaxed font-medium"
        style={{ color: "var(--text-tertiary)" }}
      >
        {TC_CLOSING}
      </p>

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span
          className="text-[13px] font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Full terms and conditions
        </span>
        <CaretDown
          size={13}
          weight="bold"
          className="shrink-0"
          style={{
            color: "var(--text-tertiary)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
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

// ── Appointment reminder modal ────────────────────────────────────────────────
// Shown once, right before leaving for the booking step, so the customer
// isn't surprised by an in-person requirement after they've already
// committed to signing. Kept short and single-purpose - one fact (how long
// it takes), one reason (why it's required by law), one way out (acknowledge
// and continue) - rather than restating everything already covered in the deck.

function AppointmentReminderModal({ onAcknowledge }: { onAcknowledge: () => void }) {
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
          <AnimatedIconBadge
            background="oklch(0.32 0.14 260 / 0.12)"
            ringColor="var(--brand-blue-hex, #0033AA)"
          >
            <Buildings size={26} weight="fill" style={{ color: "var(--brand-blue-hex, #0033AA)" }} />
          </AnimatedIconBadge>
          <h2 id="appointment-reminder-title" className="mt-5 flex flex-col items-center gap-0.5">
            <span
              className="text-[20px] font-bold leading-tight tracking-[-0.02em]"
              style={{ color: "var(--text-primary)" }}
            >
              Next step
            </span>
            <span
              className="text-[14.5px] font-semibold leading-snug"
              style={{ color: "var(--text-secondary)" }}
            >
              Book your appointment
            </span>
          </h2>
          <div
            className="mt-3 flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{ background: "oklch(0.95 0.03 258)" }}
          >
            <Clock size={13} weight="bold" style={{ color: "var(--brand-blue-hex, #0033AA)" }} />
            <span
              className="text-[12.5px] font-bold"
              style={{ color: "var(--brand-blue-hex, #0033AA)" }}
            >
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
  const stepNav = useApplyStepNav("accept");

  // The page moves through three states, each of which hands its space to the
  // next: read the receipt, work through the terms deck, sign. Only one of
  // them is ever expanded, which is what keeps this on a single screen.
  const [hasStartedTerms, setHasStartedTerms] = useState(false);
  const [isPlanExpanded, setIsPlanExpanded] = useState(true);
  const [hasConfirmedTerms, setHasConfirmedTerms] = useState(false);
  const [termsConfirmed, setTermsConfirmed] = useState(0);
  const [termsTotal, setTermsTotal] = useState(0);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showAppointmentReminder, setShowAppointmentReminder] = useState(false);

  const handleTermsProgress = useCallback((confirmed: number, total: number) => {
    setTermsConfirmed(confirmed);
    setTermsTotal(total);
  }, []);

  const progressStep = useMemo(() => {
    if (termsTotal <= 0 || termsConfirmed <= 0) return APPLY_PROGRESS.confirmTerms;
    return applyProgressAlong(
      APPLY_PROGRESS.confirmTerms,
      APPLY_PROGRESS.book,
      (termsConfirmed / termsTotal) * 0.9,
    );
  }, [termsConfirmed, termsTotal]);

  const canProceed = hasConfirmedTerms && signatureDataUrl !== null;

  const deckRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasStartedTerms) return;
    const timeout = setTimeout(
      () => scrollSectionIntoView(deckRef.current),
      DECK_REVEAL_SCROLL_MS,
    );
    return () => clearTimeout(timeout);
  }, [hasStartedTerms]);

  useEffect(() => {
    if (!hasConfirmedTerms) return;
    const timeout = setTimeout(
      () => scrollSectionIntoView(signatureRef.current),
      SIGNATURE_REVEAL_SCROLL_MS,
    );
    return () => clearTimeout(timeout);
  }, [hasConfirmedTerms]);

  function startTerms() {
    setHasStartedTerms(true);
    setIsPlanExpanded(false);
  }

  return (
    <ApplyIosShell
      sidebarTitle="Confirm your loan terms"
      sidebarSubtitle="Review your selected plan and accept the loan terms to secure your funds."
      progressStep={progressStep}
    >
      <div className="shrink-0 px-5 pb-6 pt-7">
        <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.022em] text-[var(--text-primary)]">
          Confirm loan terms
        </h1>
        <p className="mt-1.5 text-[17px] leading-[1.4] text-[var(--text-secondary)]">
          Review and accept your terms below.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 pb-8">
        <PlanSummaryCard
          plan={plan}
          leadId={leadId}
          acceptedAt={acceptedAt}
          collapsible={hasStartedTerms}
          expanded={!hasStartedTerms || isPlanExpanded}
          onToggle={() => setIsPlanExpanded((value) => !value)}
        />

        <AnimatePresence mode="wait" initial={false}>
          {hasStartedTerms ? (
            <motion.div
              key="deck"
              className="flex flex-col gap-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={REVEAL_TRANSITION}
            >
              <div ref={deckRef}>
                <TermsDeck
                  plan={plan}
                  acceptedAt={acceptedAt}
                  onComplete={() => setHasConfirmedTerms(true)}
                  onConfirmedCountChange={handleTermsProgress}
                />
              </div>
              {!hasConfirmedTerms && <TermsFootnoteCard />}
            </motion.div>
          ) : (
            <motion.div
              key="intro"
              className="flex flex-col gap-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={REVEAL_TRANSITION}
            >
              <NextStepsBanner />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Signature and the CTA stay out of the way until there's something
            to sign for - the closing act of the contract, not a disabled
            control the customer has to scroll past five times. */}
        <AnimatePresence initial={false}>
          {hasConfirmedTerms && (
            <motion.div
              key="signature"
              className="flex flex-col gap-5"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <div ref={signatureRef}>
                <SignaturePad
                  onSigned={(dataUrl) => setSignatureDataUrl(dataUrl)}
                  onCleared={() => setSignatureDataUrl(null)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Anchored to the bottom rather than sitting inline, like every other
          terminal CTA in the apply funnel - null children while the deck is
          active hides the bar entirely, handing that space back to the
          cards being swiped through. */}
      <StickyFooter nav={stepNav}>
        {hasConfirmedTerms ? (
          <div className="flex flex-col gap-2">
            {!canProceed && (
              <p className="text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                Please sign above to continue.
              </p>
            )}
            {/* Opens the appointment reminder first; navigation only happens
                once the customer acknowledges it below. */}
            <button
              type="button"
              disabled={!canProceed}
              onClick={() => setShowAppointmentReminder(true)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-blue text-[15px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
            >
              Next: Get your funds
              <ArrowRight size={16} weight="bold" />
            </button>
          </div>
        ) : !hasStartedTerms ? (
          <button
            type="button"
            onClick={startTerms}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-blue text-[15px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            Confirm loan terms
            <ArrowRight size={16} weight="bold" />
          </button>
        ) : null}
      </StickyFooter>

      <AnimatePresence>
        {showAppointmentReminder && (
          <AppointmentReminderModal onAcknowledge={() => router.push("/apply/book")} />
        )}
      </AnimatePresence>
    </ApplyIosShell>
  );
}
