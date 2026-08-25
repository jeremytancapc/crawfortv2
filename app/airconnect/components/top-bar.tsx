"use client";

import { useMemo } from "react";
import { useAirConnect } from "../airconnect-store";
import { agentPerformance, type PeriodStats } from "@/lib/airconnect/performance";
import { getDueBucket, toDateKey } from "@/lib/airconnect/helpers";
import {
  ACTIVE_QUEUE_STATUSES,
  QUALIFYING_REASON_LABELS,
  type Lead,
  type QualifyingReason,
  type QueueTypeFilter,
} from "@/lib/airconnect/types";
import { DateStrip, type DayTypeCounts } from "./date-strip";

const QUEUE_TYPES: {
  id: Exclude<QueueTypeFilter, "all">;
  label: string;
  count: number;
  fill: string;
  fillActive: string;
  countBg: string;
  countBgActive: string;
}[] = [
  {
    id: "overdue",
    label: "Overdue",
    count: 3,
    fill: "bg-red-600 text-white shadow-sm hover:bg-red-700",
    fillActive: "bg-red-700 text-white shadow-sm ring-2 ring-red-950/50 ring-offset-2 ring-offset-[oklch(0.97_0.015_260)]",
    countBg: "bg-white/25 text-white",
    countBgActive: "bg-white/35 text-white",
  },
  {
    id: "assigned",
    label: "Assigned",
    count: 40,
    fill: "bg-[var(--brand-blue-hex)] text-white shadow-sm hover:bg-[oklch(0.28_0.14_260)]",
    fillActive: "bg-[oklch(0.28_0.14_260)] text-white shadow-sm ring-2 ring-blue-950/50 ring-offset-2 ring-offset-[oklch(0.97_0.015_260)]",
    countBg: "bg-white/25 text-white",
    countBgActive: "bg-white/35 text-white",
  },
  {
    id: "qualifying",
    label: "Qualifying",
    count: 50,
    fill: "bg-violet-600 text-white shadow-sm hover:bg-violet-700",
    fillActive: "bg-violet-800 text-white shadow-sm ring-2 ring-violet-950/50 ring-offset-2 ring-offset-[oklch(0.97_0.015_260)]",
    countBg: "bg-white/25 text-white",
    countBgActive: "bg-white/35 text-white",
  },
  {
    id: "submitted",
    label: "Ascend / H5 submitted",
    count: 18,
    fill: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
    fillActive: "bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-950/50 ring-offset-2 ring-offset-[oklch(0.97_0.015_260)]",
    countBg: "bg-white/25 text-white",
    countBgActive: "bg-white/35 text-white",
  },
];

const QUALIFYING_REASON_COUNTS: Record<QualifyingReason, number> = {
  "no-reply": 20,
  "interest-rate-fees": 15,
  "bad-timing": 10,
  "didnt-book": 5,
};

const QUALIFYING_REASONS: QualifyingReason[] = ["no-reply", "interest-rate-fees", "bad-timing", "didnt-book"];

const PERF_COLUMNS: { key: keyof PeriodStats; label: string; title: string }[] = [
  { key: "appointments", label: "Appts", title: "Appointments booked" },
  { key: "tur", label: "TUR", title: "Turned up for appointment" },
  { key: "turPct", label: "TUR%", title: "Turn-ups divided by appointments" },
  { key: "done", label: "Done", title: "Closed after turning up (~85% of TUR)" },
  { key: "r", label: "R", title: "Rejected" },
  { key: "rs", label: "RS", title: "Rescheduled" },
  { key: "prs", label: "PRS", title: "Pending reschedule" },
];

function formatStat(key: keyof PeriodStats, value: number): string {
  return key === "turPct" ? `${value}%` : String(value);
}

