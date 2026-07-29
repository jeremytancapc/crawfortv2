"use client";

import Image from "next/image";
import Link from "next/link";
import type { RetailTab } from "./types";

const TAB_LABELS: Record<RetailTab, string> = {
  queue:        "Queue",
  applications: "Applications",
  loans:        "Loan Management",
};

const TABS: RetailTab[] = ["queue", "applications", "loans"];

interface RetailHeaderProps {
  activeTab: RetailTab;
  onTabChange: (tab: RetailTab) => void;
}

export function RetailHeader({ activeTab, onTabChange }: RetailHeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 flex flex-col lg:flex-row lg:items-center lg:justify-between px-4 lg:px-6 py-3 shadow-sm"
      style={{ background: "var(--brand-blue-hex)" }}
    >
      <div className="flex items-center w-full lg:w-auto">
        <Link href="/">
          <Image
            src="/images/crawfort-white.png"
            alt="Crawfort"
            width={151}
            height={20}
            className="h-5 w-auto"
            priority
          />
        </Link>
      </div>

      {/* Tab bar */}
      <nav
        className="mt-3 lg:mt-0 flex items-center gap-1 bg-white/10 rounded-md p-1"
        role="tablist"
        aria-label="CRM navigation"
      >
        {TABS.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab)}
              className={[
                "flex-1 lg:flex-none px-4 py-2 rounded-sm text-sm font-semibold transition-all duration-200",
                isActive
                  ? "bg-white text-[#0033AA] shadow-sm"
                  : "text-white/80 hover:text-white hover:bg-white/10",
              ].join(" ")}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
