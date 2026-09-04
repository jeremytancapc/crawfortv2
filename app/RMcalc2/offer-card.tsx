"use client";

import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface OfferCell {
  label: string;
  value: string;
  /** Mint = discounted pricing; blue = a lever pushed to its longest/highest. */
  tone?: "default" | "mint" | "blue";
  /** The headline instalment reads larger than the supporting figures. */
  emphasis?: boolean;
}

export type OfferVariant = "custom" | "longest_tenure" | "lowest_interest" | "lowest_fee";

interface OfferCardProps {
  title: string;
  caption?: string;
  cells: OfferCell[];
  selected: boolean;
  onSelect?: () => void;
  variant?: OfferVariant;
}

/**
 * Radio-style offer card: title row with a round indicator, then a 3×2 grid of
 * label/value pairs. Whole card is the hit target.
 */
export function OfferCard({
  title,
  caption,
  cells,
  selected,
  onSelect,
  variant = "custom",
}: OfferCardProps) {
  const isInteractive = typeof onSelect === "function";

  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-label={title}
      tabIndex={isInteractive ? 0 : -1}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (!isInteractive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      data-selected={selected ? "true" : "false"}
      data-variant={variant}
      className={cn(
        "rm-offer rounded-2xl px-5 pb-4 pt-4 text-left",
        isInteractive ? "cursor-pointer" : "cursor-default",
      )}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "rm-offer-radio grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
              selected
                ? "border-[var(--rm-blue)] bg-[var(--rm-blue)] text-white"
                : "border-[var(--rm-line-strong)] bg-white",
            )}
          >
            {selected && <Check size={11} weight="bold" />}
          </span>
          <h3 className="text-[16px] font-bold leading-tight text-[var(--rm-ink)]">{title}</h3>
          {caption && (
            <span className="ml-auto rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--rm-ink-2)] backdrop-blur-sm">
              {caption}
            </span>
          )}
        </div>

        {/* First column is wider for the headline instalment; the indent that
            aligns the grid under the title only kicks in once there's room. */}
        <dl className="mt-3.5 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-3.5 lg:pl-8">
          {cells.map((cell) => (
            <div key={cell.label} className="min-w-0">
              <dt className="text-[14px] font-medium leading-tight text-[var(--rm-ink-3)]">{cell.label}</dt>
              <dd className="mt-1.5 whitespace-nowrap text-[19px] font-bold leading-none tabular-nums text-[var(--rm-ink)]">
                {cell.tone && cell.tone !== "default" ? (
                  <span
                    className={cn("rm-highlight", cell.tone === "mint" && "text-[#0b0f1a]")}
                    data-tone={cell.tone}
                  >
                    {cell.value}
                  </span>
                ) : (
                  cell.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
