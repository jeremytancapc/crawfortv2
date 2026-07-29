"use client";

import { useState } from "react";
import { ListBullets, Buildings } from "@phosphor-icons/react";
import { AppointmentList } from "./appointment-list";
import { FloorPlan } from "./floor-plan";

/**
 * Queue tab — two-panel on iPad landscape, toggled panels on mobile/portrait.
 */
export function QueueTab() {
  const [mobilePanel, setMobilePanel] = useState<"list" | "floor">("list");

  return (
    <>
      {/* ── iPad landscape: side-by-side panels ─────────────────────────── */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:h-full lg:min-h-0">
        {/* Left: Appointment list */}
        <div className="border-r border-slate-200 h-full min-h-0 overflow-hidden">
          <AppointmentList />
        </div>
        {/* Right: Floor plan */}
        <div className="h-full min-h-0 overflow-hidden">
          <FloorPlan />
        </div>
      </div>

      {/* ── Mobile: toggled panels ───────────────────────────────────────── */}
      <div className="flex flex-col h-full min-h-0 lg:hidden">
        {/* Toggle bar */}
        <div className="flex-shrink-0 flex items-center gap-2 p-3 border-b border-slate-100 bg-white">
          <button
            onClick={() => setMobilePanel("list")}
            className={[
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all duration-150",
              mobilePanel === "list"
                ? "bg-[#0033AA] text-white"
                : "bg-slate-100 text-slate-600",
            ].join(" ")}
          >
            <ListBullets size={16} />
            Queue List
          </button>
          <button
            onClick={() => setMobilePanel("floor")}
            className={[
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all duration-150",
              mobilePanel === "floor"
                ? "bg-[#0033AA] text-white"
                : "bg-slate-100 text-slate-600",
            ].join(" ")}
          >
            <Buildings size={16} />
            Floor Plan
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {mobilePanel === "list" ? <AppointmentList /> : <FloorPlan />}
        </div>
      </div>
    </>
  );
}
