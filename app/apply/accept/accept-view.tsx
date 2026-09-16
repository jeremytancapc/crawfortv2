"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { Transition } from "motion/react";
import {
  ArrowRight,
  Buildings,
  CaretDown,
  Clock,
  SealCheck,
  ShieldCheck,
} from "@phosphor-icons/react";

import { ApplyIosShell, StickyFooter } from "@/app/apply-gate/ios-ui";
import { useApplyStepNav } from "@/app/apply-gate/use-apply-step-nav";
import { APPLY_PROGRESS, applyProgressAlong } from "@/lib/apply-progress";
import { AnimatedIconBadge } from "@/app/animated-icon-badge";
import { SignaturePad } from "./signature-pad";
import { TermsDeck, type TermsDeckHandle } from "./terms-deck";
import { FINE_PRINT_ITEMS } from "./accept-content";
import { useApplyPath } from "@/app/use-apply-path";
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
const SIGNATURE_REVEAL_SCROLL_MS = 620;

// Fine print is capped to a scrollable window so opening it doesn't push the
// signature and CTA far down the page.
const FINE_PRINT_MAX_HEIGHT_PX = 260;

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
      className="w-full overflow-hidden rounded-[var(--radius-lg)]"
      style={{ background: "var(--surface-elevated)", boxShadow: CARD_SHADOW }}
    >
      {collapsible && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full items-center gap-3.5 px-5 py-5 text-left"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: "oklch(0.94 0.06 152)" }}
          >
            <SealCheck size={22} weight="fill" style={{ color: SUCCESS_GREEN }} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span
              className="text-[13px] font-bold tracking-[0.12em] uppercase"
              style={{ color: "var(--text-tertiary)" }}
            >
              Your approved loan
            </span>
            <span
              className="text-[16px] font-bold leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {formatCurrency(plan.amount)} &middot; {plan.tenure} months &middot;{" "}
              {formatCurrency(plan.monthlyInstalment)}/mo
            </span>
          </span>
          <CaretDown
            size={16}
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
            style={{ overflow: collapsible ? "hidden" : "visible" }}
          >
            {!collapsible && (
              <div className="deck-card-banner relative isolate h-[88px] overflow-hidden">
                <div
                  aria-hidden
                  className="deck-card-watermark deck-card-watermark--approved pointer-events-none"
                >
                  <svg
                    viewBox="0 0 256 256"
                    width={200}
                    height={200}
                    className="deck-card-watermark-mark"
                  >
                    <g className="deck-card-watermark-spin">
                      <path
                        fill="currentColor"
                        d="M240,128c0,10.44-7.51,18.27-14.14,25.18-3.77,3.94-7.67,8-9.14,11.57-1.36,3.27-1.44,8.69-1.52,13.94-.15,9.76-.31,20.82-8,28.51s-18.75,7.85-28.51,8c-5.25.08-10.67.16-13.94,1.52-3.57,1.47-7.63,5.37-11.57,9.14C146.27,232.49,138.44,240,128,240s-18.27-7.51-25.18-14.14c-3.94-3.77-8-7.67-11.57-9.14-3.27-1.36-8.69-1.44-13.94-1.52-9.76-.15-20.82-.31-28.51-8s-7.85-18.75-8-28.51c-.08-5.25-.16-10.67-1.52-13.94-1.47-3.57-5.37-7.63-9.14-11.57C23.51,146.27,16,138.44,16,128s7.51-18.27,14.14-25.18c3.77-3.94,7.67-8,9.14-11.57,1.36-3.27,1.44-8.69,1.52-13.94.15-9.76.31-20.82,8-28.51s18.75-7.85,28.51-8c5.25-.08,10.67-.16,13.94-1.52,3.57-1.47,7.63-5.37,11.57-9.14C109.73,23.51,117.56,16,128,16s18.27,7.51,25.18,14.14c3.94,3.77,8,7.67,11.57,9.14,3.27,1.36,8.69,1.44,13.94,1.52,9.76.15,20.82.31,28.51,8s7.85,18.75,8,28.51c.08,5.25.16,10.67,1.52,13.94,1.47,3.57,5.37,7.63,9.14,11.57C232.49,109.73,240,117.56,240,128Z"
                      />
                    </g>
                    <path
                      className="deck-card-watermark-check"
                      fill="var(--brand-teal-hex, #06dec0)"
                      d="M173.66,109.66l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"
                    />
                  </svg>
                </div>
              </div>
            )}

            <div
              className={
                collapsible
                  ? "flex flex-col gap-3 px-5 pb-5 pt-1"
                  : "flex flex-col gap-3 px-5 pb-6 pt-4"
              }
            >
              {!collapsible ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="min-w-0 text-[19px] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--text-primary)]">
                      Approved Loan Amount
                    </h2>
                    <p className="font-display text-[28px] font-bold leading-none tracking-tight tabular-nums text-[var(--text-primary)] lg:text-[32px]">
                      {formatCurrency(plan.amount)}
                    </p>
                  </div>
                  <p className="mt-0.5 shrink-0 text-[13.5px] font-semibold tabular-nums leading-snug text-[var(--text-tertiary)]">
                    {referenceId}
                  </p>
                </div>
              ) : (
                <p className="self-end text-[13.5px] font-semibold tabular-nums leading-snug text-[var(--text-tertiary)]">
                  {referenceId}
                </p>
              )}

              <DashedDivider />

              {/* Key-value breakdown */}
              <div className="flex flex-col gap-3">
                <ReceiptRow size="lg" label="Application Date" value={dateTimeLabel} />
                <ReceiptRow size="lg" label="Plan" value={plan.planTitle} />
                <ReceiptRow
                  size="lg"
                  label="Loan term"
                  value={`${plan.tenure} ${plan.tenure === 1 ? "month" : "months"}`}
                />
                <ReceiptRow
                  size="lg"
                  label="Interest Rate"
                  value={`${formatRate(plan.monthlyRate)}/month`}
                />
                <ReceiptRow
                  size="lg"
                  label="Total amount you'll pay"
                  value={formatCurrency(plan.totalRepayment)}
                />
                {plan.additionalRequests.length > 0 && (
                  <ReceiptRow
                    size="lg"
                    label="Additional requests"
                    value={plan.additionalRequests.join(", ")}
                  />
                )}
                <ReceiptRow
                  size="lg"
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

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span
          className="min-w-0 text-[13px] font-semibold leading-snug"
          style={{ color: "var(--text-secondary)" }}
        >
          Actual loan repayment date here may change based on your loan disbursed date
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
          className="ios-type-cta mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-blue text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
        >
          <ShieldCheck size={16} weight="bold" />
          I understand
        </button>
      </motion.div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

