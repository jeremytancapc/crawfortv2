"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition, Variants } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CurrencyCircleDollar,
  type Icon,
} from "@phosphor-icons/react";

import { buildPaymentSchedule } from "@/lib/offer-plans";
import type { SelectedPlanData } from "./page";
import {
  DISBURSEMENT_ACK_STATEMENT,
  DISBURSEMENT_NOTICE_ITEMS,
  KEY_TERM_ACKS,
  SCHEDULE_ACK_STATEMENT,
  SCHEDULE_CAVEAT,
} from "./accept-content";
import {
  BRAND_BLUE,
  CARD_SHADOW,
  CARD_SHADOW_CONFIRMED,
  DashedDivider,
  NumberBadge,
  ReceiptRow,
  SUCCESS_GREEN,
  ScrollForMoreHint,
  formatCurrency,
  formatScheduleDate,
  scrollSectionIntoViewIfNeeded,
  useCanScrollMore,
} from "./accept-ui";

// ── Deck of terms ─────────────────────────────────────────────────────────────
// The acceptance terms used to be three tall accordions stacked down the page,
// which meant the customer scrolled past a screen and a half of contract before
// reaching the signature. Here every point the customer has to confirm gets a
// card of its own, and the cards occupy one fixed slot: confirming the front
// card flicks it off to the left and deals the next one in from the right, so
// the page never grows and the reader never has to hunt for what's next.
//
// The deck is deliberately one-way. Each card is a statement the customer is
// making about a loan agreement, so a confirmation can't be quietly taken back
// - but they can walk backwards through the deck to re-read anything, and the
// whole deck reopens for review after it's complete.

const CARD_SWIPE_DISTANCE = "104%";
const CARD_SWIPE_TRANSITION: Transition = { duration: 0.34, ease: [0.32, 0.72, 0, 1] };
const CROSSFADE_TRANSITION: Transition = { duration: 0.18, ease: "easeOut" };
/** Long enough for the swipe and the card-height change to finish before we
 *  check whether the new card left its own controls off screen. */
const CARD_SWIPE_SETTLE_MS = 400;

const SCHEDULE_MAX_HEIGHT_PX = 224;
/** Beyond this many instalments the schedule scrolls instead of growing the card. */
const SCHEDULE_SCROLL_THRESHOLD = 4;

const cardVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? CARD_SWIPE_DISTANCE : `-${CARD_SWIPE_DISTANCE}`,
    opacity: 0,
    scale: 0.96,
  }),
  center: { x: "0%", opacity: 1, scale: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? `-${CARD_SWIPE_DISTANCE}` : CARD_SWIPE_DISTANCE,
    opacity: 0,
    scale: 0.94,
  }),
};

/** Reduced-motion fallback: same choreography, expressed as a plain crossfade. */
const cardFadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

// ── Card model ────────────────────────────────────────────────────────────────

type DeckCardKind = "keyTerm" | "schedule" | "disbursement";

interface DeckCard {
  id: string;
  /** Section name shown in the deck's persistent header. */
  section: string;
  kind: DeckCardKind;
  Icon: Icon;
  iconTint: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  /** Small logo rendered beside the title, e.g. PayNow's mark. */
  accessory?: ReactNode;
  /** Bullets for key-term cards. */
  terms?: readonly string[];
  /** Shown above the confirm button when the title isn't itself a statement. */
  statement?: string;
}

const BRAND_ICON_BG = "oklch(0.32 0.14 260 / 0.08)";

