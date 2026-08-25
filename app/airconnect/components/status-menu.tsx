"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "@phosphor-icons/react";
import { useClickOutside } from "./use-click-outside";
import { CLOSE_REASON_LABELS, CLOSE_REASON_ORDER, type CloseReason } from "@/lib/airconnect/types";

interface StatusMenuProps {
  open: boolean;
  onClose: () => void;
  currentReason: CloseReason | null;
  onSelect: (reason: CloseReason) => void;
}

/**
 * Close-out disposition - blacklists or gives up on a lead. Lead cards can be
 * quite narrow, and this list has 16 long options, so it renders as a
 * viewport-centered modal instead of a small anchored popover - an anchored
 * popover this size would spill off-screen or over neighbouring cards no
 * matter which side it opened on.
 */
export function StatusMenu({ open, onClose, currentReason, onSelect }: StatusMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
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
            <p className="mb-1.5 px-2.5 text-xs font-semibold text-[var(--text-secondary)]">Close reason</p>
            <div role="listbox" aria-label="Close reason" className="max-h-[min(28rem,70vh)] overflow-y-auto">
              <button
                type="button"
                onClick={onClose}
                role="option"
                aria-selected={currentReason === null}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-slate-100"
              >
                <Check size={14} weight="bold" className={currentReason === null ? "shrink-0 text-[var(--brand-blue-hex)]" : "invisible shrink-0"} />
                <span className={currentReason === null ? "" : "text-[var(--text-tertiary)]"}>Select a reason...</span>
              </button>

              <div className="my-1 border-t border-[var(--border-subtle)]" />

              {CLOSE_REASON_ORDER.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => onSelect(reason)}
                  role="option"
                  aria-selected={reason === currentReason}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-slate-100"
                >
                  <Check size={14} weight="bold" className={reason === currentReason ? "shrink-0 text-[var(--brand-blue-hex)]" : "invisible shrink-0"} />
                  <span>{CLOSE_REASON_LABELS[reason]}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
