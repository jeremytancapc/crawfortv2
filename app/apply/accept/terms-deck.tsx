"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition, Variants } from "motion/react";
import {
  CalendarCheck,
  CurrencyCircleDollar,
  type Icon,
} from "@phosphor-icons/react";

import { buildPaymentSchedule } from "@/lib/offer-plans";
import type { SelectedPlanData } from "./page";
import {
  DISBURSEMENT_ACK_STATEMENT,
  DISBURSEMENT_NOTICE_ITEMS,
  KEY_TERM_ACKS,
  DISBURSEMENT_CTA_LABEL,
  SCHEDULE_ACK_STATEMENT,
  SCHEDULE_CTA_LABEL,
} from "./accept-content";
import {
  BRAND_BLUE,
  DashedDivider,
  NumberBadge,
  ReceiptRow,
  formatCurrency,
  formatScheduleDate,
  scrollSectionIntoViewIfNeeded,
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
/** Long enough for the swipe and the card-height change to finish before we
 *  check whether the new card left its own controls off screen. */
const CARD_SWIPE_SETTLE_MS = 400;

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
  /** First-person line on the confirm button. */
  agreeLabel: string;
  /** Footer CTA that names the next card. */
  ctaLabel: string;
}

const BRAND_ICON_BG = "oklch(0.32 0.14 260 / 0.08)";

function buildDeckCards(plan: SelectedPlanData, acceptedAt: string): DeckCard[] {
  return [
    ...KEY_TERM_ACKS.map((ack) => ({
      id: ack.key,
      kind: "keyTerm" as const,
      Icon: ack.Icon,
      iconTint: BRAND_BLUE,
      iconBg: BRAND_ICON_BG,
      title: ack.label,
      agreeLabel: ack.title,
      ctaLabel: ack.ctaLabel,
      terms: ack.terms,
    })),
    {
      id: "paymentSchedule",
      kind: "schedule" as const,
      Icon: CalendarCheck,
      iconTint: BRAND_BLUE,
      iconBg: BRAND_ICON_BG,
      title: "Payment Schedule",
      agreeLabel: SCHEDULE_ACK_STATEMENT,
      ctaLabel: SCHEDULE_CTA_LABEL,
    },
    {
      id: "disbursement",
      kind: "disbursement" as const,
      Icon: CurrencyCircleDollar,
      iconTint: "#0d9488",
      iconBg: "oklch(0.7 0.13 178 / 0.14)",
      title: "Fund disbursement via NRIC-linked PayNow",
      agreeLabel: DISBURSEMENT_ACK_STATEMENT,
      ctaLabel: DISBURSEMENT_CTA_LABEL,
      accessory: (
        <Image
          src="/images/paynow-logo.png"
          alt="PayNow"
          width={228}
          height={148}
          className="h-8 w-auto"
        />
      ),
    },
  ];
}

// ── Card bodies ───────────────────────────────────────────────────────────────

function KeyTermBody({ terms }: { terms: readonly string[] }) {
  return (
    <div className="flex flex-col gap-2">
      {terms.map((term) => (
        <p
          key={term}
          className="text-[14px] leading-[1.55] font-medium text-[var(--text-secondary)]"
        >
          {term}
        </p>
      ))}
    </div>
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
      <div className="flex items-center gap-2">
        <NumberBadge value={index} />
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[13px] font-medium leading-snug text-[var(--text-primary)]">
            Instalment {index}
          </span>
          <span className="text-[12px] font-medium text-[var(--text-tertiary)]">
            {formatScheduleDate(dueDateIso)}
          </span>
        </span>
      </div>
      <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-[var(--text-primary)]">
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

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[12.5px] font-medium leading-snug text-[var(--text-tertiary)]">
        {plan.tenure} months · from {formatScheduleDate(acceptedAt)}
      </p>

      <div className="flex flex-col gap-2">
        {schedule.map((installment) => (
          <ScheduleRow
            key={installment.index}
            index={installment.index}
            dueDateIso={installment.dueDateIso}
            amount={installment.amount}
          />
        ))}
      </div>

      <DashedDivider />

      <ReceiptRow label="Total repayment" value={formatCurrency(plan.totalRepayment)} emphasize />
    </div>
  );
}

