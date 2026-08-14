import { Confetti, FunnelSimple } from "@phosphor-icons/react";

interface EmptyStateProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function EmptyState({ hasFilters, onClearFilters }: EmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <FunnelSimple size={22} className="text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">No leads match your filters</p>
        <p className="text-xs text-[var(--text-tertiary)]">Try clearing search or filters to see more of today&rsquo;s queue.</p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-lg bg-[var(--brand-blue-hex)] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
        <Confetti size={26} weight="fill" className="text-emerald-500" />
      </div>
      <p className="text-sm font-bold text-[var(--text-primary)]">All caught up!</p>
      <p className="text-xs text-[var(--text-tertiary)]">No leads waiting for follow-up right now. Nice work clearing the queue.</p>
    </div>
  );
}