function buildDeckCards(plan: SelectedPlanData, acceptedAt: string): DeckCard[] {
  return [
    ...KEY_TERM_ACKS.map((ack) => ({
      id: ack.key,
      section: "Loan acceptance terms",
      kind: "keyTerm" as const,
      Icon: ack.Icon,
      iconTint: BRAND_BLUE,
      iconBg: BRAND_ICON_BG,
      title: ack.title,
      terms: ack.terms,
    })),
    {
      id: "paymentSchedule",
      section: "Payment schedule",
      kind: "schedule" as const,
      Icon: CalendarCheck,
      iconTint: BRAND_BLUE,
      iconBg: BRAND_ICON_BG,
      title: SCHEDULE_ACK_STATEMENT,
    },
    {
      id: "disbursement",
      section: "Funds disbursement",
      kind: "disbursement" as const,
      Icon: CurrencyCircleDollar,
      iconTint: "#0d9488",
      iconBg: "oklch(0.7 0.13 178 / 0.14)",
      title: "Fund disbursement via NRIC-linked PayNow",
      accessory: (
        <Image
          src="/images/paynow-logo.png"
          alt="PayNow"
          width={228}
          height={148}
          className="h-8 w-auto"
        />
      ),
      statement: DISBURSEMENT_ACK_STATEMENT,
    },
  ];
}

// ── Card bodies ───────────────────────────────────────────────────────────────

