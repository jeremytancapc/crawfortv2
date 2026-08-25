"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import {
  Phone,
  NotePencil,
  ChatCircleText,
  CalendarPlus,
  ClockCountdown,
  SkipForward,
  TagSimple,
} from "@phosphor-icons/react";
import type { Lead } from "@/lib/airconnect/types";
import { nextWorkingDayPreset, parseDateKey } from "@/lib/airconnect/helpers";
import { useAirConnect } from "../airconnect-store";
import { OutcomeChips } from "./outcome-chips";
import { NotePopover } from "./note-popover";
import { MessagePopover } from "./message-popover";
import { BookPopover } from "./book-popover";
import { SnoozeMenu } from "./snooze-menu";
import { StatusMenu } from "./status-menu";

type PanelKind = "note" | "message" | "book" | "snooze" | "status" | null;

export interface QuickActionsHandle {
  triggerCall: () => void;
  openNote: () => void;
  openMessage: () => void;
  openBook: () => void;
  openSnooze: () => void;
  pushNextDay: () => void;
}

interface QuickActionsProps {
  lead: Lead;
  size?: "default" | "compact";
  align?: "left" | "right";
  onOutcomeChipsChange?: (open: boolean) => void;
}

const BASE_BTN =
  "inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none";

export const QuickActions = forwardRef<QuickActionsHandle, QuickActionsProps>(function QuickActions(
  { lead, size = "default", align = "left", onOutcomeChipsChange },
  ref
) {
  const { state, setCallOutcome, addNote, sendMessage, bookAppointment, snoozeLead, setCloseReason } = useAirConnect();
  const [panel, setPanel] = useState<PanelKind>(null);
  const [showOutcome, setShowOutcome] = useState(false);

  const isDone = lead.status === "done";
  const sizing = size === "compact" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs";
  const iconSize = size === "compact" ? 13 : 14;
  const nextDay = nextWorkingDayPreset(parseDateKey(state.queueDate));

  function togglePanel(next: PanelKind) {
    setPanel((cur) => (cur === next ? null : next));
  }

  function openOutcome() {
    setShowOutcome(true);
    onOutcomeChipsChange?.(true);
  }

  function closeOutcome() {
    setShowOutcome(false);
    onOutcomeChipsChange?.(false);
  }

  useImperativeHandle(ref, () => ({
    triggerCall: openOutcome,
    openNote: () => togglePanel("note"),
    openMessage: () => togglePanel("message"),
    openBook: () => togglePanel("book"),
    openSnooze: () => togglePanel("snooze"),
    pushNextDay: () => {
      if (!isDone) pushNextWorkingDay();
    },
  }));

  function pushNextWorkingDay() {
    snoozeLead(lead.id, nextDay.until, nextDay.label);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={openOutcome}
          disabled={isDone}
          title="Call (C)"
          className={[BASE_BTN, sizing, "bg-[var(--brand-blue-hex)] text-white shadow-sm hover:opacity-90"].join(" ")}
        >
          <Phone size={iconSize} weight="fill" />
          Call
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => togglePanel("note")}
            disabled={isDone}
            title="Add note (N)"
            className={[BASE_BTN, sizing, "border border-[var(--border-medium)] bg-white text-slate-700 hover:border-[var(--brand-blue-hex)] hover:text-[var(--brand-blue-hex)]"].join(" ")}
          >
            <NotePencil size={iconSize} weight="bold" />
            Note
          </button>
          <NotePopover
            open={panel === "note"}
            onClose={() => setPanel(null)}
            align={align}
            onSave={(text) => {
              addNote(lead.id, text);
              setPanel(null);
            }}
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => togglePanel("message")}
            disabled={isDone}
            title="Send message (M)"
            className={[BASE_BTN, sizing, "border border-[var(--border-medium)] bg-white text-slate-700 hover:border-[var(--brand-teal-hex)] hover:text-[#0a8a78]"].join(" ")}
          >
            <ChatCircleText size={iconSize} weight="bold" />
            Message
          </button>
          <MessagePopover
            open={panel === "message"}
            onClose={() => setPanel(null)}
            align={align}
            onSend={(templateLabel, text) => {
              sendMessage(lead.id, templateLabel, text);
              setPanel(null);
            }}
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => togglePanel("book")}
            disabled={isDone}
            title="Book appointment (B)"
            className={[BASE_BTN, sizing, "border border-[var(--border-medium)] bg-white text-slate-700 hover:border-indigo-400 hover:text-indigo-600"].join(" ")}
          >
            <CalendarPlus size={iconSize} weight="bold" />
            Book
          </button>
          <BookPopover
            open={panel === "book"}
            onClose={() => setPanel(null)}
            align={align}
            onConfirm={(dateISO, timeLabel) => {
              bookAppointment(lead.id, dateISO, timeLabel);
              setPanel(null);
            }}
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => togglePanel("snooze")}
            disabled={isDone}
            title="Snooze (S)"
            className={[BASE_BTN, sizing, "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"].join(" ")}
          >
            <ClockCountdown size={iconSize} weight="bold" />
            Snooze
          </button>
          <SnoozeMenu
            open={panel === "snooze"}
            onClose={() => setPanel(null)}
            align={align}
            onSnooze={(until, label) => {
              snoozeLead(lead.id, until, label);
              setPanel(null);
            }}
          />
        </div>

        <button
          type="button"
          onClick={pushNextWorkingDay}
          disabled={isDone}
          title={`Push to next working day (D) — ${nextDay.label}`}
          className={[BASE_BTN, sizing, "bg-[var(--brand-blue-hex)] text-white shadow-sm hover:opacity-90"].join(" ")}
        >
          <SkipForward size={iconSize} weight="fill" />
          Next day
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => togglePanel("status")}
            title="Change status (blacklist / give up)"
            className={[BASE_BTN, sizing, "border border-[var(--border-medium)] bg-white text-slate-700 hover:border-[var(--brand-blue-hex)] hover:text-[var(--brand-blue-hex)]"].join(" ")}
          >
            <TagSimple size={iconSize} weight="bold" />
            Change Status
          </button>
          <StatusMenu
            open={panel === "status"}
            onClose={() => setPanel(null)}
            currentReason={lead.closeReason}
            onSelect={(reason) => {
              setCloseReason(lead.id, reason);
              setPanel(null);
            }}
          />
        </div>
      </div>

      {showOutcome && (
        <OutcomeChips
          onSelect={(outcome) => {
            setCallOutcome(lead.id, outcome);
            closeOutcome();
          }}
          onCancel={closeOutcome}
        />
      )}
    </div>
  );
});