function DisbursementBody() {
  return (
    <div className="flex flex-col gap-2">
      {DISBURSEMENT_NOTICE_ITEMS.map((item) => (
        <p
          key={item}
          className="text-[14px] leading-[1.55] font-medium text-[var(--text-secondary)]"
        >
          {item}
        </p>
      ))}
    </div>
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

const LISTING_CARD_SHADOW = "0 18px 40px oklch(0.24 0.02 80 / 0.10)";

function DeckCardFace({
  card,
  plan,
  acceptedAt,
  index,
  total,
}: {
  card: DeckCard;
  plan: SelectedPlanData;
  acceptedAt: string;
  index: number;
  total: number;
}) {
  return (
    <div
      className="w-full overflow-hidden rounded-[28px] bg-white"
      style={{ boxShadow: LISTING_CARD_SHADOW }}
    >
      {card.kind !== "schedule" && (
        <div className="deck-card-banner relative isolate h-[88px] overflow-hidden">
          {/* Same stamp treatment as the plan cards: the glyph is the
              banner's texture, oversized and clipped so the teal still
              reads as a solid field rather than a flat fill. */}
          <card.Icon
            aria-hidden
            weight="fill"
            size={168}
            className="deck-card-watermark pointer-events-none"
          />

          {card.accessory && (
            <span className="deck-card-accessory">{card.accessory}</span>
          )}
        </div>
      )}

      <div className={`flex flex-col px-5 pb-5 ${card.kind === "schedule" ? "gap-2.5 pt-4" : "gap-3.5 pt-4"}`}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-[19px] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--text-primary)]">
            {card.title}
          </h2>
          <p className="mt-0.5 shrink-0 text-[13.5px] font-medium leading-snug text-[var(--text-tertiary)]">
            Term {index} of {total}
          </p>
        </div>

        {card.subtitle ? (
          <p className="text-[13.5px] font-medium leading-snug text-[var(--text-tertiary)]">
            {card.subtitle}
          </p>
        ) : null}

        <DeckCardBody card={card} plan={plan} acceptedAt={acceptedAt} />
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
            className="pointer-events-none absolute inset-0 rounded-[28px] transition-all duration-300"
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

export interface TermsDeckHandle {
  /** Step back one card. Returns true when a card was shown. */
  goBack: () => boolean;
  /** Confirm the front card and deal the next one. */
  confirm: () => void;
}

interface TermsDeckProps {
  plan: SelectedPlanData;
  acceptedAt: string;
  /** Fires once every card has been confirmed. Confirmations are one-way, so
   *  this is called exactly once. */
  onComplete: () => void;
  /** Fires on mount and after each confirmation so the header progress can move. */
  onConfirmedCountChange?: (confirmed: number, total: number) => void;
  /** Footer CTA label for the card on screen. Null when the deck is collapsed. */
  onActiveCtaChange?: (label: string | null) => void;
}

export const TermsDeck = forwardRef<TermsDeckHandle, TermsDeckProps>(function TermsDeck(
  {
    plan,
    acceptedAt,
    onComplete,
    onConfirmedCountChange,
    onActiveCtaChange,
  },
  ref,
) {
  const prefersReducedMotion = useReducedMotion();
  const cards = useMemo(() => buildDeckCards(plan, acceptedAt), [plan, acceptedAt]);
  const total = cards.length;

  // `cursor === total` means the deck has been dealt out and collapsed.
  const [cursor, setCursor] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [direction, setDirection] = useState(1);

  const activeCard = cursor < total ? cards[cursor] : null;
  const isCollapsed = activeCard === null;

  useEffect(() => {
    onConfirmedCountChange?.(confirmedCount, total);
  }, [confirmedCount, total, onConfirmedCountChange]);

  useEffect(() => {
    if (!activeCard) {
      onActiveCtaChange?.(null);
      return;
    }
    onActiveCtaChange?.(activeCard.ctaLabel);
  }, [activeCard, onActiveCtaChange]);

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
   *  re-read - just deals the next one. Completing the last card (or
   *  re-advancing past it after a back) collapses the deck. */
  function advance() {
    if (cursor === confirmedCount) {
      setConfirmedCount(cursor + 1);
    }
    const next = cursor + 1;
    goTo(next, 1);
    if (next === total) onComplete();
  }

  useImperativeHandle(
    ref,
    () => ({
      goBack() {
        if (cursor <= 0) return false;
        goTo(cursor - 1, -1);
        return true;
      },
      confirm() {
        advance();
      },
    }),
    [confirmedCount, cursor, total],
  );

  return (
    <div ref={deckRef} className="flex flex-col">
      {isCollapsed ? (
        <div className="px-0.5">
          <DashedDivider />
        </div>
      ) : null}

      <div className="relative mx-auto w-full max-w-[360px] pb-3">
        <DeckStackLayers remaining={total - cursor - 1} />
        <motion.div
          className="relative"
          animate={{ height: isCollapsed ? 0 : "auto" }}
          transition={CARD_SWIPE_TRANSITION}
          style={{ overflow: isCollapsed ? "hidden" : "visible" }}
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
                <DeckCardFace
                  card={activeCard}
                  plan={plan}
                  acceptedAt={acceptedAt}
                  index={cursor + 1}
                  total={total}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
});
