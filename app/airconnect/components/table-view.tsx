"use client";

import { useMemo, useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import type { Lead } from "@/lib/airconnect/types";
import { useAirConnect } from "../airconnect-store";
import { formatDueLabel, formatRelativeTime, maskPhone } from "@/lib/airconnect/helpers";
import { StatusPill } from "./status-pill";
import { QuickActions } from "./quick-actions";
import { LeadTagSummary } from "./lead-tags";
import { SearchBar } from "./search-bar";

type SortKey = "name" | "status" | "followUpAt" | "updatedAt" | "source";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "followUpAt", label: "Follow-up" },
  { key: "source", label: "Source" },
  { key: "updatedAt", label: "Updated" },
];

export function TableView() {
  const { state } = useAirConnect();
  const [now] = useState(() => new Date());
  const [sortKey, setSortKey] = useState<SortKey>("followUpAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    let leads = state.leads.filter((lead) => lead.agentId === state.currentAgentId);

    if (state.statusFilter !== "all") leads = leads.filter((l) => l.status === state.statusFilter);
    if (state.sourceFilter !== "all") leads = leads.filter((l) => l.source === state.sourceFilter);
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      leads = leads.filter((l) => l.name.toLowerCase().includes(q) || l.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")));
    }

    const sorted = [...leads].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "source":
          cmp = a.source.localeCompare(b.source);
          break;
        case "followUpAt":
          cmp = (a.followUpAt ? new Date(a.followUpAt).getTime() : Infinity) - (b.followUpAt ? new Date(b.followUpAt).getTime() : Infinity);
          break;
        case "updatedAt":
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [state.leads, state.currentAgentId, state.statusFilter, state.sourceFilter, state.search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SearchBar />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto px-6 py-5">
      <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-[var(--surface-primary)]">
          <tr>
            {COLUMNS.map((col) => (
              <th key={col.key} className="border-b border-[var(--border-subtle)] px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                >
                  {col.label}
                  {sortKey === col.key && (sortDir === "asc" ? <CaretUp size={11} /> : <CaretDown size={11} />)}
                </button>
              </th>
            ))}
            <th className="border-b border-[var(--border-subtle)] px-3 py-2 text-left">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Last Note</span>
            </th>
            <th className="border-b border-[var(--border-subtle)] px-3 py-2 text-right">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-16 text-center text-sm text-[var(--text-tertiary)]">
                No leads match your filters.
              </td>
            </tr>
          ) : (
            rows.map((lead) => <TableRow key={lead.id} lead={lead} now={now} />)
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function TableRow({ lead, now }: { lead: Lead; now: Date }) {
  const { selectLead } = useAirConnect();
  const lastNote = lead.notes[0];

  return (
    <tr className="group hover:bg-slate-50">
      <td className="max-w-[220px] border-b border-[var(--border-subtle)] px-3 py-2.5">
        <button
          type="button"
          onClick={() => selectLead(lead.id)}
          className="block truncate text-left text-sm font-bold text-[var(--text-primary)] hover:text-[var(--brand-blue-hex)] hover:underline underline-offset-2"
        >
          {lead.name}
        </button>
        <span className="text-xs text-[var(--text-tertiary)]">{maskPhone(lead.phone)}</span>
        <LeadTagSummary tags={lead.tags} />
      </td>
      <td className="border-b border-[var(--border-subtle)] px-3 py-2.5">
        <StatusPill status={lead.status} />
      </td>
      <td className="border-b border-[var(--border-subtle)] px-3 py-2.5 text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap">
        {lead.followUpAt ? formatDueLabel(lead.followUpAt, now) : "—"}
      </td>
      <td className="border-b border-[var(--border-subtle)] px-3 py-2.5">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{lead.source}</span>
      </td>
      <td className="border-b border-[var(--border-subtle)] px-3 py-2.5 text-xs text-[var(--text-tertiary)] whitespace-nowrap">
        {formatRelativeTime(lead.updatedAt, now)}
      </td>
      <td className="max-w-[240px] border-b border-[var(--border-subtle)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
        <span className="line-clamp-1">{lastNote?.text ?? "—"}</span>
      </td>
      <td className="border-b border-[var(--border-subtle)] px-3 py-2.5">
        <div className="flex justify-end opacity-40 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <QuickActions lead={lead} size="compact" align="right" />
        </div>
      </td>
    </tr>
  );
}
