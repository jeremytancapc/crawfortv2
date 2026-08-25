"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useAirConnect } from "../airconnect-store";

/** Full-width search banner. Square edges so it reads as a page strip, not a chip. */
export function SearchBar() {
  const { state, setSearch } = useAirConnect();

  return (
    <div className="flex w-full items-center gap-3 border-4 border-black bg-white px-4 py-2.5">
      <MagnifyingGlass size={16} weight="bold" className="shrink-0 text-[var(--brand-blue-hex)]" />
      <input
        value={state.search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name or phone..."
        aria-label="Search name or phone"
        className="w-full bg-transparent text-sm font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
      />
    </div>
  );
}
