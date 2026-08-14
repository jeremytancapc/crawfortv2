"use client";

import { motion } from "framer-motion";
import { X } from "@phosphor-icons/react";
import { CALL_OUTCOME_LABELS } from "@/lib/airconnect/helpers";
import type { CallOutcome } from "@/lib/airconnect/types";

const OUTCOMES: CallOutcome[] = ["no-answer", "call-back", "interested", "not-eligible"];

const OUTCOME_STYLES: Record<CallOutcome, string> = {
  "no-answer": "bg-slate-100 text-slate-700 hover:bg-slate-200",
  "call-back": "bg-amber-50 text-amber-700 hover:bg-amber-100 ring-1 ring-amber-200",
  interested: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-200",
  "not-eligible": "bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-red-200",
};

interface OutcomeChipsProps {
  onSelect: (outcome: CallOutcome) => void;
  onCancel: () => void;
}

/** Inline outcome capture shown right after an agent logs a call - the fastest path to clearing a lead. */
export function OutcomeChips({ onSelect, onCancel }: OutcomeChipsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0, marginTop: 0 }}
      animate={{ opacity: 1, height: "auto", marginTop: 8 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-wrap items-center gap-1.5 overflow-hidden"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
        Call outcome
      </span>
      {OUTCOMES.map((outcome) => (
        <button
          key={outcome}
          type="button"
          onClick={() => onSelect(outcome)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${OUTCOME_STYLES[outcome]}`}
        >
          {CALL_OUTCOME_LABELS[outcome]}
        </button>
      ))}
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel call log"
        className="ml-auto rounded-full p-1 text-[var(--text-tertiary)] hover:bg-slate-100 hover:text-[var(--text-secondary)]"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
