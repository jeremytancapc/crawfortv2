import { Keyboard } from "@phosphor-icons/react";

const SHORTCUTS: [string, string][] = [
  ["J / K", "Navigate"],
  ["C", "Call"],
  ["N", "Note"],
  ["M", "Message"],
  ["B", "Book"],
  ["S", "Snooze"],
  ["D", "Next day"],
];

export function KeyboardLegend() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[var(--border-medium)] bg-slate-50 px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
        <Keyboard size={14} />
        Shortcuts
      </span>
      {SHORTCUTS.map(([key, label]) => (
        <span key={key} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <kbd className="rounded-md border border-[var(--border-medium)] bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--text-secondary)] shadow-sm">
            {key}
          </kbd>
          {label}
        </span>
      ))}
    </div>
  );
}
