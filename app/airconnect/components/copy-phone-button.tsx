"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

interface CopyPhoneButtonProps {
  phone: string;
  size?: number;
}

/** Copies the full phone number. Click does not select the parent card. */
export function CopyPhoneButton({ phone, size = 12 }: CopyPhoneButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail in insecure contexts; leave the icon unchanged.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : "Copy phone number"}
      aria-label={copied ? "Phone number copied" : "Copy phone number"}
      className="inline-flex items-center justify-center rounded p-0.5 text-[var(--text-tertiary)] transition-colors hover:bg-slate-100 hover:text-[var(--brand-blue-hex)]"
    >
      {copied ? <Check size={size} weight="bold" className="text-emerald-600" /> : <Copy size={size} weight="bold" />}
    </button>
  );
}
