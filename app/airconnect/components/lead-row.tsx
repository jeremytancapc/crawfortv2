"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { motion } from "framer-motion";
import type { Lead } from "@/lib/airconnect/types";
import { useAirConnect } from "../airconnect-store";
import { formatDueLabel, formatRelativeTime, getDueBucket, maskPhone } from "@/lib/airconnect/helpers";
import { StatusPill } from "./status-pill";
import { QuickActions, type QuickActionsHandle } from "./quick-actions";

export type LeadRowHandle = QuickActionsHandle;

interface LeadRowProps {
  lead: Lead;
  now: Date;
  isFocused: boolean;
}

const NOTE_KIND_LABEL: Record<string, string> = {
  note: "Note",
  call: "Call",
  message: "Message",
  booking: "Booking",
  status: "Status",
  snooze: "Snoozed",
};

export const LeadRow = forwardRef<LeadRowHandle, LeadRowProps>(function LeadRow({ lead, now, isFocused }, ref) {
  const { selectLead } = useAirConnect();
  const qaRef = useRef<QuickActionsHandle>(null);

  useImperativeHandle(ref, () => ({
    triggerCall: () => qaRef.current?.triggerCall(),
    openNote: () => qaRef.current?.openNote(),
    openMessage: () => qaRef.current?.openMessage(),
    openBook: () => qaRef.current?.openBook(),
    openSnooze: () => qaRef.current?.openSnooze(),
    markDone: () => qaRef.current?.markDone(),
  }));

  const bucket = getDueBucket(lead, now);
  const dueColor =
    bucket === "overdue" ? "text-red-600" : bucket === "today" ? "text-[var(--brand-blue-hex)]" : "text-[var(--text-tertiary)]";
  const lastNote = lead.notes[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 48, height: 0, marginBottom: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      data-lead-id={lead.id}
      className={[
        "group rounded-xl border bg-white p-3 transition-shadow",
        isFocused
          ? "border-[var(--brand-blue-hex)] shadow-md ring-2 ring-[var(--brand-blue-hex)]/15"
          : "border-[var(--border-subtle)] hover:shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => selectLead(lead.id)}
              className="truncate text-sm font-bold text-[var(--text-primary)] underline-offset-2 hover:text-[var(--brand-blue-hex)] hover:underline"
            >
              {lead.name}
            </button>
            <StatusPill status={lead.status} />
            <span className="text-xs text-[var(--text-tertiary)]">{maskPhone(lead.phone)}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{lead.source}</span>
            {lead.loanAmountLabel && (
              <span className="text-[11px] font-semibold text-[var(--text-tertiary)]">{lead.loanAmountLabel}</span>
            )}
          </div>
          {lastNote && (
            <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-tertiary)]">{NOTE_KIND_LABEL[lastNote.kind] ?? "Note"}: </span>
              {lastNote.text}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {lead.followUpAt && <p className={`text-xs font-semibold ${dueColor}`}>{formatDueLabel(lead.followUpAt, now)}</p>}
          <p className="text-[11px] text-[var(--text-tertiary)]">Updated {formatRelativeTime(lead.updatedAt, now)}</p>
        </div>
      </div>

      <div className="mt-2.5 border-t border-[var(--border-subtle)] pt-2.5">
        <QuickActions ref={qaRef} lead={lead} />
      </div>
    </motion.div>
  );
});
