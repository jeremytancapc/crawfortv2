"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ClockCountdown } from "@phosphor-icons/react";
import { useClickOutside } from "./use-click-outside";
import { buildSnoozePresets } from "@/lib/airconnect/helpers";

interface SnoozeMenuProps {
  open: boolean;
  onClose: () => void;
  onSnooze: (until: string, label: string) => void;
}

/**
 * Follow-up snooze picker. Renders as a viewport-centered modal so it matches
 * Change Status and stays readable on narrow lead cards.
 */
export function SnoozeMenu({ open, onClose, onSnooze }: SnoozeMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [customDate, setCustomDate] = useState("");
  const presets = buildSnoozePresets(new Date());
  useClickOutside(ref, onClose, open);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-slate-900/25"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-50 w-[24rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border-subtle)] bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1.5 px-2.5 text-xs font-semibold text-[var(--text-secondary)]">Snooze follow-up</p>
            <div role="listbox" aria-label="Snooze follow-up">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSnooze(preset.until, preset.label)}
                  role="option"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-slate-100"
                >
                  <ClockCountdown size={14} weight="bold" className="shrink-0 text-[var(--text-tertiary)]" />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            <div className="my-1 border-t border-[var(--border-subtle)]" />

            <div className="px-2.5 pt-1.5">
              <label className="mb-1.5 block text-[11px] font-semibold text-[var(--text-tertiary)]">Pick a date</label>
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="flex-1 rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--brand-blue-hex)]"
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
                  className="rounded-md bg-[var(--brand-blue-hex)] px-3 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Set
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
