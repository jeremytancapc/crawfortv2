"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown } from "@phosphor-icons/react";

// Shared chrome for the acceptance page: the receipt-paper primitives, the
// scroll affordance, and the colours/formatters that both the plan receipt and
// the terms deck need to agree on.

/** Confirmation green. Every "done" state on this page resolves to this. */
export const SUCCESS_GREEN = "#16a34a";
export const BRAND_BLUE = "var(--brand-blue-hex, #0033AA)";
/** Tinted callout panels: blue while an action is outstanding, green once done. */
export const PANEL_BLUE = "oklch(0.95 0.03 258)";
/** Ring + lift shared by every card on the page so they read as one stack. */
export const CARD_SHADOW =
  "0 0 0 1px var(--border-subtle), 0 8px 28px oklch(0.24 0.06 260 / 0.07)";
export const CARD_SHADOW_CONFIRMED = `0 0 0 1.5px ${SUCCESS_GREEN}, 0 8px 28px oklch(0.24 0.06 260 / 0.07)`;

// Blue gate header is in document flow (not sticky). Keep a small inset so
// tall cards aren't flush against the top of the viewport when we pin them.
const STICKY_HEADER_OFFSET_PX = 16;

/**
 * Scroll a newly revealed section into a comfortable viewport position.
 * Short blocks are centered; tall ones (e.g. the payment schedule) are pinned
 * just below the sticky mobile header so their top isn't hidden behind it.
 */
export function scrollSectionIntoView(el: HTMLElement | null) {
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const absoluteTop = window.scrollY + rect.top;
  const availableHeight = window.innerHeight - STICKY_HEADER_OFFSET_PX;
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;

  let targetY: number;
  if (!isDesktop && rect.height >= availableHeight) {
    // Tall block on mobile: keep the top clear of the sticky header.
    targetY = absoluteTop - STICKY_HEADER_OFFSET_PX;
  } else {
    // Block fits (or desktop has no sticky header): center it in the viewport.
    targetY = absoluteTop - (window.innerHeight - rect.height) / 2;
  }

  window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
}

/**
 * Same as `scrollSectionIntoView`, but leaves the page alone when the block is
 * already fully on screen. The terms deck swaps cards in place, so it should
 * only move the page when a taller card has pushed its own controls out of
 * reach - never on every card change.
 */
export function scrollSectionIntoViewIfNeeded(el: HTMLElement | null) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const isFullyVisible =
    rect.top >= STICKY_HEADER_OFFSET_PX && rect.bottom <= window.innerHeight;
  if (isFullyVisible) return;
  scrollSectionIntoView(el);
}

/**
 * Tracks whether a scroll container still has content below the fold.
 * Used to hide the "Scroll for more" cue once the reader reaches the bottom,
 * and bring it back if they scroll up again.
 */
export function useCanScrollMore(ref: RefObject<HTMLElement | null>) {
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

export function ScrollForMoreHint({ visible }: { visible: boolean }) {
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

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/** e.g. "22 December 2025 22:30" - matches the reference receipt's plain, formal timestamp. */
export function formatReceiptDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getDate();
  const month = date.toLocaleString("en-SG", { month: "long" });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

/** Derives a stable, receipt-style reference number from the lead's UUID. */
export function formatReferenceId(leadId: string): string {
  const alphanumeric = leadId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `ID${alphanumeric.slice(0, 9)}`;
}

/** e.g. "12 Sep 2026" - compact date used for schedule due dates. */
export function formatScheduleDate(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getDate();
  const month = date.toLocaleString("en-SG", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// ── Receipt primitives ────────────────────────────────────────────────────────

/** Hairline rule rendered as short dashes, echoing a printed receipt's tear-off perforation. */
export function DashedDivider() {
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

export function ReceiptRow({
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

/** Numbered bullet used by the T&C list, the payment schedule and the
 *  disbursement notes, so all three read as the same kind of list. */
export function NumberBadge({ value }: { value: number }) {
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
      style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}
      aria-hidden="true"
    >
      {value}
    </span>
  );
}

