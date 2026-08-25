"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CalendarCheck } from "@phosphor-icons/react";
import { useAirConnect } from "../airconnect-store";
import { getDueBucket, parseDateKey, toDateKey } from "@/lib/airconnect/helpers";
import { ACTIVE_QUEUE_STATUSES, isAscendH5Submitted, type Lead } from "@/lib/airconnect/types";
import { LeadRow, type LeadRowHandle } from "./lead-row";
import { KeyboardLegend } from "./keyboard-legend";
import { EmptyState } from "./empty-state";
import { SearchBar } from "./search-bar";
import { LeadPanel } from "./lead-panel";

const SECTION_META = {
  today: { label: "Due Today", icon: CalendarCheck, color: "text-[var(--brand-blue-hex)]" },
} as const;

function isTypingTarget(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

function matchesQueueFilters(lead: Lead, state: ReturnType<typeof useAirConnect>["state"]): boolean {
  if (lead.agentId !== state.currentAgentId) return false;
  if (!ACTIVE_QUEUE_STATUSES.includes(lead.status)) return false;
  if (!lead.followUpAt) return false;
  if (state.statusFilter !== "all" && lead.status !== state.statusFilter) return false;
  if (state.sourceFilter !== "all" && lead.source !== state.sourceFilter) return false;
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    const digitsQ = q.replace(/\D/g, "");
    const matchesName = lead.name.toLowerCase().includes(q);
    const matchesPhone = digitsQ.length > 0 && lead.phone.replace(/\D/g, "").includes(digitsQ);
    if (!matchesName && !matchesPhone) return false;
  }
  return true;
}

