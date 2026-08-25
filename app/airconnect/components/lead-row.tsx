"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { motion } from "framer-motion";
import type { Lead } from "@/lib/airconnect/types";
import { useAirConnect } from "../airconnect-store";
import { formatDueLabel, formatRelativeTime, getDueBucket, maskPhone } from "@/lib/airconnect/helpers";
import { StatusPill } from "./status-pill";
import { CopyPhoneButton } from "./copy-phone-button";
import { QuickActions, type QuickActionsHandle } from "./quick-actions";
import { EligibilityDisplay, LeadTagsPicker, SectionBar } from "./lead-tags";

export type LeadRowHandle = QuickActionsHandle;

interface LeadRowProps {
  lead: Lead;
  now: Date;
  isSelected: boolean;
}

const NOTE_KIND_LABEL: Record<string, string> = {
  note: "Note",
  call: "Call",
  message: "Message",
  booking: "Booking",
  status: "Status",
  snooze: "Snoozed",
};

export const LeadRow = forwardRef<LeadRowHandle, LeadRowProps>(function LeadRow({ lead, now, isSelected }, ref) {
  const { selectLead } = useAirConnect();
  const qaRef = useRef<QuickActionsHandle>(null);

  useImperativeHandle(ref, () => ({
    triggerCall: () => qaRef.current?.triggerCall(),
    openNote: () => qaRef.current?.openNote(),
    openMessage: () => qaRef.current?.openMessage(),
    openBook: () => qaRef.current?.openBook(),
    openSnooze: () => qaRef.current?.openSnooze(),
    pushNextDay: () => qaRef.current?.pushNextDay(),
  }));

  const bucket = getDueBucket(lead, now);
  const lastNote = lead.notes[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 48, height: 0, marginBottom: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      data-lead-id={lead.id}
      onClick={() => selectLead(lead.id)}
      className={[
        "group relative cursor-pointer rounded-xl border p-3 transition-colors transition-shadow",
        isSelected
          ? "border-[var(--brand-blue-hex)] bg-[oklch(0.96_0.02_260)] shadow-md ring-1 ring-[var(--brand-blue-hex)]"
          : "border-[var(--border-subtle)] bg-white hover:shadow-sm",
      ].join(" ")}
    >
      <div className="-mx-3 -mt-3 grid grid-cols-2 overflow-hidden rounded-t-[11px]">
        <SectionBar tone="name" flush large>
          {lead.name}
        </SectionBar>
        <SectionBar tone="info" flush>
          Customer Info
        </SectionBar>
      </div>

      <div className="grid grid-cols-2 gap-x-3 pt-2.5">
        <div className="min-w-0">
          <div className="space-y-2 pr-3">
            <div className="flex items-start justify-between gap-2">
              <StatusPill status={lead.status} />
              {lead.followUpAt && (
                <span
                  className={[
                    "inline-flex max-w-[58%] shrink-0 items-center justify-center rounded-md px-1.5 py-1 text-right text-[10px] font-bold leading-tight",
                    bucket === "overdue"
                      ? "bg-red-600 text-white"
                      : bucket === "today"
                        ? "bg-[var(--brand-blue-hex)] text-white"
                        : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  {formatDueLabel(lead.followUpAt, now)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[var(--text-tertiary)]">
              <span className="inline-flex items-center gap-0.5">
                {maskPhone(lead.phone)}
                <CopyPhoneButton phone={lead.phone} />
              </span>
              <span aria-hidden>&middot;</span>
              <span>{lead.source}</span>
              {lead.loanAmountLabel && (
                <>
                  <span aria-hidden>&middot;</span>
                  <span className="font-semibold">{lead.loanAmountLabel}</span>
                </>
              )}
            </div>
            {lastNote && (
              <p className="text-[12px] leading-snug text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-tertiary)]">{NOTE_KIND_LABEL[lastNote.kind] ?? "Note"}: </span>
                {lastNote.text}
              </p>
            )}
            <div className="flex flex-col gap-0.5 text-[11px] text-[var(--text-tertiary)]">
              <p>Created {formatRelativeTime(lead.createdAt, now)}</p>
              <p>Updated {formatRelativeTime(lead.updatedAt, now)}</p>
            </div>
          </div>
          <EligibilityDisplay lead={lead} flush className="-ml-3" />
        </div>

        <div className="min-w-0 border-l border-[var(--border-subtle)] pl-3">
          <LeadTagsPicker lead={lead} />
        </div>
      </div>

      <div className="mt-2.5 border-t border-[var(--border-subtle)] pt-2.5" onClick={(e) => e.stopPropagation()}>
        <QuickActions ref={qaRef} lead={lead} size="compact" />
      </div>
    </motion.div>
  );
});
