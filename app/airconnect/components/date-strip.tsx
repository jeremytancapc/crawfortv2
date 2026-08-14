"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { addDays, parseDateKey, startOfDay, toDateKey } from "@/lib/airconnect/helpers";

interface DateStripProps {
  selected: string;
  todayKey: string;
  counts: Record<string, number>;
  onSelect: (dateKey: string) => void;
}

function chipLabel(date: Date, todayKey: string): { primary: string; secondary: string } {
  const key = toDateKey(date);
  const weekday = date.toLocaleDateString("en-SG", { weekday: "short" });
  const day = String(date.getDate());
  if (key === todayKey) return { primary: "Today", secondary: `${weekday} ${day}` };
  const tomorrow = toDateKey(addDays(parseDateKey(todayKey), 1));
  if (key === tomorrow) return { primary: "Tomorrow", secondary: `${weekday} ${day}` };
  return { primary: weekday, secondary: day };
}

/**
 * Seven-day rail for the queue. Today is always the first chip;
 * a native date input covers jumps beyond the visible week.
 */
export function DateStrip({ selected, todayKey, counts, onSelect }: DateStripProps) {
  const today = startOfDay(parseDateKey(todayKey));
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const selectedDate = parseDateKey(selected);
  const canGoBack = selected > todayKey;
  const nextKey = toDateKey(addDays(selectedDate, 1));

  return (
    <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-white px-4 py-2.5">
      <button
        type="button"
        onClick={() => canGoBack && onSelect(toDateKey(addDays(selectedDate, -1)))}
        disabled={!canGoBack}
        aria-label="Previous day"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-slate-100 disabled:opacity-30"
      >
        <CaretLeft size={16} weight="bold" />
      </button>

      <div className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto scrollbar-none">
        {days.map((date) => {
          const key = toDateKey(date);
          const active = key === selected;
          const count = counts[key] ?? 0;
          const { primary, secondary } = chipLabel(date, todayKey);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={[
                "flex min-w-[4.5rem] flex-1 flex-col items-center rounded-lg px-2 py-1.5 transition-colors",
                active
                  ? "bg-[var(--brand-blue-hex)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-slate-100",
              ].join(" ")}
            >
              <span className={["text-[11px] font-bold leading-none", active ? "text-white" : isWeekend ? "text-[var(--text-tertiary)]" : ""].join(" ")}>
                {primary}
              </span>
              <span className={["mt-0.5 text-[10px] leading-none", active ? "text-white/80" : "text-[var(--text-tertiary)]"].join(" ")}>
                {secondary}
              </span>
              <span
                className={[
                  "mt-1 text-[10px] font-bold leading-none tabular-nums",
                  active ? "text-white" : count > 0 ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]",
                ].join(" ")}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSelect(nextKey)}
        aria-label="Next day"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-slate-100"
      >
        <CaretRight size={16} weight="bold" />
      </button>

      <label className="sr-only" htmlFor="queue-date-jump">
        Jump to date
      </label>
      <input
        id="queue-date-jump"
        type="date"
        min={todayKey}
        value={selected}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        className="h-8 w-[8.5rem] shrink-0 rounded-lg border border-[var(--border-subtle)] bg-white px-2 text-[11px] font-semibold text-[var(--text-secondary)] outline-none focus:border-[var(--brand-blue-hex)]"
      />
    </div>
  );
}
