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
      title: "Link your NRIC to PayNow",
      agreeLabel: DISBURSEMENT_ACK_STATEMENT,
      ctaLabel: DISBURSEMENT_CTA_LABEL,
      accessory: (
        <Image
          src="/images/paynow-logo.png"
          alt=""
          width={228}
          height={148}
          className="h-[0.95em] w-auto"
        />
      ),
    },
  ];
}

// ── Card bodies ───────────────────────────────────────────────────────────────

function KeyTermBody({ terms }: { terms: readonly string[] }) {
  return (
    <div className="flex flex-col gap-4">
      {terms.map((term) => (
        <p
          key={term}
          className="text-[16px] leading-[1.6] font-medium text-[var(--text-secondary)]"
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
          <span className="text-[16px] font-medium leading-snug text-[var(--text-primary)]">
            Instalment {index}
          </span>
          <span className="text-[15px] font-medium text-[var(--text-tertiary)]">
            {formatScheduleDate(dueDateIso)}
          </span>
        </span>
      </div>
      <span className="shrink-0 text-[16px] font-semibold tabular-nums text-[var(--text-primary)]">
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
    <div className="flex flex-col gap-4">
      <p className="text-[16px] font-medium leading-snug text-[var(--text-secondary)]">
        {plan.tenure} months · from {formatScheduleDate(acceptedAt)}
      </p>

      <div className="flex flex-col gap-3">
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

      <ReceiptRow
        size="lg"
        label="Total repayment"
        value={formatCurrency(plan.totalRepayment)}
        emphasize
      />
    </div>
  );
}

function DisbursementBody() {
  return (
    <div className="flex flex-col gap-4">
      {DISBURSEMENT_NOTICE_ITEMS.map((item) => (
        <p
          key={item}
          className="text-[16px] leading-[1.6] font-medium text-[var(--text-secondary)]"
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

function TitleWithAccessory({
  title,
  accessory,
}: {
  title: string;
  accessory?: ReactNode;
}) {
  if (!accessory) return title;

  const mark = "PayNow";
  const at = title.lastIndexOf(mark);
  if (at === -1) {
    return (
      <>
        {title}{" "}
        <span className="ml-1 inline-flex translate-y-[0.08em] items-center">
          {accessory}
        </span>
      </>
    );
  }

  return (
    <>
      {title.slice(0, at)}
      <span className="inline-flex items-center gap-1.5">
        {mark}
        <span className="inline-flex translate-y-[0.06em] items-center">
          {accessory}
        </span>
      </span>
      {title.slice(at + mark.length)}
    </>
  );
}

function DeckCardFace({
  card,
  plan,
  acceptedAt,
}: {
  card: DeckCard;
  plan: SelectedPlanData;
  acceptedAt: string;
}) {
  return (
    <div
      className="accept-terms-card flex w-full flex-col overflow-hidden rounded-[var(--radius-lg)] bg-white"
      style={{ boxShadow: LISTING_CARD_SHADOW }}
    >
      <div className="deck-card-banner relative isolate h-[88px] overflow-hidden">
        <card.Icon
          aria-hidden
          weight="fill"
          size={168}
          className="deck-card-watermark pointer-events-none"
        />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-5 px-6 pb-8 pt-6">
        <h2 className="text-[22px] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--text-primary)]">
          <TitleWithAccessory title={card.title} accessory={card.accessory} />
        </h2>

        {card.subtitle ? (
          <p className="text-[16px] font-medium leading-snug text-[var(--text-secondary)]">
            {card.subtitle}
          </p>
        ) : null}

        <DeckCardBody card={card} plan={plan} acceptedAt={acceptedAt} />
      </div>
      <div
        aria-hidden
        className="shrink-0"
        style={{ height: "var(--apply-fit-leftover, 0px)" }}
      />
    </div>
  );
}

/** Two receding cards behind the front one. Scale from the top so only a
 *  tight stepped rim shows — not a second empty panel of the same size. */
function DeckStackLayers({ remaining }: { remaining: number }) {
  const layers = Math.min(Math.max(remaining, 0), 2);
  if (layers === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-0" aria-hidden>
      {Array.from({ length: layers }, (_, index) => {
        const depth = layers - index;
        return (
          <span
            key={depth}
            className="absolute rounded-[var(--radius-lg)]"
            style={{
              top: 0,
              left: `${depth * 18}px`,
              right: `${depth * 18}px`,
              height: `calc(100% + ${depth * 9}px)`,
              background:
                depth === 2 ? "oklch(0.94 0.01 260)" : "oklch(0.975 0.005 260)",
              boxShadow:
                "0 6px 16px oklch(0.24 0.05 260 / 0.08), 0 0 0 1px oklch(0.86 0.012 260 / 0.5)",
            }}
          />
        );
      })}
    </div>
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
  /** So the repayment footnote can sit under the schedule card only. */
  onActiveCardIdChange?: (id: string | null) => void;
}

export const TermsDeck = forwardRef<TermsDeckHandle, TermsDeckProps>(function TermsDeck(
  {
    plan,
    acceptedAt,
    onComplete,
    onConfirmedCountChange,
    onActiveCtaChange,
    onActiveCardIdChange,
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
      onActiveCardIdChange?.(null);
      return;
    }
    onActiveCtaChange?.(activeCard.ctaLabel);
    onActiveCardIdChange?.(activeCard.id);
  }, [activeCard, onActiveCtaChange, onActiveCardIdChange]);

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

      <div className="accept-terms-slot relative w-full">
        <div className="relative mb-7">
        <DeckStackLayers remaining={total - cursor - 1} />
        <motion.div
          className="relative z-10 flex flex-col"
          animate={{ height: isCollapsed ? 0 : "auto" }}
          transition={{
            ...CARD_SWIPE_TRANSITION,
            height: isCollapsed ? CARD_SWIPE_TRANSITION : { duration: 0 },
          }}
          style={{ overflow: isCollapsed ? "hidden" : "visible" }}
        >
          <AnimatePresence mode="wait" initial={false} custom={direction}>
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
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        </div>
      </div>
    </div>
  );
});
