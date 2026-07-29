"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Clock, Lightning, ArrowsClockwise, Plus, X } from "@phosphor-icons/react";
import type { AppointmentType, RetailCustomer, CustomerStatus } from "./types";
import { useRetail } from "./retail-store";
import { TIME_SLOTS } from "./mock-data";

// ─── Constants ────────────────────────────────────────────────────────────────

const APPT_CONFIGS: Record<AppointmentType, { label: string; shortLabel: string; color: string; bg: string; dot: string; badge: string }> = {
  "loan-application": {
    label: "Loan Application",
    shortLabel: "Loan",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
    badge: "bg-blue-500",
  },
  "customer-care": {
    label: "Customer Service",
    shortLabel: "Customer Service",
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
    dot: "bg-purple-500",
    badge: "bg-purple-500",
  },
  "cash-repayment": {
    label: "Cash Repayment",
    shortLabel: "Cash Repayment",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500",
  },
  "cash-disbursement": {
    label: "Cash Disbursement",
    shortLabel: "Cash Disbursement",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
    badge: "bg-amber-500",
  },
};

const STATUS_CONFIGS: Record<CustomerStatus, { label: string; color: string }> = {
  scheduled: { label: "Scheduled",  color: "text-slate-500" },
  queued:    { label: "Queued",     color: "text-amber-600" },
  called:    { label: "Called",     color: "text-orange-500" },
  serving:   { label: "Serving",    color: "text-green-600"  },
  done:      { label: "Done",       color: "text-slate-400"  },
};

type FilterType = AppointmentType | "all";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrentSlot(): string | null {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const totalMins = h * 60 + m;

  for (let i = 0; i < TIME_SLOTS.length; i++) {
    const [sh, sm] = TIME_SLOTS[i].split(":").map(Number);
    const slotStart = sh * 60 + sm;
    const slotEnd   = slotStart + 30;
    if (totalMins >= slotStart && totalMins < slotEnd) return TIME_SLOTS[i];
  }
  return null;
}

