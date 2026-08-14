"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { WarningCircle, CalendarCheck, CalendarBlank } from "@phosphor-icons/react";
import { useAirConnect } from "../airconnect-store";
import { getDueBucket, type DueBucket } from "@/lib/airconnect/helpers";
import { ACTIVE_QUEUE_STATUSES, type Lead } from "@/lib/airconnect/types";
import { LeadRow, type LeadRowHandle } from "./lead-row";
import { KeyboardLegend } from "./keyboard-legend";
import { EmptyState } from "./empty-state";

const SECTION_META: Record<Exclude<DueBucket, null>, { label: string; icon: typeof WarningCircle; color: string }> = {
  overdue: { label: "Overdue", icon: WarningCircle, color: "text-red-600" },
  today: { label: "Due Today", icon: CalendarCheck, color: "text-[var(--brand-blue-hex)]" },
  upcoming: { label: "Upcoming", icon: CalendarBlank, color: "text-[var(--text-tertiary)]" },
};

const SECTION_ORDER: Exclude<DueBucket, null>[] = ["overdue", "today", "upcoming"];

function isTypingTarget(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export function QueueView() {
  const { state, setSearch, setStatusFilter, setSourceFilter } = useAirConnect();
  const [now, setNow] = useState(() => new Date());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, LeadRowHandle>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const hasActiveFilters = Boolean(state.search.trim()) || state.statusFilter !== "all" || state.sourceFilter !== "all" || state.overdueOnly;

  const filtered = useMemo(() => {
    return state.leads.filter((lead) => {
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
      if (state.overdueOnly && getDueBucket(lead, now) !== "overdue") return false;
      return true;
    });
  }, [state.leads, state.currentAgentId, state.statusFilter, state.sourceFilter, state.search, state.overdueOnly, now]);

  const groups = useMemo(() => {
    const buckets: Record<Exclude<DueBucket, null>, Lead[]> = { overdue: [], today: [], upcoming: [] };
    filtered.forEach((lead) => {
      const bucket = getDueBucket(lead, now);
      if (bucket) buckets[bucket].push(lead);
    });
    SECTION_ORDER.forEach((key) => {
      buckets[key].sort((a, b) => new Date(a.followUpAt as string).getTime() - new Date(b.followUpAt as string).getTime());
    });
    return buckets;
  }, [filtered, now]);

  const flatOrder = useMemo(() => SECTION_ORDER.flatMap((key) => groups[key]).map((l) => l.id), [groups]);

  useEffect(() => {
    if (focusedId && !flatOrder.includes(focusedId)) {
      setFocusedId(flatOrder[0] ?? null);
    } else if (!focusedId && flatOrder.length > 0) {
      setFocusedId(flatOrder[0]);
    }
  }, [flatOrder, focusedId]);

  useEffect(() => {
    function scrollRowIntoView(id: string | undefined) {
      if (!id) return;
      const el = containerRef.current?.querySelector(`[data-lead-id="${id}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || flatOrder.length === 0) return;

      const currentIndex = focusedId ? flatOrder.indexOf(focusedId) : -1;

      switch (e.key.toLowerCase()) {
        case "j": {
          e.preventDefault();
          const next = flatOrder[Math.min(currentIndex + 1, flatOrder.length - 1)];
          setFocusedId(next);
          scrollRowIntoView(next);
          return;
        }
        case "k": {
          e.preventDefault();
          const prev = flatOrder[Math.max(currentIndex - 1, 0)];
          setFocusedId(prev);
          scrollRowIntoView(prev);
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
          if (focusedId) rowRefs.current.get(focusedId)?.markDone();
          return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flatOrder, focusedId]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setSourceFilter("all");
  }

  return (
    <div ref={containerRef} className="scrollbar-thin h-full overflow-y-auto px-6 py-5">
      {filtered.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters} onClearFilters={hasActiveFilters ? clearFilters : undefined} />
      ) : (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-10">
          {SECTION_ORDER.map((key) => {
            const leads = groups[key];
            if (leads.length === 0) return null;
            const meta = SECTION_META[key];
            const Icon = meta.icon;
            return (
              <section key={key}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon size={16} weight="fill" className={meta.color} />
                  <h2 className={`text-sm font-bold ${meta.color}`}>{meta.label}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{leads.length}</span>
                </div>
                <div className="flex flex-col gap-2">
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
                        isFocused={focusedId === lead.id}
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
  );
}
