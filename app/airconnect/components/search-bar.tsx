"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useAirConnect } from "../airconnect-store";

/** Full-width search banner. Square edges so it reads as a page strip, not a chip. */
export function SearchBar() {
  const { state, setSearch } = useAirConnect();

  return (
    <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-5 py-3">
      <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2">
        <MagnifyingGlass size={14} weight="bold" className="shrink-0 text-[var(--text-tertiary)]" />
        <input
          value={state.search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or phone..."
          aria-label="Search name or phone"
          className="w-full bg-transparent text-[13px] font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
      </div>
    </div>
  );
}
