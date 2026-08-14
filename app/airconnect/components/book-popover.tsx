"use client";

import { useState } from "react";
import { ActionPopover } from "./action-popover";

const TIME_SLOTS = ["9:00 am", "10:30 am", "11:00 am", "1:30 pm", "2:30 pm", "4:00 pm", "5:30 pm"];

function buildDateOptions(days = 7) {
  const options: { iso: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    options.push({
      iso: d.toISOString().slice(0, 10),
      label:
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric" }),
    });
  }
  return options;
}

interface BookPopoverProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (dateISO: string, timeLabel: string) => void;
  align?: "left" | "right";
}

/** Compact date + time slot picker - books an appointment in two taps. */
export function BookPopover({ open, onClose, onConfirm, align }: BookPopoverProps) {
  const dateOptions = buildDateOptions();
  const [dateISO, setDateISO] = useState(dateOptions[1]?.iso ?? dateOptions[0].iso);
  const [time, setTime] = useState<string | null>(null);

  return (
    <ActionPopover open={open} onClose={onClose} align={align} width="w-96">
      <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Book appointment</p>
      <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-1">
        {dateOptions.map((d) => (
          <button
            key={d.iso}
            type="button"
            onClick={() => setDateISO(d.iso)}
            className={[
              "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
              dateISO === d.iso ? "bg-[var(--brand-blue-hex)] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {TIME_SLOTS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTime(t)}
            className={[
              "rounded-lg py-1.5 text-[11px] font-semibold transition-colors",
              time === t ? "bg-[var(--brand-teal-hex)] text-[var(--brand-blue-hex)]" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          if (!time) return;
          onConfirm(dateISO, time);
          setTime(null);
        }}
        disabled={!time}
        className="mt-3 w-full rounded-lg bg-[var(--brand-blue-hex)] py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
      >
        Confirm booking
      </button>
    </ActionPopover>
  );
}
