"use client";

import { useState } from "react";
import { ActionPopover } from "./action-popover";

const QUICK_PHRASES = [
  "No answer",
  "Asked to call back PM",
  "Sent info via WhatsApp",
  "Not interested",
  "Call back tomorrow",
];

interface NotePopoverProps {
  open: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  align?: "left" | "right";
}

/** Fast note capture - quick-phrase chips prefill the textarea, Enter saves. */
export function NotePopover({ open, onClose, onSave, align }: NotePopoverProps) {
  const [text, setText] = useState("");

  function submit() {
    if (!text.trim()) return;
    onSave(text.trim());
    setText("");
  }

  return (
    <ActionPopover open={open} onClose={() => { onClose(); setText(""); }} align={align} width="w-80">
      <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Quick note</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK_PHRASES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => setText((t) => (t ? `${t} ${phrase}.` : `${phrase}.`))}
            className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
          >
            {phrase}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") onClose();
        }}
        rows={3}
        placeholder="Note to self or about the customer..."
        className="w-full resize-none rounded-lg border border-[var(--border-subtle)] p-2 text-sm outline-none focus:border-[var(--brand-blue-hex)] focus:ring-2 focus:ring-[var(--brand-blue-hex)]/15"
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
    </ActionPopover>
  );
}