function KeyTermBody({ terms }: { terms: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {terms.map((term) => (
        <li key={term} className="flex items-start gap-2.5">
          <span
            className="mt-[5px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
            style={{ background: "oklch(0.32 0.14 260 / 0.12)" }}
            aria-hidden="true"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: BRAND_BLUE }}
            />
          </span>
          <p
            className="text-[13.5px] leading-relaxed font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {term}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** One instalment: numbered badge, label, muted due date, amount. */
function ScheduleRow({
  index,
  dueDateIso,
  amount,
}: {
  index: number;
  dueDateIso: string;
  amount: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <NumberBadge value={index} />
        <span className="flex flex-col gap-0.5">
          <span
            className="text-[13px] font-medium leading-snug"
            style={{ color: "var(--text-primary)" }}
          >
            Instalment {index}
          </span>
          <span className="text-[12px] font-medium" style={{ color: "var(--text-tertiary)" }}>
            Due {formatScheduleDate(dueDateIso)}
          </span>
        </span>
      </div>
      <span
        className="text-[13.5px] font-semibold tabular-nums shrink-0"
        style={{ color: "var(--text-primary)" }}
      >
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function ScheduleBody({
  plan,
  acceptedAt,
}: {
  plan: SelectedPlanData;
  acceptedAt: string;
}) {
  const schedule = buildPaymentSchedule(acceptedAt, plan.tenure, plan.monthlyInstalment);
  const isScrollable = schedule.length > SCHEDULE_SCROLL_THRESHOLD;
  const scheduleRef = useRef<HTMLDivElement>(null);
  const canScrollMore = useCanScrollMore(scheduleRef);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
          Your {plan.tenure}-month schedule
        </p>
        <p
          className="text-[13px] leading-relaxed font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Assuming disbursement date: {formatScheduleDate(acceptedAt)}
        </p>
      </div>

      <div className="relative">
        <div
          ref={scheduleRef}
          className={
            isScrollable ? "flex flex-col gap-3 overflow-y-auto pr-1 pb-6" : "flex flex-col gap-3"
          }
          style={isScrollable ? { maxHeight: SCHEDULE_MAX_HEIGHT_PX } : undefined}
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

      <p
        className="text-[13px] leading-relaxed font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {SCHEDULE_CAVEAT}
      </p>
    </div>
  );
}

function DisbursementBody() {
  return (
    <ul className="flex flex-col gap-3">
      {DISBURSEMENT_NOTICE_ITEMS.map((item, index) => (
        <li key={item} className="flex items-start gap-2.5">
          <span className="mt-[3px]">
            <NumberBadge value={index + 1} />
          </span>
          <p
            className="text-[13px] leading-relaxed font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {item}
          </p>
        </li>
      ))}
    </ul>
  );
}

function DeckCardBody({
  card,
  plan,
  acceptedAt,
}: {
  card: DeckCard;
  plan: SelectedPlanData;
  acceptedAt: string;
}) {
  switch (card.kind) {
    case "keyTerm":
      return <KeyTermBody terms={card.terms ?? []} />;
    case "schedule":
      return <ScheduleBody plan={plan} acceptedAt={acceptedAt} />;
    case "disbursement":
      return <DisbursementBody />;
  }
}

// ── Card shell ────────────────────────────────────────────────────────────────

function DeckCardFace({
  card,
  plan,
  acceptedAt,
  isConfirmed,
  isLast,
  canGoBack,
  onConfirm,
  onBack,
}: {
  card: DeckCard;
  plan: SelectedPlanData;
  acceptedAt: string;
  isConfirmed: boolean;
  isLast: boolean;
  canGoBack: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const headerBg = isConfirmed ? SUCCESS_GREEN : "var(--brand-blue-hex, #0033AA)";

  return (
    <div
      className="w-full rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        background: "var(--surface-elevated)",
        boxShadow: isConfirmed ? CARD_SHADOW_CONFIRMED : CARD_SHADOW,
      }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={{ background: headerBg }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/16">
          <card.Icon size={17} weight="duotone" className="text-white" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold leading-snug text-white">
            {card.title}
          </span>
          {card.subtitle && (
            <span className="text-[12.5px] leading-snug font-medium text-white/70">
              {card.subtitle}
            </span>
          )}
        </span>
        {card.accessory && (
          <span className="shrink-0 rounded-md bg-white px-1.5 py-1">{card.accessory}</span>
        )}
        {isConfirmed && (
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white">
            <Check size={12} weight="bold" style={{ color: SUCCESS_GREEN }} />
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        <DeckCardBody card={card} plan={plan} acceptedAt={acceptedAt} />

        <DashedDivider />

        {card.statement && !isConfirmed && (
          <p
            className="text-[13.5px] leading-snug font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {card.statement}
          </p>
        )}

        <div className="flex items-center gap-2.5">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to the previous point"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] transition-all duration-200 active:scale-95"
              style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}
            >
              <ArrowLeft size={16} weight="bold" />
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] text-[15px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            style={{
              background: isConfirmed ? BRAND_BLUE : SUCCESS_GREEN,
            }}
          >
            {isConfirmed ? (
              <>
                {isLast ? "Done reviewing" : "Next"}
                <ArrowRight size={15} weight="bold" />
              </>
            ) : (
              <>
                <Check size={16} weight="bold" />
                I agree
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deck chrome ───────────────────────────────────────────────────────────────

function DeckHeader({
  section,
  position,
  total,
  confirmedCount,
}: {
  section: string;
  position: number;
  total: number;
  confirmedCount: number;
}) {
  return (
    <div className="flex flex-col gap-2 px-0.5 pb-3">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="text-[11px] font-bold tracking-[0.12em] uppercase"
          style={{ color: "var(--text-tertiary)" }}
        >
          {section}
        </span>
        <span
          className="shrink-0 text-[11px] font-bold tabular-nums tracking-[0.06em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {position} of {total}
        </span>
      </div>
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-label="Terms confirmed"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={confirmedCount}
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className="h-[3px] flex-1 rounded-full transition-colors duration-300"
            style={{
              background:
                index < confirmedCount
                  ? SUCCESS_GREEN
                  : index === position - 1
                    ? BRAND_BLUE
                    : "var(--border-medium)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Ghosted card edges peeking out below the front card, so it's obvious more
 *  cards are waiting without spelling it out a second time. */
function DeckStackLayers({ remaining }: { remaining: number }) {
  const layers = Math.min(Math.max(remaining, 0), 2);

  return (
    <>
      {Array.from({ length: layers }, (_, index) => {
        const depth = index + 1;
        return (
          <span
            key={depth}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[var(--radius-lg)] transition-all duration-300"
            style={{
              background: "var(--surface-elevated)",
              boxShadow: "0 0 0 1px var(--border-subtle)",
              transform: `translateY(${depth * 6}px) scaleX(${1 - depth * 0.03})`,
              opacity: 1 - depth * 0.35,
            }}
          />
        );
      })}
    </>
  );
}

// ── Deck ──────────────────────────────────────────────────────────────────────

interface TermsDeckProps {
  plan: SelectedPlanData;
  acceptedAt: string;
  /** Fires once every card has been confirmed. Confirmations are one-way, so
   *  this is called exactly once. */
  onComplete: () => void;
}

export function TermsDeck({ plan, acceptedAt, onComplete }: TermsDeckProps) {
  const prefersReducedMotion = useReducedMotion();
  const cards = useMemo(() => buildDeckCards(plan, acceptedAt), [plan, acceptedAt]);
  const total = cards.length;

  // `cursor === total` means the deck has been dealt out and collapsed.
  const [cursor, setCursor] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [direction, setDirection] = useState(1);

  const activeCard = cursor < total ? cards[cursor] : null;
  const isCollapsed = activeCard === null;

  // The front card is in normal flow, so the viewport reads its height and
  // animates to it - which keeps the swap from snapping between two very
  // different card heights (a two-line term vs. a twelve-row schedule).
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const cardObserverRef = useRef<ResizeObserver | null>(null);

  const measureCard = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    cardObserverRef.current?.disconnect();
    const observer = new ResizeObserver(() => setViewportHeight(node.offsetHeight));
    observer.observe(node);
    cardObserverRef.current = observer;
    setViewportHeight(node.offsetHeight);
  }, []);

  useEffect(() => () => cardObserverRef.current?.disconnect(), []);

  // Cards swap in place, so the page normally shouldn't move at all. The one
  // exception is a card tall enough to push its own buttons off screen (the
  // twelve-month schedule on a small phone) - nudge the page then, and only
  // then. The first card is skipped: the page has just scrolled the deck into
  // view as it appeared.
  const deckRef = useRef<HTMLDivElement>(null);
  const hasDealtFirstCard = useRef(false);

  useEffect(() => {
    if (isCollapsed) return;
    if (!hasDealtFirstCard.current) {
      hasDealtFirstCard.current = true;
      return;
    }
    const timeout = setTimeout(
      () => scrollSectionIntoViewIfNeeded(deckRef.current),
      CARD_SWIPE_SETTLE_MS,
    );
    return () => clearTimeout(timeout);
  }, [cursor, isCollapsed]);

  function goTo(next: number, nextDirection: 1 | -1) {
    setDirection(nextDirection);
    setCursor(next);
  }

  /** Confirms the front card, or - if it's already confirmed and being
   *  re-read - just deals the next one. */
  function advance() {
    if (cursor === confirmedCount) {
      const nextCount = cursor + 1;
      setConfirmedCount(nextCount);
      if (nextCount === total) onComplete();
    }
    goTo(cursor + 1, 1);
  }

  return (
    <div ref={deckRef} className="flex flex-col">
      <AnimatePresence mode="wait" initial={false}>
        {activeCard ? (
          <motion.div
            key="header"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={CROSSFADE_TRANSITION}
          >
            <DeckHeader
              section={activeCard.section}
              position={cursor + 1}
              total={total}
              confirmedCount={confirmedCount}
            />
          </motion.div>
        ) : (
          <motion.div
            key="complete"
            className="px-0.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={CROSSFADE_TRANSITION}
          >
            <DashedDivider />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <DeckStackLayers remaining={total - cursor - 1} />
        <motion.div
          className="relative"
          animate={{ height: isCollapsed ? 0 : (viewportHeight ?? "auto") }}
          transition={CARD_SWIPE_TRANSITION}
          style={{ overflow: "hidden" }}
        >
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            {activeCard && (
              <motion.div
                key={activeCard.id}
                custom={direction}
                variants={prefersReducedMotion ? cardFadeVariants : cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={CARD_SWIPE_TRANSITION}
              >
                <div ref={measureCard}>
                  <DeckCardFace
                    card={activeCard}
                    plan={plan}
                    acceptedAt={acceptedAt}
                    isConfirmed={cursor < confirmedCount}
                    isLast={cursor === total - 1}
                    canGoBack={cursor > 0}
                    onConfirm={advance}
                    onBack={() => goTo(cursor - 1, -1)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