export function TopBar() {
  const { state, setView, setQueueTypeFilter, setQualifyingReasonFilter, setQueueDate } = useAirConnect();
  const now = useMemo(() => new Date(), []);
  const todayKey = toDateKey(now);
  const performance = useMemo(
    () => agentPerformance(state.leads, state.currentAgentId, now),
    [state.leads, state.currentAgentId, now]
  );

  const dateCounts = useMemo(() => {
    const counts: Record<string, DayTypeCounts> = {};
    const bump = (key: string, lead: Lead) => {
      const current = counts[key] ?? { overdue: 0, assigned: 0, qualifying: 0 };
      if (getDueBucket(lead, now) === "overdue") current.overdue += 1;
      if (lead.status === "assigned") current.assigned += 1;
      if (lead.status === "qualifying") current.qualifying += 1;
      counts[key] = current;
    };
    state.leads.forEach((lead) => {
      if (lead.agentId !== state.currentAgentId) return;
      if (!ACTIVE_QUEUE_STATUSES.includes(lead.status)) return;
      if (!lead.followUpAt) return;
      const bucket = getDueBucket(lead, now);
      if (bucket === "overdue" || bucket === "today") bump(todayKey, lead);
      const key = toDateKey(new Date(lead.followUpAt));
      if (key !== todayKey) bump(key, lead);
    });
    return counts;
  }, [state.leads, state.currentAgentId, now, todayKey]);

  function toggleType(id: Exclude<QueueTypeFilter, "all">) {
    setQueueTypeFilter(state.queueTypeFilter === id ? "all" : id);
    if (state.activeView !== "queue") setView("queue");
  }

  function toggleQualifyingReason(reason: QualifyingReason) {
    setQualifyingReasonFilter(state.qualifyingReasonFilter === reason ? "all" : reason);
    if (state.activeView !== "queue") setView("queue");
  }

  function handleSelectDate(dateKey: string) {
    setQueueDate(dateKey);
    if (state.activeView !== "queue") setView("queue");
  }

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-[var(--border-subtle)] bg-white">
      <div className="flex items-stretch gap-5 bg-[oklch(0.97_0.015_260)] px-5 py-3.5">
        <div className="min-w-[18rem] shrink-0 basis-[29rem]">
          <DateStrip selected={state.queueDate} todayKey={todayKey} counts={dateCounts} onSelect={handleSelectDate} />
        </div>

        <div className="scrollbar-thin -my-2 min-w-0 flex-1 overflow-x-auto">
          <table className="h-full w-full min-w-[22rem] table-fixed border-collapse bg-white text-center text-[11px] leading-tight">
            <caption className="sr-only">Agent performance today, this week, and this month</caption>
            <colgroup>
              <col className="w-14" />
              {PERF_COLUMNS.map((col) => (
                <col key={col.key} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="border border-black bg-black px-1 py-1 text-left text-[9px] font-bold uppercase tracking-tight text-white break-words leading-[1.15]">
                  {now.toLocaleDateString("en-SG", { month: "long" })}
                </th>
                {PERF_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    title={col.title}
                    className="border border-black bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {(
                [
                  ["Today", performance.today, true],
                  ["Week", performance.week, false],
                  ["Month", performance.month, false],
                ] as const
              ).map(([label, row, isToday]) => (
                <tr key={label} className={isToday ? "text-[var(--brand-blue-hex)]" : "text-[var(--text-secondary)]"}>
                  <th className="border border-black bg-black px-1 py-1 text-left font-bold text-white">
                    {label}
                  </th>
                  {PERF_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      title={col.title}
                      className={[
                        "border border-[var(--border-subtle)] px-2 py-1 font-semibold",
                        col.key === "turPct" ? "text-[#0a8a78]" : "",
                      ].join(" ")}
                    >
                      {formatStat(col.key, row[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] px-5 py-2.5">
        {QUEUE_TYPES.map((type) => {
          const active = state.queueTypeFilter === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => toggleType(type.id)}
              aria-pressed={active}
              className={[
                "flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] font-bold transition-colors",
                active ? type.fillActive : type.fill,
              ].join(" ")}
            >
              <span className="leading-none">{type.label}</span>
              <span
                className={[
                  "inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-black tabular-nums leading-none",
                  active ? type.countBgActive : type.countBg,
                ].join(" ")}
              >
                {type.count}
              </span>
            </button>
          );
        })}

        <div className="mx-1.5 h-5 w-px shrink-0 bg-[var(--border-subtle)]" aria-hidden="true" />

        {QUALIFYING_REASONS.map((reason) => {
          const active = state.qualifyingReasonFilter === reason;
          return (
            <button
              key={reason}
              type="button"
              onClick={() => toggleQualifyingReason(reason)}
              aria-pressed={active}
              className={[
                "flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-semibold transition-colors",
                active
                  ? "bg-violet-600 text-white shadow-sm ring-2 ring-violet-950/40 ring-offset-2 ring-offset-[oklch(0.97_0.015_260)]"
                  : "bg-white text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50",
              ].join(" ")}
            >
              <span className="leading-none">{QUALIFYING_REASON_LABELS[reason]}</span>
              <span
                className={[
                  "inline-flex min-w-[1rem] items-center justify-center rounded-full px-1 py-0.5 text-[9px] font-black tabular-nums leading-none",
                  active ? "bg-white/30 text-white" : "bg-violet-100 text-violet-700",
                ].join(" ")}
              >
                {QUALIFYING_REASON_COUNTS[reason]}
              </span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
