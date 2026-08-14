"use client";

import { useState } from "react";
import { ActionPopover } from "./action-popover";
import { buildSnoozePresets } from "@/lib/airconnect/helpers";

interface SnoozeMenuProps {
  open: boolean;
  onClose: () => void;
  onSnooze: (until: string, label: string) => void;
  align?: "left" | "right";
}

/** One-click presets to move a lead out of Today's follow-up. */
export function SnoozeMenu({ open, onClose, onSnooze, align }: SnoozeMenuProps) {
  const presets = buildSnoozePresets(new Date());
  const [customDate, setCustomDate] = useState("");

  return (
    <ActionPopover open={open} onClose={onClose} align={align} width="w-72">
      <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Snooze follow-up</p>
      <div className="flex flex-col gap-0.5">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSnooze(preset.until, preset.label)}
            className="rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--text-primary)] hover:bg-slate-100"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="mt-2 border-t border-[var(--border-subtle)] pt-2">
        <label className="mb-1 block text-[11px] font-semibold text-[var(--text-tertiary)]">Pick a date</label>
        <div className="flex gap-1.5">
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--border-subtle)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-blue-hex)]"
          />
          <button
            type="button"
            onClick={() => {
              if (!customDate) return;
              const until = new Date(`${customDate}T09:00:00`).toISOString();
              const label = new Date(until).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
              onSnooze(until, label);
              setCustomDate("");
            }}
            disabled={!customDate}
            className="rounded-lg bg-[var(--brand-blue-hex)] px-3 text-xs font-semibold text-white disabled:opacity-40"
          >
            Set
          </button>
        </div>
      </div>
    </ActionPopover>
  );
}
