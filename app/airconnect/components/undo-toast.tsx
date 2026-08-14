"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowCounterClockwise, CheckCircle, Bell, CalendarCheck, X } from "@phosphor-icons/react";
import { useAirConnect } from "../airconnect-store";
import type { Toast } from "@/lib/airconnect/types";

const AUTO_DISMISS_MS = 5000;

const KIND_ICON: Record<Toast["kind"], typeof CheckCircle> = {
  snooze: CalendarCheck,
  done: CheckCircle,
  info: Bell,
  booking: CalendarCheck,
  status: Bell,
};

function ToastItem({ toast }: { toast: Toast }) {
  const { undoToast, dismissToast } = useAirConnect();
  const Icon = KIND_ICON[toast.kind];

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismissToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.18 } }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-white py-2.5 pl-3 pr-2 shadow-xl"
    >
      <Icon size={18} weight="fill" className="shrink-0 text-[var(--brand-blue-hex)]" />
      <p className="text-xs font-semibold text-[var(--text-primary)]">{toast.message}</p>
      {toast.undoSnapshot && (
        <button
          type="button"
          onClick={() => undoToast(toast.id)}
          className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-slate-200"
        >
          <ArrowCounterClockwise size={12} weight="bold" />
          Undo
        </button>
      )}
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss"
        className="shrink-0 rounded-lg p-1 text-[var(--text-tertiary)] hover:bg-slate-100"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

export function ToastStack() {
  const { state } = useAirConnect();

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
      <AnimatePresence initial={false}>
        {state.toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
