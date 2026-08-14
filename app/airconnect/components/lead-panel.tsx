"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Phone, CalendarCheck, NotePencil, ChatCircleText, TagSimple, ClockCountdown } from "@phosphor-icons/react";
import { useAirConnect } from "../airconnect-store";
import { formatDueLabel, formatRelativeTime } from "@/lib/airconnect/helpers";
import type { NoteKind } from "@/lib/airconnect/types";
import { StatusPill } from "./status-pill";
import { QuickActions } from "./quick-actions";

const NOTE_KIND_ICON: Record<NoteKind, typeof NotePencil> = {
  note: NotePencil,
  call: Phone,
  message: ChatCircleText,
  booking: CalendarCheck,
  status: TagSimple,
  snooze: ClockCountdown,
};

export function LeadPanel() {
  const { state, selectLead } = useAirConnect();
  const lead = state.leads.find((l) => l.id === state.selectedLeadId) ?? null;
  const now = new Date();

  useEffect(() => {
    if (!lead) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") selectLead(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lead, selectLead]);

  return (
    <AnimatePresence>
      {lead && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-slate-900/20"
            onClick={() => selectLead(null)}
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-[var(--border-subtle)] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-[var(--border-subtle)] px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-[var(--text-primary)]">{lead.name}</h2>
                <div className="mt-1 flex items-center gap-2">
                  <StatusPill status={lead.status} />
                  <span className="text-xs text-[var(--text-tertiary)]">{lead.source}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => selectLead(null)}
                aria-label="Close panel"
                className="shrink-0 rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Phone</p>
                  <a href={`tel:${lead.phone}`} className="text-sm font-semibold text-[var(--brand-blue-hex)] hover:underline">
                    {lead.phone}
                  </a>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Loan amount</p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{lead.loanAmountLabel ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Created</p>
                  <p className="text-sm text-[var(--text-secondary)]">{formatRelativeTime(lead.createdAt, now)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Next follow-up</p>
                  <p className="text-sm text-[var(--text-secondary)]">{lead.followUpAt ? formatDueLabel(lead.followUpAt, now) : "—"}</p>
                </div>
              </div>

              {lead.appointment && (
                <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <CalendarCheck size={18} weight="fill" className="shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-emerald-700">Appointment booked</p>
                    <p className="text-xs text-emerald-600">
                      {new Date(lead.appointment.dateISO).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })},{" "}
                      {lead.appointment.timeLabel}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Quick actions</p>
                <QuickActions lead={lead} align="right" />
              </div>

              <div className="mt-5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">
                  Activity ({lead.notes.length})
                </p>
                {lead.notes.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)]">No notes yet.</p>
                ) : (
                  <ol className="relative flex flex-col gap-4 border-l border-[var(--border-subtle)] pl-4">
                    {lead.notes.map((note) => {
                      const Icon = NOTE_KIND_ICON[note.kind] ?? NotePencil;
                      return (
                        <li key={note.id} className="relative">
                          <span className="absolute -left-[21px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-[var(--brand-blue-hex)]/20">
                            <Icon size={10} weight="bold" className="text-[var(--brand-blue-hex)]" />
                          </span>
                          <p className="text-xs text-[var(--text-primary)]">{note.text}</p>
                          <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{formatRelativeTime(note.createdAt, now)}</p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
