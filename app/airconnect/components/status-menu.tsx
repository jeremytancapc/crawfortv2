"use client";

import { ActionPopover } from "./action-popover";
import { STATUS_LABELS, STATUS_ORDER, type LeadStatus } from "@/lib/airconnect/types";

interface StatusMenuProps {
  open: boolean;
  onClose: () => void;
  currentStatus: LeadStatus;
  onSelect: (status: LeadStatus) => void;
  align?: "left" | "right";
}

/** Manual status override - the escape hatch for moves the quick actions don't cover. */
export function StatusMenu({ open, onClose, currentStatus, onSelect, align }: StatusMenuProps) {
  return (
    <ActionPopover open={open} onClose={onClose} align={align} width="w-56">
      <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">Move to status</p>
      <div className="flex flex-col gap-0.5">
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onSelect(status)}
            className={[
              "rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors",
              status === currentStatus
                ? "bg-[var(--brand-blue-hex)]/10 text-[var(--brand-blue-hex)]"
                : "text-[var(--text-primary)] hover:bg-slate-100",
            ].join(" ")}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>
    </ActionPopover>
  );
}
