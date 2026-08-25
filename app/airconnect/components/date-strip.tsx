"use client";

import { addDays, parseDateKey, startOfWeekMonday, toDateKey } from "@/lib/airconnect/helpers";
import { sgPublicHolidayName } from "@/lib/sg-public-holidays";

export interface DayTypeCounts {
  overdue: number;
  assigned: number;
  qualifying: number;
}

interface DateStripProps {
  selected: string;
  todayKey: string;
  counts: Record<string, DayTypeCounts>;
  onSelect: (dateKey: string) => void;
}

const EMPTY_COUNTS: DayTypeCounts = { overdue: 0, assigned: 0, qualifying: 0 };

const TYPE_PILLS = [
  { key: "overdue" as const, className: "bg-red-100 text-red-700" },
  { key: "assigned" as const, className: "bg-blue-100 text-[var(--brand-blue-hex)]" },
  { key: "qualifying" as const, className: "bg-violet-100 text-violet-700" },
];

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

const SIMULATED_TODAY = { overdue: 3, assigned: 40, qualifying: 50 } as const;

function dayAriaLabel(date: Date, holidayName: string | undefined, types: DayTypeCounts, isToday: boolean): string {
  const base = date.toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const bits = [base];
  if (isToday) bits.push("today");
  if (holidayName) bits.push(`${holidayName}, public holiday`);
  bits.push(`${types.overdue} overdue, ${types.assigned} assigned, ${types.qualifying} qualifying`);
  return bits.join(", ");
}

function TypeCountPills({ types, muted }: { types: DayTypeCounts; muted: boolean }) {
  const pills = TYPE_PILLS.filter((pill) => types[pill.key] > 0);
  if (pills.length === 0) {
    return (
      <span className={`text-[9px] font-semibold leading-none ${muted ? "text-white/80" : "text-slate-400"}`}>0</span>
    );
  }
  return (
    <span className="flex flex-wrap items-center justify-center gap-0.5">
      {pills.map((pill) => (
        <span
          key={pill.key}
          className={`inline-flex min-w-[1rem] items-center justify-center rounded-full px-1 py-[1px] text-[8px] font-black leading-none tabular-nums ${pill.className}`}
        >
          {types[pill.key]}
        </span>
      ))}
    </span>
  );
}

/**
 * Compact two-week Mon–Sun calendar for the queue, embedded in the sticky
 * navbar beside the performance table. Row 1 is the week containing the
 * selected date; row 2 is the following week.
 */
export function DateStrip({ selected, todayKey, counts, onSelect }: DateStripProps) {
  const todayMondayKey = mondayKey(parseDateKey(todayKey));
  const selectedMondayKey = mondayKey(parseDateKey(selected));
  const anchorKey = clampMonday(selectedMondayKey, todayMondayKey);
  const weekStart = parseDateKey(anchorKey);
  const weekEnd = addDays(weekStart, 13);
  const thisWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const nextWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i + 7));
  const viewingToday = selected === todayKey;

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <p className="shrink-0 text-[11px] font-semibold tracking-tight text-[var(--brand-blue-hex)]">
          {formatRangeLabel(weekStart, weekEnd)}
        </p>
        <button
          type="button"
          onClick={() => onSelect(todayKey)}
          disabled={viewingToday}
          aria-label="Jump to today"
          className={[
            "h-6 shrink-0 rounded-md px-2 text-[10px] font-semibold",
            viewingToday
              ? "bg-white text-[var(--brand-blue-hex)] shadow-sm ring-1 ring-[oklch(0.78_0.06_260)] disabled:opacity-30"
              : "bg-[var(--brand-blue-hex)] text-white hover:bg-[oklch(0.28_0.14_260)]",
          ].join(" ")}
        >
          Today
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
          className="h-6 w-[7.25rem] shrink-0 rounded-md border border-[oklch(0.72_0.08_260)] bg-white px-1.5 text-[10px] font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--brand-blue-hex)]"
        />
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-md ring-1 ring-slate-300">
        {WEEKDAYS.map((label, i) => {
          const isOffDay = i === 6; // Sunday only - Saturday is a working day
          return (
            <div
              key={label}
              className={[
                "border-b border-slate-300 bg-slate-100 py-0.5 text-center text-[8px] font-black uppercase tracking-[0.06em]",
                isOffDay ? "text-slate-500" : "text-[var(--brand-blue-hex)]",
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
            types={toDateKey(date) === todayKey ? SIMULATED_TODAY : (counts[toDateKey(date)] ?? EMPTY_COUNTS)}
            onSelect={onSelect}
          />
        ))}
        {nextWeek.map((date) => (
          <DayCell
            key={toDateKey(date)}
            date={date}
            todayKey={todayKey}
            selected={selected}
            types={toDateKey(date) === todayKey ? SIMULATED_TODAY : (counts[toDateKey(date)] ?? EMPTY_COUNTS)}
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
  types,
  onSelect,
}: {
  date: Date;
  todayKey: string;
  selected: string;
  types: DayTypeCounts;
  onSelect: (dateKey: string) => void;
}) {
  const key = toDateKey(date);
  const isToday = key === todayKey;
  const isSelected = key === selected;
  const isPast = key < todayKey;
  const isOffDay = date.getDay() === 0; // Sunday only - Saturday is a working day, no leads due on Sundays
  const holidayName = sgPublicHolidayName(key);
  const isHoliday = Boolean(holidayName);

  return (
    <button
      type="button"
      onClick={() => !isPast && onSelect(key)}
      disabled={isPast}
      title={holidayName}
      aria-current={isToday ? "date" : undefined}
      aria-pressed={isSelected}
      aria-label={dayAriaLabel(date, holidayName, types, isToday)}
      className={[
        "flex min-h-[2.5rem] flex-col items-center justify-center gap-0.5 border-b border-r border-slate-300 px-0.5 py-0.5 transition-colors [&:nth-child(7n)]:border-r-0",
        isPast ? "cursor-not-allowed opacity-40" : "",
        isHoliday
          ? isSelected
            ? "bg-red-600 text-white ring-2 ring-inset ring-[var(--brand-blue-hex)]"
            : "bg-red-600 text-white hover:bg-red-700"
          : isSelected
            ? "bg-[var(--brand-blue-hex)] text-white"
            : isToday
              ? "bg-white ring-2 ring-inset ring-[var(--brand-blue-hex)]"
              : isOffDay
                ? "bg-slate-200 hover:bg-slate-300"
                : "bg-white hover:bg-[oklch(0.93_0.04_260)]",
      ].join(" ")}
    >
      <span
        className={[
          "text-[11px] font-black leading-none tabular-nums",
          isHoliday || isSelected ? "text-white" : "text-slate-950",
        ].join(" ")}
      >
        {date.getDate()}{" "}
        <span className="text-[8px] font-bold tracking-tight">
          {date.toLocaleDateString("en-SG", { month: "short" })}
        </span>
      </span>
      <TypeCountPills types={types} muted={isHoliday || isSelected} />
    </button>
  );
}
