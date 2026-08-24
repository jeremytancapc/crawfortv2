"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { addDays, parseDateKey, startOfWeekMonday, toDateKey } from "@/lib/airconnect/helpers";
import { sgPublicHolidayName } from "@/lib/sg-public-holidays";

interface DateStripProps {
  selected: string;
  todayKey: string;
  counts: Record<string, number>;
  onSelect: (dateKey: string) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function mondayKey(date: Date): string {
  return toDateKey(startOfWeekMonday(date));
}

function clampMonday(key: string, todayMondayKey: string): string {
  return key < todayMondayKey ? todayMondayKey : key;
}

function formatRangeLabel(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return start.toLocaleDateString("en-SG", { month: "short", year: "numeric" });
  }
  const startLabel = start.toLocaleDateString("en-SG", {
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endLabel = end.toLocaleDateString("en-SG", { month: "short", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function dayAriaLabel(date: Date, holidayName: string | undefined, count: number, isToday: boolean): string {
  const base = date.toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const bits = [base];
  if (isToday) bits.push("today");
  if (holidayName) bits.push(`${holidayName}, public holiday`);
  bits.push(`${count} follow-up${count === 1 ? "" : "s"}`);
  return bits.join(", ");
}

/**
 * Two-week Mon–Sun calendar for the queue. Row 1 is the week containing
 * the selected date; row 2 is the following week.
 */
export function DateStrip({ selected, todayKey, counts, onSelect }: DateStripProps) {
  const todayMondayKey = mondayKey(parseDateKey(todayKey));
  const selectedMondayKey = mondayKey(parseDateKey(selected));
  const anchorKey = clampMonday(selectedMondayKey, todayMondayKey);
  const weekStart = parseDateKey(anchorKey);
  const weekEnd = addDays(weekStart, 13);
  const thisWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const nextWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i + 7));
  const canGoBack = anchorKey > todayMondayKey;
  const prevMonday = toDateKey(addDays(weekStart, -7));
  const nextMonday = toDateKey(addDays(weekStart, 7));

  function goToWeek(monday: string) {
    const nextAnchor = clampMonday(monday, todayMondayKey);
    onSelect(nextAnchor < todayKey ? todayKey : nextAnchor);
  }

  return (
    <div className="border-b-2 border-[oklch(0.78_0.06_260)] bg-[oklch(0.96_0.025_260)] px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[12px] font-black tracking-tight text-[var(--brand-blue-hex)]">
          {formatRangeLabel(weekStart, weekEnd)}
        </p>
        <button
          type="button"
          onClick={() => canGoBack && goToWeek(prevMonday)}
          disabled={!canGoBack}
          aria-label="Previous week"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--brand-blue-hex)] shadow-sm ring-1 ring-[oklch(0.78_0.06_260)] hover:bg-[oklch(0.93_0.04_260)] disabled:opacity-30"
        >
          <CaretLeft size={16} weight="bold" />
        </button>
        <button
          type="button"
          onClick={() => goToWeek(nextMonday)}
          aria-label="Next week"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--brand-blue-hex)] shadow-sm ring-1 ring-[oklch(0.78_0.06_260)] hover:bg-[oklch(0.93_0.04_260)]"
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
          className="h-8 w-[8.25rem] shrink-0 rounded-lg border-2 border-[oklch(0.72_0.08_260)] bg-white px-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-blue-hex)]"
        />
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label, i) => {
          const isWeekend = i >= 5;
          return (
            <div
              key={label}
              className={[
                "pb-0.5 text-center text-[10px] font-black uppercase tracking-[0.08em]",
                isWeekend ? "text-slate-600" : "text-[var(--brand-blue-hex)]",
              ].join(" ")}
            >
              {label}
            </div>
          );
        })}

        {thisWeek.map((date) => (
          <DayCell
            key={toDateKey(date)}
            date={date}
            todayKey={todayKey}
            selected={selected}
            count={counts[toDateKey(date)] ?? 0}
            onSelect={onSelect}
          />
        ))}
        {nextWeek.map((date) => (
          <DayCell
            key={toDateKey(date)}
            date={date}
            todayKey={todayKey}
            selected={selected}
            count={counts[toDateKey(date)] ?? 0}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function DayCell({
  date,
  todayKey,
  selected,
  count,
  onSelect,
}: {
  date: Date;
  todayKey: string;
  selected: string;
  count: number;
  onSelect: (dateKey: string) => void;
}) {
  const key = toDateKey(date);
  const isToday = key === todayKey;
  const isSelected = key === selected;
  const isPast = key < todayKey;
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const holidayName = sgPublicHolidayName(key);
  const isHoliday = Boolean(holidayName);
  const hasWork = count > 0;

  return (
    <button
      type="button"
      onClick={() => !isPast && onSelect(key)}
      disabled={isPast}
      title={holidayName}
      aria-current={isToday ? "date" : undefined}
      aria-pressed={isSelected}
      aria-label={dayAriaLabel(date, holidayName, count, isToday)}
      className={[
        "flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg px-0.5 py-1 transition-colors",
        isPast ? "cursor-not-allowed opacity-40" : "",
        isSelected && isHoliday
          ? "bg-red-100 ring-2 ring-[var(--brand-blue-hex)]"
          : isSelected
            ? "bg-[var(--brand-blue-hex)] text-white shadow-sm"
            : isHoliday
              ? "bg-red-50 ring-2 ring-red-400 hover:bg-red-100"
              : isToday
                ? "bg-white ring-2 ring-[var(--brand-teal-hex)]"
                : isWeekend
                  ? "bg-slate-200 ring-1 ring-slate-400 hover:bg-slate-300"
                  : "bg-white ring-1 ring-slate-300 hover:bg-[oklch(0.93_0.04_260)]",
      ].join(" ")}
    >
      {isToday && (
        <span
          className={[
            "mb-0.5 text-[8px] font-black uppercase tracking-wider",
            isSelected && !isHoliday ? "text-white/90" : "text-[var(--brand-blue-hex)]",
          ].join(" ")}
        >
          Today
        </span>
      )}
      {isHoliday && !isToday && (
        <span className="mb-0.5 text-[8px] font-black uppercase tracking-wider text-red-600">PH</span>
      )}
      <span
        className={[
          "text-[15px] font-black leading-none tabular-nums",
          isHoliday
            ? "text-red-600"
            : isSelected
              ? "text-white"
              : "text-slate-950",
        ].join(" ")}
      >
        {date.getDate()}
      </span>
      <span
        className={[
          "mt-1 inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums leading-none",
          hasWork
            ? isSelected && !isHoliday
              ? "bg-[var(--brand-teal-hex)] py-0.5 text-[var(--brand-blue-hex)]"
              : "bg-[oklch(0.88_0.12_178)] py-0.5 text-[var(--brand-blue-hex)]"
            : isSelected && !isHoliday
              ? "text-white/70"
              : "text-slate-500",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}
