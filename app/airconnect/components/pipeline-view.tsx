"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { STATUS_LABELS, STATUS_ORDER, type Lead, type LeadStatus } from "@/lib/airconnect/types";
import { useAirConnect } from "../airconnect-store";
import { formatDueLabel, formatRelativeTime, maskPhone } from "@/lib/airconnect/helpers";
import { QuickActions } from "./quick-actions";
import { LeadTagSummary } from "./lead-tags";
import { SearchBar } from "./search-bar";

const COLUMN_ACCENT: Record<LeadStatus, string> = {
  new: "border-t-slate-400",
  assigned: "border-t-blue-500",
  "no-response": "border-t-red-400",
  qualifying: "border-t-violet-500",
  "pending-booking": "border-t-amber-500",
  booked: "border-t-emerald-500",
  "not-eligible": "border-t-red-600",
  done: "border-t-slate-500",
};

function PipelineCard({ lead, alignRight, now }: { lead: Lead; alignRight: boolean; now: Date }) {
  const { selectLead } = useAirConnect();
  const lastNote = lead.notes[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ duration: 0.16 }}
      className="rounded-lg border border-[var(--border-subtle)] bg-white p-2.5 shadow-sm hover:shadow-md transition-shadow"
    >
      <button
        type="button"
        onClick={() => selectLead(lead.id)}
        className="block truncate text-left text-[13px] font-bold text-[var(--text-primary)] hover:text-[var(--brand-blue-hex)] hover:underline underline-offset-2"
      >
        {lead.name}
      </button>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
        <span>{maskPhone(lead.phone)}</span>
        <span aria-hidden>&middot;</span>
        <span>{lead.source}</span>
      </div>
      {lead.followUpAt && (
        <p className="mt-1 text-[11px] font-semibold text-[var(--text-secondary)]">{formatDueLabel(lead.followUpAt, now)}</p>
      )}
      {lastNote && <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-tertiary)]">{lastNote.text}</p>}
      <LeadTagSummary tags={lead.tags} />
      <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Updated {formatRelativeTime(lead.updatedAt, now)}</p>

      <div className="mt-2 border-t border-[var(--border-subtle)] pt-2">
        <QuickActions lead={lead} size="compact" align={alignRight ? "right" : "left"} />
      </div>
    </motion.div>
  );
}

export function PipelineView() {
  const { state } = useAirConnect();
  const [now] = useState(() => new Date());

  const leadsByStatus = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>();
    STATUS_ORDER.forEach((status) => map.set(status, []));
    state.leads
      .filter((lead) => lead.agentId === state.currentAgentId)
      .filter((lead) => (state.sourceFilter === "all" ? true : lead.source === state.sourceFilter))
      .filter((lead) => {
        if (!state.search.trim()) return true;
        const q = state.search.trim().toLowerCase();
        return lead.name.toLowerCase().includes(q) || lead.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""));
      })
      .forEach((lead) => map.get(lead.status)?.push(lead));
    map.forEach((leads) => leads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    return map;
  }, [state.leads, state.currentAgentId, state.sourceFilter, state.search]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SearchBar />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-6 py-5">
      <div className="flex h-full gap-4">
        {STATUS_ORDER.map((status, colIdx) => {
          const leads = leadsByStatus.get(status) ?? [];
          const alignRight = colIdx >= STATUS_ORDER.length - 2;
          return (
            <div
              key={status}
              className={`flex h-full w-72 shrink-0 flex-col rounded-xl border border-t-4 border-[var(--border-subtle)] bg-slate-50/60 ${COLUMN_ACCENT[status]}`}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <h3 className="text-xs font-bold text-[var(--text-primary)]">{STATUS_LABELS[status]}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[var(--text-tertiary)] shadow-sm">
                  {leads.length}
                </span>
              </div>
              <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-2.5 pb-3">
                {leads.length === 0 ? (
                  <p className="px-1 py-6 text-center text-[11px] text-[var(--text-tertiary)]">No leads here</p>
                ) : (
                  <AnimatePresence initial={false}>
                    {leads.map((lead) => (
                      <PipelineCard key={lead.id} lead={lead} alignRight={alignRight} now={now} />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
