"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Phone,
  CalendarCheck,
  NotePencil,
  ChatCircleText,
  ChatCircleDots,
  Sparkle,
  TagSimple,
  ClockCountdown,
  UserFocus,
  Copy,
  Check,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { useAirConnect } from "../airconnect-store";
import { formatDueLabel, formatRelativeTime } from "@/lib/airconnect/helpers";
import type { Lead, NoteKind } from "@/lib/airconnect/types";
import { StatusPill } from "./status-pill";
import { CopyPhoneButton } from "./copy-phone-button";
import { QuickActions } from "./quick-actions";
import { EligibilityDisplay, LeadTagsPicker, SectionBar } from "./lead-tags";
import { QUICK_PHRASES } from "./note-popover";

const NOTE_KIND_ICON: Record<NoteKind, typeof NotePencil> = {
  note: NotePencil,
  call: Phone,
  message: ChatCircleText,
  booking: CalendarCheck,
  status: TagSimple,
  snooze: ClockCountdown,
};

function NoteComposer({ leadId }: { leadId: string }) {
  const { addNote } = useAirConnect();
  const [text, setText] = useState("");

  function submit() {
    if (!text.trim()) return;
    addNote(leadId, text.trim());
    setText("");
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-slate-50/80 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Add a note</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK_PHRASES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => setText((t) => (t ? `${t} ${phrase}.` : `${phrase}.`))}
            className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-[var(--border-subtle)] hover:bg-slate-100"
          >
            {phrase}
          </button>
        ))}
      </div>
      <textarea
        key={leadId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        placeholder="What happened on this call..."
        className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-white p-2 text-sm outline-none focus:border-[var(--brand-blue-hex)] focus:ring-2 focus:ring-[var(--brand-blue-hex)]/15"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-tertiary)]">Enter to save</span>
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          className="rounded-lg bg-[var(--brand-blue-hex)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
        >
          Save note
        </button>
      </div>
    </div>
  );
}

function LeadFacts({ lead, now }: { lead: Lead; now: Date }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Phone</p>
          <div className="flex items-center gap-1">
            <a href={`tel:${lead.phone}`} className="text-sm font-semibold text-[var(--brand-blue-hex)] hover:underline">
              {lead.phone}
            </a>
            <CopyPhoneButton phone={lead.phone} size={13} />
          </div>
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

      <div className="mt-3">
        <EligibilityDisplay lead={lead} />
      </div>

      <div className="mt-3">
        <SectionBar tone="info" className="mb-2">
          Customer Info
        </SectionBar>
        <LeadTagsPicker lead={lead} />
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
    </>
  );
}

function ActivityTimeline({ lead, now }: { lead: Lead; now: Date }) {
  return (
    <div>
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
  );
}

function LeadDetailBody({ lead, now, actionAlign }: { lead: Lead; now: Date; actionAlign: "left" | "right" }) {
  return (
    <>
      <LeadFacts lead={lead} now={now} />
      <div className="mt-4">
        <NoteComposer leadId={lead.id} />
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Quick actions</p>
        <QuickActions lead={lead} align={actionAlign} />
      </div>
      <div className="mt-5">
        <ActivityTimeline lead={lead} now={now} />
      </div>
    </>
  );
}

function PainPointCard({ painPoint }: { painPoint: string | null }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <ChatCircleDots size={14} weight="fill" className="text-amber-600" />
        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Customer&apos;s Pain Point</p>
      </div>
      <p className="text-sm leading-snug text-amber-900">
        {painPoint ?? "No open objections yet - lead hasn't been engaged on a blocker."}
      </p>
    </div>
  );
}

function AiReplyCard({ lead, aiSuggestedReply }: { lead: Lead; aiSuggestedReply: string | null }) {
  const { sendMessage } = useAirConnect();
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  async function copyReply() {
    if (!aiSuggestedReply) return;
    try {
      await navigator.clipboard.writeText(aiSuggestedReply);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail in insecure contexts; leave the button unchanged.
    }
  }

  function send() {
    if (!aiSuggestedReply) return;
    sendMessage(lead.id, "AI Suggested Reply", aiSuggestedReply);
    setSent(true);
    window.setTimeout(() => setSent(false), 1500);
  }

  return (
    <div className="rounded-xl border border-[var(--brand-teal-hex)]/30 bg-[var(--brand-teal-hex)]/5 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkle size={14} weight="fill" className="text-[var(--brand-teal-hex)]" />
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#0a8a78]">AI Suggested Reply</p>
      </div>
      <p className="text-sm leading-snug text-[var(--text-primary)]">
        {aiSuggestedReply ?? "No suggestion yet - add a note once you've spoken with the customer."}
      </p>
      {aiSuggestedReply && (
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={copyReply}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-medium)] bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:border-[var(--brand-teal-hex)] hover:text-[#0a8a78]"
          >
            {copied ? <Check size={12} weight="bold" className="text-emerald-600" /> : <Copy size={12} weight="bold" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={send}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-teal-hex)] px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <PaperPlaneTilt size={12} weight="bold" />
            {sent ? "Sent" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}

function TalkingPointBody({ lead, actionAlign }: { lead: Lead; actionAlign: "left" | "right" }) {
  return (
    <div className="flex flex-col gap-4">
      <PainPointCard painPoint={lead.painPoint} />
      <AiReplyCard lead={lead} aiSuggestedReply={lead.aiSuggestedReply} />
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Quick actions</p>
        <QuickActions lead={lead} align={actionAlign} size="compact" />
      </div>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <UserFocus size={22} className="text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-[var(--text-primary)]">Select a lead</p>
      <p className="max-w-[16rem] text-xs text-[var(--text-tertiary)]">
        Click a card to see the full number, add a note, and work the follow-up without leaving the queue.
      </p>
    </div>
  );
}

interface LeadPanelProps {
  variant?: "overlay" | "inline";
}

export function LeadPanel({ variant = "overlay" }: LeadPanelProps) {
  const { state, selectLead } = useAirConnect();
  const lead = state.leads.find((l) => l.id === state.selectedLeadId) ?? null;
  const now = new Date();

  useEffect(() => {
    if (variant !== "overlay" || !lead) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") selectLead(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lead, selectLead, variant]);

  if (variant === "inline") {
    return (
      <aside className="flex h-full min-h-0 flex-col bg-white">
        {lead ? (
          <>
            <div className="shrink-0 border-b border-[var(--border-subtle)] px-5 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="min-w-0 truncate text-sm font-bold text-[var(--text-primary)]">{lead.name}</h2>
                <a
                  href={`tel:${lead.phone}`}
                  className="shrink-0 text-xs font-semibold text-[var(--brand-blue-hex)] hover:underline"
                >
                  {lead.phone}
                </a>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <StatusPill status={lead.status} />
                <span className="text-xs text-[var(--text-tertiary)]">{lead.source}</span>
                {lead.followUpAt && (
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    {formatDueLabel(lead.followUpAt, now)}
                  </span>
                )}
              </div>
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <TalkingPointBody lead={lead} actionAlign="right" />
            </div>
          </>
        ) : (
          <EmptyDetail />
        )}
      </aside>
    );
  }

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
              <LeadDetailBody lead={lead} now={now} actionAlign="right" />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
