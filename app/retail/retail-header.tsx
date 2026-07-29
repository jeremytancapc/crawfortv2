"use client";

import Image from "next/image";
import Link from "next/link";
import type { RetailTab } from "./types";
import { RETAIL_STAFF } from "./retail-staff";

const TAB_LABELS: Record<RetailTab, string> = {
  queue:        "Queue",
  applications: "Applications",
  loans:        "Loan Management",
};

const TABS: RetailTab[] = ["queue", "applications", "loans"];

interface RetailHeaderProps {
  activeTab: RetailTab;
  onTabChange: (tab: RetailTab) => void;
  isSettingsOpen: boolean;
  onToggleSettings: () => void;
}

function TabBar({
  activeTab,
  onTabChange,
  className,
}: {
  activeTab: RetailTab;
  onTabChange: (tab: RetailTab) => void;
  className?: string;
}) {
  return (
    <nav
      className={["flex items-center gap-1 bg-white/10 rounded-md p-1", className]
        .filter(Boolean)
        .join(" ")}
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
  );
}

function ProfileControls({
  isSettingsOpen,
  onToggleSettings,
}: {
  isSettingsOpen: boolean;
  onToggleSettings: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggleSettings}
      aria-label={`${RETAIL_STAFF.name} profile and settings`}
      aria-pressed={isSettingsOpen}
      className={[
        "flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors",
        isSettingsOpen
          ? "bg-white/20 ring-2 ring-white/60"
          : "bg-white/10 hover:bg-white/20",
      ].join(" ")}
    >
      <Image
        src={RETAIL_STAFF.avatarSrc}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 rounded-full object-cover ring-1 ring-white/40"
        aria-hidden
      />
      <span className="hidden sm:block max-w-[7.5rem] truncate text-left">
        <span className="block text-xs font-semibold leading-tight text-white">
          {RETAIL_STAFF.name}
        </span>
        <span className="block text-[10px] leading-tight text-white/70">
          {RETAIL_STAFF.role}
        </span>
      </span>
    </button>
  );
}

export function RetailHeader({
  activeTab,
  onTabChange,
  isSettingsOpen,
  onToggleSettings,
}: RetailHeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 flex flex-col px-4 lg:px-6 py-3 shadow-sm"
      style={{ background: "var(--brand-blue-hex)" }}
    >
      {/* Top row: logo | centered tabs (desktop) | profile top-right */}
      <div className="relative flex items-center justify-between gap-3">
        <Link href="/" className="relative z-10 shrink-0">
          <Image
            src="/images/crawfort-white.png"
            alt="Crawfort"
            width={151}
            height={20}
            className="h-5 w-auto"
            priority
          />
        </Link>

        {/* Desktop: tabs centered in the navbar */}
        {!isSettingsOpen && (
          <TabBar
            activeTab={activeTab}
            onTabChange={onTabChange}
            className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:flex"
          />
        )}

        <div className="relative z-10">
          <ProfileControls
            isSettingsOpen={isSettingsOpen}
            onToggleSettings={onToggleSettings}
          />
        </div>
      </div>

      {/* Tablet / mobile: tabs centered below logo + profile */}
      {!isSettingsOpen && (
        <div className="mt-3 flex justify-center lg:hidden">
          <TabBar
            activeTab={activeTab}
            onTabChange={onTabChange}
            className="w-full max-w-xl"
          />
        </div>
      )}
    </header>
  );
}
