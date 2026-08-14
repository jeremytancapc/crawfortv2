"use client";

import { PaperPlaneTilt } from "@phosphor-icons/react";
import { ActionPopover } from "./action-popover";
import { MESSAGE_TEMPLATES } from "@/lib/airconnect/helpers";

interface MessagePopoverProps {
  open: boolean;
  onClose: () => void;
  onSend: (templateLabel: string, text: string) => void;
  align?: "left" | "right";
}

/** Canned-template message sender - one click sends, no typing required. */
export function MessagePopover({ open, onClose, onSend, align }: MessagePopoverProps) {
  return (
    <ActionPopover open={open} onClose={onClose} align={align} width="w-80">
      <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Send message</p>
      <div className="flex flex-col gap-1.5">
        {MESSAGE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSend(template.label, template.text)}
            className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] p-2 text-left transition-colors hover:border-[var(--brand-teal-hex)] hover:bg-[var(--brand-teal-hex)]/5"
          >
            <PaperPlaneTilt size={14} weight="bold" className="mt-0.5 shrink-0 text-[var(--brand-teal-hex)]" />
            <span>
              <span className="block text-xs font-semibold text-[var(--text-primary)]">{template.label}</span>
              <span className="line-clamp-2 block text-[11px] text-[var(--text-tertiary)]">{template.text}</span>
            </span>
          </button>
        ))}
      </div>
    </ActionPopover>
  );
}
