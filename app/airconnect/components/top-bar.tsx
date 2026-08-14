"use client";

import { MagnifyingGlass, FunnelSimple, PhoneCall } from "@phosphor-icons/react";
import { useAirConnect, useAgents } from "../airconnect-store";
import { getDueBucket } from "@/lib/airconnect/helpers";
import { STATUS_LABELS, STATUS_ORDER, type LeadSource, type LeadStatus, type ViewMode } from "@/lib/airconnect/types";
import { ProgressRing } from "./progress-ring";

const VIEW_TABS: { id: ViewMode; label: string }[] = [
  { id: "queue", label: "Today's Queue" },
  { id: "pipeline", label: "Pipeline" },
  { id: "table", label: "All Leads" },
];

const SOURCES: LeadSource[] = ["SEO", "1% Loan", "MoneyRight", "Lendela", "Loanable", "Referral"];

export function TopBar() {
  const { state, switchAgent, setView, setSearch, setStatusFilter, setSourceFilter, toggleOverdueOnly } = useAirConnect();
  const agents = useAgents();
  const now = new Date();

  const baseline = state.dailyBaseline[state.currentAgentId] ?? [];
  const cleared = baseline.filter((id) => {
    const lead = state.leads.find((l) => l.id === id);
    if (!lead) return true;
    if (lead.status === "done" || lead.status === "not-eligible") return true;
    const bucket = getDueBucket(lead, now);
    return bucket !== "overdue" && bucket !== "today";
  }).length;
  const total = baseline.length;
  const counts = state.activityCounts[state.currentAgentId];

  return (
    <header className="shrink-0 border-b border-[var(--border-subtle)] bg-white">
      <div className="flex flex-wrap items-center gap-4 px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-blue-hex)]">
            <PhoneCall size={16} weight="fill" className="text-white" />
          </div>
          <span className="text-base font-black tracking-tight text-[var(--text-primary)]">AirConnect</span>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          {agents.map((agent) => {
            const active = agent.id === state.currentAgentId;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => switchAgent(agent.id)}
                className={[
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                  active ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
                style={active ? { color: agent.colorHex } : undefined}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
                  style={{ backgroundColor: agent.colorHex }}
                >
                  {agent.initials.slice(1)}
                </span>
                {agent.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] px-3 py-1.5">
          <ProgressRing cleared={cleared} total={total} />
          <div>
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {cleared} of {total} cleared today
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              {counts.calls} calls &middot; {counts.notes} notes &middot; {counts.booked} booked
            </p>
          </div>
        </div>

        <div className="ml-auto flex w-72 items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2">
          <MagnifyingGlass size={15} className="text-[var(--text-tertiary)]" />
          <input
            value={state.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-tertiary)]"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] px-6 py-2">
        <nav className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                state.activeView === tab.id ? "bg-white text-[var(--brand-blue-hex)] shadow-sm" : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="h-4 w-px bg-[var(--border-subtle)]" />

        <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto">
          <FunnelSimple size={13} className="shrink-0 text-[var(--text-tertiary)]" />
          <select
            value={state.statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
            className="rounded-md border border-[var(--border-subtle)] bg-white px-2 py-1 text-xs font-medium text-[var(--text-secondary)] outline-none"
          >
            <option value="all">All statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={state.sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as LeadSource | "all")}
            className="rounded-md border border-[var(--border-subtle)] bg-white px-2 py-1 text-xs font-medium text-[var(--text-secondary)] outline-none"
          >
            <option value="all">All sources</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={toggleOverdueOnly}
            className={[
              "rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors",
              state.overdueOnly ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
            ].join(" ")}
          >
            Overdue only
          </button>
        </div>
      </div>
    </header>
  );
}