function AcceptFooterCta({
  onClick,
  children,
  stacked,
}: {
  onClick: () => void;
  children: ReactNode;
  /** When the one-line label won't fit, show `Next:` then the rest. */
  stacked?: { rest: string };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ios-type-cta flex h-14 w-full items-center justify-center gap-1 rounded-[var(--radius-md)] bg-brand-blue px-2 text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] sm:gap-2 ${
        stacked ? "ios-type-cta--stacked" : "whitespace-nowrap"
      }`}
    >
      {stacked ? (
        <>
          <span className="flex flex-col items-center leading-[1.15] lg:hidden">
            <span>Next:</span>
            <span>{stacked.rest}</span>
          </span>
          <span className="hidden lg:inline">Next: {stacked.rest}</span>
        </>
      ) : (
        children
      )}
      <ArrowRight size={16} weight="bold" className="hidden shrink-0 lg:block" />
    </button>
  );
}

interface AcceptViewProps {
  plan: SelectedPlanData;
  leadId: string;
  /** ISO timestamp captured server-side so SSR and hydration render identical text. */
  acceptedAt: string;
}

export function AcceptView({ plan, leadId, acceptedAt }: AcceptViewProps) {
  const router = useRouter();
  const applyHref = useApplyPath();

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
  const [deckCtaLabel, setDeckCtaLabel] = useState<string | null>(null);
  const [signatureNeedsInput, setSignatureNeedsInput] = useState(false);
  const [signatureAttentionNonce, setSignatureAttentionNonce] = useState(0);

  const termsDeckRef = useRef<TermsDeckHandle>(null);

  const handleDeckCta = useCallback(() => {
    termsDeckRef.current?.confirm();
  }, []);

  const handleFooterBack = useCallback(() => {
    const wentBackInDeck = termsDeckRef.current?.goBack() ?? false;
    if (wentBackInDeck) {
      setHasConfirmedTerms(false);
      setSignatureDataUrl(null);
      return;
    }
    setHasStartedTerms(false);
    setIsPlanExpanded(true);
    setHasConfirmedTerms(false);
    setSignatureDataUrl(null);
  }, []);

  const stepNav = useApplyStepNav(
    "accept",
    hasStartedTerms ? { onBack: handleFooterBack } : undefined,
  );

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

  const signatureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasConfirmedTerms) return;
    const timeout = setTimeout(
      () => scrollSectionIntoView(signatureRef.current),
      SIGNATURE_REVEAL_SCROLL_MS,
    );
    return () => clearTimeout(timeout);
  }, [hasConfirmedTerms]);

  useEffect(() => {
    if (!signatureNeedsInput) return;
    const el = document.getElementById("accept-signature-field");
    if (!el) return;
    el.classList.remove("is-zooming");
    void el.offsetWidth;
    el.classList.add("is-zooming");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [signatureNeedsInput, signatureAttentionNonce]);

  function handleGetFundsClick() {
    if (!canProceed) {
      setSignatureNeedsInput(true);
      setSignatureAttentionNonce((n) => n + 1);
      return;
    }
    setShowAppointmentReminder(true);
  }

  function startTerms() {
    setHasStartedTerms(true);
    setIsPlanExpanded(false);
  }

  return (
    <ApplyIosShell
      progressStep={progressStep}
    >
      {!hasStartedTerms && (
        <div className="shrink-0 px-5 pb-3 pt-5">
          <h1 className="ios-type-title">
            Confirm loan terms
          </h1>
          <p className="ios-type-subtitle mt-1">
            Review your terms below.
          </p>
        </div>
      )}

      <div
        className={
          hasStartedTerms
            ? "flex flex-1 flex-col gap-5 px-5 pb-8"
            : "accept-intro-fit flex flex-1 flex-col gap-3 px-5"
        }
      >
        <div
          className={
            hasStartedTerms
              ? "sticky top-0 z-10 -mx-5 bg-[var(--surface-primary)] px-5 pb-1 pt-4"
              : undefined
          }
        >
          <PlanSummaryCard
            plan={plan}
            leadId={leadId}
            acceptedAt={acceptedAt}
            collapsible={hasStartedTerms}
            expanded={!hasStartedTerms || isPlanExpanded}
            onToggle={() => setIsPlanExpanded((value) => !value)}
          />
        </div>

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
              <div>
                <TermsDeck
                  ref={termsDeckRef}
                  plan={plan}
                  acceptedAt={acceptedAt}
                  onComplete={() => setHasConfirmedTerms(true)}
                  onConfirmedCountChange={handleTermsProgress}
                  onActiveCtaChange={setDeckCtaLabel}
                />
              </div>
              {!hasConfirmedTerms && <TermsFootnoteCard />}
            </motion.div>
          ) : null}
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
              <div
                id="accept-signature-field"
                ref={signatureRef}
                className={
                  signatureNeedsInput ? "ios-field-needs-input signature-pad--invalid" : undefined
                }
              >
                <SignaturePad
                  invalid={signatureNeedsInput}
                  onSigned={(dataUrl) => {
                    setSignatureDataUrl(dataUrl);
                    setSignatureNeedsInput(false);
                  }}
                  onCleared={() => setSignatureDataUrl(null)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <StickyFooter nav={stepNav}>
        {hasConfirmedTerms ? (
          <AcceptFooterCta onClick={handleGetFundsClick}>
            Next: Get your funds
          </AcceptFooterCta>
        ) : !hasStartedTerms ? (
          <AcceptFooterCta
            onClick={startTerms}
            stacked={{ rest: "Terms & Conditions" }}
          >
            Next: Terms &amp; Conditions
          </AcceptFooterCta>
        ) : deckCtaLabel ? (
          <AcceptFooterCta onClick={handleDeckCta}>{deckCtaLabel}</AcceptFooterCta>
        ) : null}
      </StickyFooter>

      <AnimatePresence>
        {showAppointmentReminder && (
          <AppointmentReminderModal onAcknowledge={() => router.push(applyHref("/apply/book"))} />
        )}
      </AnimatePresence>
    </ApplyIosShell>
  );
}