function slotLabel(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

function getNearestSlot(): string {
  const now = new Date();
  const totalMins = now.getHours() * 60 + now.getMinutes();
  for (const slot of TIME_SLOTS) {
    const [h, m] = slot.split(":").map(Number);
    if (h * 60 + m >= totalMins) return slot;
  }
  return TIME_SLOTS[TIME_SLOTS.length - 1];
}

// ─── Walk-in modal ────────────────────────────────────────────────────────────

interface WalkInModalProps {
  onClose: () => void;
}

function WalkInModal({ onClose }: WalkInModalProps) {
  const { registerWalkIn } = useRetail();
  const [name, setName] = useState("");
  const [apptType, setApptType] = useState<AppointmentType>("loan-application");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    registerWalkIn({
      name: name.trim(),
      mobile: "",
      nricLast4: "",
      appointmentType: apptType,
      slotTime: getNearestSlot(),
      notes: "Walk-in",
      isWalkIn: true,
      ascendStatus: apptType === "loan-application" ? "create" : null,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: "var(--brand-blue-hex)" }}
        >
          <div>
            <h3 className="text-white font-bold text-base">Walk-in Customer</h3>
            <p className="text-white/70 text-xs mt-0.5">Add to today&apos;s queue, then assign a station</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="walkin-name">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              id="walkin-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tan Wei Liang"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-800 placeholder-slate-400 text-base focus:outline-none focus:border-[#0033AA] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(APPT_CONFIGS) as AppointmentType[]).map((type) => {
                const cfg = APPT_CONFIGS[type];
                const isActive = apptType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setApptType(type)}
                    className={[
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left text-xs font-semibold transition-all",
                      isActive
                        ? `${cfg.bg} ${cfg.color}`
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    ].join(" ")}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <span className="leading-tight">{cfg.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "var(--brand-blue-hex)" }}
          >
            Add to Queue
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Customer Card ────────────────────────────────────────────────────────────

interface CustomerCardProps {
  customer: RetailCustomer;
  isSelected: boolean;
  onSelect: () => void;
  onAutoAssign: () => void;
  onReassign: () => void;
}

function CustomerCard({ customer, isSelected, onSelect, onAutoAssign, onReassign }: CustomerCardProps) {
  const cfg    = APPT_CONFIGS[customer.appointmentType];
  const status = STATUS_CONFIGS[customer.status];

  const stationLabel = customer.assignedStationId
    ? customer.assignedStationId
        .replace("kiosk-", "Kiosk ")
        .replace("room-",  "Room ")
        .replace("cashier-1", "Cashier")
    : null;

  return (
    <button
      onClick={onSelect}
      className={[
        "w-full text-left rounded-xl border-2 px-4 py-3 transition-all duration-200",
        isSelected
          ? "border-[#0033AA] shadow-lg bg-white"
          : "border-transparent bg-white hover:border-slate-200 hover:shadow-sm",
        customer.status === "done" ? "opacity-50" : "",
      ].join(" ")}
      style={isSelected ? { boxShadow: "0 0 0 3px rgba(0,51,170,0.15), 0 4px 16px rgba(0,51,170,0.10)" } : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Queue number — colored by appointment type */}
        <div
          className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-xs font-bold text-white ${cfg.badge}`}
        >
          {customer.queueNumber}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm text-slate-800 truncate">{customer.name}</span>
            <span className={`flex-shrink-0 text-xs font-semibold ${status.color}`}>
              {stationLabel ? `${status.label} @ ${stationLabel}` : status.label}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
              {cfg.shortLabel}
            </span>
            {customer.appointmentType === "loan-application" && customer.ascendStatus === "eligible" && (
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700">
                Ascend Eligible
              </span>
            )}
            {customer.appointmentType === "loan-application" && customer.ascendStatus === "create" && (
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
                Ascend Create
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded: assign / re-assign actions */}
      {isSelected && customer.status !== "done" && (
        <div
          className="mt-3 pt-3 border-t border-blue-100 flex items-center justify-between gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs text-blue-600 font-medium">
            {customer.status === "scheduled"
              ? "Tap a compatible station on the floor plan, or auto-assign."
              : customer.status === "queued"
              ? `In queue at ${stationLabel ?? "station"} — re-assign to move them.`
              : customer.status === "called"
              ? `Called to ${stationLabel ?? "station"} — re-assign to move them.`
              : `Serving at ${stationLabel ?? "station"} — re-assign to move them.`}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(customer.status === "queued" || customer.status === "called" || customer.status === "serving") && (
              <button
                onClick={onReassign}
                className="flex items-center gap-1.5 bg-white border-2 border-[#0033AA] text-[#0033AA] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-50 active:scale-95 transition-all"
              >
                <ArrowsClockwise size={12} weight="bold" />
                Re-assign
              </button>
            )}
            {customer.status === "scheduled" && (
              <button
                onClick={onAutoAssign}
                className="flex items-center gap-1.5 bg-[#0033AA] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90 active:scale-95 transition-all"
              >
                <Lightning size={12} weight="fill" />
                Auto Assign
              </button>
            )}
          </div>
        </div>
      )}
      {isSelected && customer.status === "done" && (
        <div
          className="mt-3 pt-3 border-t border-blue-100 flex items-center justify-between gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs text-slate-500 font-medium">
            Service completed — re-assign to put them back in the queue.
          </p>
          <button
            onClick={onReassign}
            className="flex items-center gap-1.5 bg-white border-2 border-[#0033AA] text-[#0033AA] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-50 active:scale-95 transition-all flex-shrink-0"
          >
            <ArrowsClockwise size={12} weight="bold" />
            Re-assign
          </button>
        </div>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AppointmentList() {
  const { state, selectCustomer, autoAssign, reassign } = useRetail();
  const [filter, setFilter] = useState<FilterType>("all");
  const [showWalkIn, setShowWalkIn] = useState(false);
  const currentSlot = useMemo(() => getCurrentSlot(), []);
  const nowRef = useRef<HTMLDivElement>(null);

  // Scroll "now" indicator into view on mount
  useEffect(() => {
    nowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const filteredCustomers = useMemo(() => {
    if (filter === "all") return state.customers;
    return state.customers.filter((c) => c.appointmentType === filter);
  }, [state.customers, filter]);

  // Group by slot
  const bySlot = useMemo(() => {
    const map = new Map<string, RetailCustomer[]>();
    TIME_SLOTS.forEach((slot) => map.set(slot, []));
    filteredCustomers.forEach((c) => {
      const arr = map.get(c.slotTime);
      if (arr) arr.push(c);
    });
    return map;
  }, [filteredCustomers]);

  const totalScheduled = state.customers.filter((c) => c.status !== "done").length;
  const totalServing   = state.customers.filter((c) => c.status === "serving" || c.status === "called").length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-slate-100 bg-white">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-800">Today&apos;s Queue</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalScheduled} waiting · {totalServing} serving now
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={14} />
              <span>{new Date().toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
            </div>
            <button
              onClick={() => setShowWalkIn(true)}
              className="flex items-center gap-1.5 bg-[#0033AA] text-white text-xs font-bold px-3 py-2 rounded-lg hover:opacity-90 active:scale-95 transition-all"
            >
              <Plus size={14} weight="bold" />
              Walk-in
            </button>
          </div>
        </div>

        {/* Filter chips — All Types on its own row, categories below */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={[
              "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border",
              filter === "all"
                ? "bg-[#0033AA] text-white border-[#0033AA]"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300",
            ].join(" ")}
          >
            All Types
          </button>
          <div className="grid grid-cols-2 gap-1.5">
            {(["loan-application", "customer-care", "cash-repayment", "cash-disbursement"] as const).map((f) => {
              const isActive = filter === f;
              const cfg = APPT_CONFIGS[f];
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={[
                    "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border truncate",
                    isActive
                      ? "bg-[#0033AA] text-white border-[#0033AA]"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300",
                  ].join(" ")}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-white" : cfg.dot}`} />
                  <span className="truncate">{cfg.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2">
        {TIME_SLOTS.map((slot) => {
          const customers = bySlot.get(slot) ?? [];
          const isNow     = slot === currentSlot;
          const isPast    = (() => {
            const [h, m] = slot.split(":").map(Number);
            const now = new Date();
            return now.getHours() * 60 + now.getMinutes() > h * 60 + m + 30;
          })();

          return (
            <div
              key={slot}
              ref={isNow ? nowRef : undefined}
              className="mb-1"
            >
              {/* Slot header */}
              <div className={`flex items-center gap-2 px-1 py-1.5 ${isPast && customers.length === 0 ? "opacity-30" : ""}`}>
                <span className={`text-xs font-bold w-16 flex-shrink-0 ${isNow ? "text-[#0033AA]" : "text-slate-400"}`}>
                  {slotLabel(slot)}
                </span>
                {isNow && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-px flex-1 bg-[#0033AA]/20" style={{ minWidth: "8px" }} />
                    <span className="text-[10px] font-bold text-[#0033AA] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      NOW
                    </span>
                    <div className="h-px flex-1 bg-[#0033AA]/20" style={{ minWidth: "8px" }} />
                  </div>
                )}
                {!isNow && customers.length === 0 && (
                  <div className="flex-1 h-px bg-slate-100" />
                )}
                {customers.length > 0 && !isNow && (
                  <div className="flex-1 h-px bg-slate-100" />
                )}
                {customers.length > 0 && (
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{customers.length} apt</span>
                )}
              </div>

              {/* Customer cards */}
              {customers.length > 0 && (
                <div className="space-y-1.5 pl-16">
                  {customers.map((c) => (
                    <CustomerCard
                      key={c.id}
                      customer={c}
                      isSelected={state.selectedCustomerId === c.id}
                      onSelect={() =>
                        selectCustomer(state.selectedCustomerId === c.id ? null : c.id)
                      }
                      onAutoAssign={() => autoAssign(c.id)}
                      onReassign={() => reassign(c.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="h-4" />
      </div>

      {showWalkIn && <WalkInModal onClose={() => setShowWalkIn(false)} />}
    </div>
  );
}