export function QueueView() {
  const { state, setSearch, setStatusFilter, setSourceFilter, setQueueTypeFilter, setQueueDate, selectLead } = useAirConnect();
  const [now, setNow] = useState(() => new Date());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, LeadRowHandle>>(new Map());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const todayKey = toDateKey(now);
  const viewingToday = state.queueDate === todayKey;
  const hasActiveFilters =
    Boolean(state.search.trim()) ||
    state.statusFilter !== "all" ||
    state.sourceFilter !== "all" ||
    state.queueTypeFilter !== "all" ||
    state.qualifyingReasonFilter !== "all";

  const baseFiltered = useMemo(
    () => state.leads.filter((lead) => matchesQueueFilters(lead, state)),
    [state]
  );

  const matchesQualifying = (lead: Lead) =>
    lead.status === "qualifying" &&
    (state.qualifyingReasonFilter === "all" || lead.qualifyingReason === state.qualifyingReasonFilter);

  const filtered = useMemo(() => {
    return baseFiltered.filter((lead) => {
      if (viewingToday) {
        const bucket = getDueBucket(lead, now);
        const inTodayQueue = bucket === "today";
        if (state.queueTypeFilter === "assigned") return inTodayQueue && lead.status === "assigned";
        if (state.queueTypeFilter === "qualifying") return inTodayQueue && matchesQualifying(lead);
        if (state.queueTypeFilter === "submitted") return inTodayQueue && isAscendH5Submitted(lead.eligibility);
        return inTodayQueue;
      }
      const onSelectedDate = toDateKey(new Date(lead.followUpAt as string)) === state.queueDate;
      if (state.queueTypeFilter === "assigned") return onSelectedDate && lead.status === "assigned";
      if (state.queueTypeFilter === "qualifying") return onSelectedDate && matchesQualifying(lead);
      if (state.queueTypeFilter === "submitted") return onSelectedDate && isAscendH5Submitted(lead.eligibility);
      return onSelectedDate;
    });
  }, [baseFiltered, viewingToday, state.queueTypeFilter, state.qualifyingReasonFilter, state.queueDate, now]);

  const groups = useMemo(() => {
    const due = [...filtered].sort(
      (a, b) => new Date(a.followUpAt as string).getTime() - new Date(b.followUpAt as string).getTime()
    );
    return { today: due };
  }, [filtered]);

  const qualifyingCountForDay = useMemo(() => {
    return state.leads.filter((lead) => {
      if (lead.agentId !== state.currentAgentId) return false;
      if (lead.status !== "qualifying") return false;
      if (!lead.followUpAt) return false;
      if (viewingToday) return getDueBucket(lead, now) === "today";
      return toDateKey(new Date(lead.followUpAt)) === state.queueDate;
    }).length;
  }, [state.leads, state.currentAgentId, viewingToday, state.queueDate, now]);

  const flatOrder = useMemo(
    () => groups.today.map((l) => l.id),
    [groups]
  );

  useEffect(() => {
    if (flatOrder.length === 0) {
      if (state.selectedLeadId) selectLead(null);
      setFocusedId(null);
      return;
    }
    if (!state.selectedLeadId || !flatOrder.includes(state.selectedLeadId)) {
      selectLead(flatOrder[0]);
      setFocusedId(flatOrder[0]);
      return;
    }
    setFocusedId(state.selectedLeadId);
  }, [flatOrder, state.selectedLeadId, selectLead]);

  useEffect(() => {
    function scrollRowIntoView(id: string | undefined) {
      if (!id) return;
      const el = listRef.current?.querySelector(`[data-lead-id="${id}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    function focusLead(id: string) {
      setFocusedId(id);
      selectLead(id);
      scrollRowIntoView(id);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || flatOrder.length === 0) return;

      const currentIndex = focusedId ? flatOrder.indexOf(focusedId) : -1;

      switch (e.key.toLowerCase()) {
        case "j": {
          e.preventDefault();
          const next = flatOrder[Math.min(currentIndex + 1, flatOrder.length - 1)];
          if (next) focusLead(next);
          return;
        }
        case "k": {
          e.preventDefault();
          const prev = flatOrder[Math.max(currentIndex - 1, 0)];
          if (prev) focusLead(prev);
          return;
        }
        case "c":
          if (focusedId) rowRefs.current.get(focusedId)?.triggerCall();
          return;
        case "n":
          if (focusedId) rowRefs.current.get(focusedId)?.openNote();
          return;
        case "m":
          if (focusedId) rowRefs.current.get(focusedId)?.openMessage();
          return;
        case "b":
          if (focusedId) rowRefs.current.get(focusedId)?.openBook();
          return;
        case "s":
          if (focusedId) rowRefs.current.get(focusedId)?.openSnooze();
          return;
        case "d":
          if (focusedId) rowRefs.current.get(focusedId)?.pushNextDay();
          return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flatOrder, focusedId, selectLead]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setSourceFilter("all");
    setQueueTypeFilter("all");
  }

  const viewedDate = parseDateKey(state.queueDate);
  const dateLabel = viewingToday
    ? undefined
    : viewedDate.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "short" });

  const sections: { key: "today"; leads: Lead[] }[] = [{ key: "today", leads: groups.today }];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SearchBar />

      <div className="flex min-h-0 flex-1">
        <div ref={listRef} className="scrollbar-thin min-w-0 flex-1 overflow-y-auto px-5 py-5">
          {filtered.length === 0 ? (
            <EmptyState
              hasFilters={hasActiveFilters}
              dateLabel={dateLabel}
              onClearFilters={hasActiveFilters ? clearFilters : undefined}
              onJumpToToday={!viewingToday ? () => setQueueDate(todayKey) : undefined}
            />
          ) : (
            <div className="flex flex-col gap-8 pb-10">
              {sections.map(({ key, leads }) => {
                if (leads.length === 0) return null;
                const meta = SECTION_META[key];
                const Icon = meta.icon;
                const label = key === "today" && !viewingToday ? dateLabel ?? meta.label : meta.label;
                return (
                  <section key={key}>
                    <div className="mb-3 flex items-center gap-2">
                      <Icon size={15} weight="fill" className={meta.color} />
                      <h2 className={`text-[13px] font-bold ${meta.color}`}>{label}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {qualifyingCountForDay}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3.5">
                      <AnimatePresence initial={false}>
                        {leads.map((lead) => (
                          <LeadRow
                            key={lead.id}
                            ref={(node) => {
                              if (node) rowRefs.current.set(lead.id, node);
                              else rowRefs.current.delete(lead.id);
                            }}
                            lead={lead}
                            now={now}
                            isSelected={state.selectedLeadId === lead.id}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </section>
                );
              })}

              <KeyboardLegend />
            </div>
          )}
        </div>

        <div className="w-[34%] min-w-[17rem] max-w-[24rem] shrink-0 border-l border-[var(--border-subtle)] bg-white">
          <LeadPanel variant="inline" />
        </div>
      </div>
    </div>
  );
}
