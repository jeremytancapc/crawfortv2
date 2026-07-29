"use client";

import { useState, useMemo } from "react";
import {
  User,
  Phone,
  IdentificationCard,
  Door,
  CheckCircle,
  X,
  ArrowRight,
  DesktopTower,
  CashRegister,
} from "@phosphor-icons/react";
import type { RetailCustomer, ConfirmedLoanPlan, StationType } from "./types";
import { useRetail } from "./retail-store";
import { LoanPlanReview } from "./loan-plan-review";
import { formatCurrency } from "./mock-data";
import {
  getStaffById,
  stationRequiresStaff,
  stationTypeFromId,
} from "./retail-staff";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ARRIVED_STATUSES = new Set(["queued", "called", "serving", "done"]);

function stationLabel(stationId: string | null): string {
  if (!stationId) return "-";
  return stationId
    .replace("room-", "Room ")
    .replace("kiosk-", "Kiosk ")
    .replace("cashier-1", "Cashier");
}

const STATUS_DOT: Record<string, string> = {
  queued:  "bg-amber-400",
  called:  "bg-orange-400",
  serving: "bg-emerald-500",
  done:    "bg-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  queued:  "Queued",
  called:  "Called",
  serving: "Serving",
  done:    "Done",
};

type StaffPresence = "summoned" | "present" | "idle";

function StationTypeIcon({ type }: { type: StationType | null }) {
  if (type === "kiosk") return <DesktopTower size={11} />;
  if (type === "cashier") return <CashRegister size={11} />;
  return <Door size={11} />;
}

function StaffPresenceIcon({ presence }: { presence: StaffPresence }) {
  if (presence === "summoned") {
    return (
      <span
        className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center"
        title="Staff summoned - not checked in"
        aria-label="Staff summoned"
      >
        <span className="absolute inset-0 rounded-full bg-red-400/50 animate-staff-presence-ping-red" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.65)] animate-staff-presence-glow-red" />
      </span>
    );
  }

  if (presence === "present") {
    return (
      <span
        className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center"
        title="Staff present and serving"
        aria-label="Staff present"
      >
        <span className="absolute inset-0 rounded-full bg-emerald-400/45 animate-staff-presence-ping-green" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.6)] animate-staff-presence-glow-green" />
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
      aria-hidden
    >
      <span className="h-2 w-2 rounded-full bg-slate-300" />
    </span>
  );
}

// ─── Confirmation popup ───────────────────────────────────────────────────────

interface ConfirmationPopupProps {
  customerName: string;
  plan: ConfirmedLoanPlan;
  onGoToQueue: () => void;
  onClose: () => void;
}

function ConfirmationPopup({ customerName, plan, onGoToQueue, onClose }: ConfirmationPopupProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ background: "var(--brand-blue-hex)" }}
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle size={22} weight="fill" className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base leading-tight">Loan Plan Updated</p>
            <p className="text-white/70 text-xs mt-0.5">{customerName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 text-white/70 hover:text-white transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            Loan plan updated, please assign customer to kiosk for loan disbursement.
          </p>

          {/* Confirmed summary */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { label: "Amount",     value: formatCurrency(plan.amount) },
              { label: "Tenure",     value: `${plan.tenureMonths} months` },
              { label: "Rate p.a.",  value: `${plan.interestRate}%` },
              { label: "Proc. Fee",  value: `${plan.processingFee}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-md px-3 py-2">
                <p className="text-[10px] text-slate-400">{label}</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action */}
        <div className="px-5 pb-5">
          <button
            onClick={onGoToQueue}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-md font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "var(--brand-blue-hex)" }}
          >
            Go to Queue
            <ArrowRight size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Customer row ─────────────────────────────────────────────────────────────

interface CustomerRowProps {
  customer: RetailCustomer;
  isConfirmed: boolean;
  isStaffSummoned: boolean;
  onClick: () => void;
}

function CustomerRow({ customer, isConfirmed, isStaffSummoned, onClick }: CustomerRowProps) {
  const dot   = STATUS_DOT[customer.status]   ?? "bg-slate-400";
  const label = STATUS_LABEL[customer.status] ?? customer.status;
  const stationType = stationTypeFromId(customer.assignedStationId);
  const station = stationLabel(customer.assignedStationId);
  const staff = getStaffById(customer.assignedStaffId);
  const needsStaff = stationType ? stationRequiresStaff(stationType) : false;

  let presence: StaffPresence = "idle";
  if (needsStaff && staff) {
    if (isStaffSummoned || customer.status === "called") presence = "summoned";
    else if (customer.status === "serving") presence = "present";
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center px-4 py-3.5 hover:bg-blue-50/50 transition-colors border-b border-slate-100 last:border-0 group"
    >
      {/* Status dot */}
      <div className="flex-shrink-0 w-8 flex justify-center">
        <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      </div>

      {/* Customer info */}
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-slate-800 truncate">{customer.name}</p>
          {isConfirmed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
              <CheckCircle size={10} weight="fill" />
              Plan saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Phone size={11} />
            {customer.mobile}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <IdentificationCard size={11} />
            {customer.nricLast4}
          </span>
        </div>

        {/* Staff / self-service line */}
        <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
          {stationType === "kiosk" ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <DesktopTower size={12} className="text-slate-400" />
              Self-service · No staff required
            </span>
          ) : needsStaff ? (
            <>
              <StaffPresenceIcon presence={presence} />
              {staff ? (
                <span className="min-w-0 truncate text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-800">{staff.name}</span>
                  <span className="text-slate-400"> · {staff.role}</span>
                  {presence === "summoned" && (
                    <span className="ml-1 font-semibold text-red-600">Summoned</span>
                  )}
                  {presence === "present" && (
                    <span className="ml-1 font-semibold text-emerald-600">Present</span>
                  )}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">Staff not allocated yet</span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-slate-400">No station assigned</span>
          )}
        </div>
      </div>

      {/* Queue # + Station */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1 mr-3">
        <span className="text-xs font-bold font-mono text-[#0033AA]">{customer.queueNumber}</span>
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <StationTypeIcon type={stationType} />
          {station}
        </span>
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0 mr-2">
        <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      </div>

      <ArrowRight size={14} className="flex-shrink-0 text-slate-300 group-hover:text-slate-400 transition-colors" />
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-slate-400 px-6 text-center">
      <User size={36} className="mb-3 opacity-30" />
      <p className="text-sm font-semibold text-slate-500">No customers arrived yet</p>
      <p className="text-xs mt-1 text-slate-400">
        Customer Service appointments will appear here once they check in via the Queue tab.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LoansTabProps {
  onNavigateToQueue: () => void;
}

export function LoansTab({ onNavigateToQueue }: LoansTabProps) {
  const { state, confirmLoanPlan, reassign } = useRetail();

  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [confirmingPlan, setConfirmingPlan] = useState<ConfirmedLoanPlan | null>(null);

  // Filtered: customer-care + already arrived
  const arrivedCustomers = useMemo(
    () => state.customers.filter(
      (c) => c.appointmentType === "customer-care" && ARRIVED_STATUSES.has(c.status),
    ),
    [state.customers],
  );

  const summary = useMemo(() => ({
    total:   arrivedCustomers.length,
    serving: arrivedCustomers.filter((c) => c.status === "serving" || c.status === "called").length,
    done:    arrivedCustomers.filter((c) => c.status === "done").length,
  }), [arrivedCustomers]);

  const selectedCustomer = useMemo(
    () => (selectedId ? arrivedCustomers.find((c) => c.id === selectedId) ?? null : null),
    [selectedId, arrivedCustomers],
  );
  const selectedOffer = selectedId ? state.loanOffers[selectedId] ?? null : null;
  const selectedPlan  = selectedId ? state.loanPlans[selectedId] ?? null : null;

  function handleConfirm(planDraft: Omit<ConfirmedLoanPlan, "confirmedAt">) {
    const plan: ConfirmedLoanPlan = { ...planDraft, confirmedAt: new Date().toISOString() };
    confirmLoanPlan(plan);
    setConfirmingPlan(plan);
  }

  function handleGoToQueue() {
    if (confirmingPlan) {
      reassign(confirmingPlan.customerId);
    }
    setConfirmingPlan(null);
    setSelectedId(null);
    onNavigateToQueue();
  }

  // ── Detail view ──────────────────────────────────────────────────────────
  if (selectedCustomer && selectedOffer) {
    return (
      <>
        <LoanPlanReview
          customer={selectedCustomer}
          offer={selectedOffer}
          existingPlan={selectedPlan}
          onBack={() => setSelectedId(null)}
          onConfirm={handleConfirm}
        />
        {confirmingPlan && (
          <ConfirmationPopup
            customerName={selectedCustomer.name}
            plan={confirmingPlan}
            onGoToQueue={handleGoToQueue}
            onClose={() => setConfirmingPlan(null)}
          />
        )}
      </>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-slate-100 bg-white">
        <h2 className="text-base font-bold text-slate-800 mb-3">Customers Servicing Now</h2>

        {/* Summary chips */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Arrived",   value: summary.total,   color: "text-slate-700",   bg: "bg-slate-50"   },
            { label: "In Session", value: summary.serving, color: "text-red-700",     bg: "bg-red-50"     },
            { label: "Done",      value: summary.done,    color: "text-slate-500",   bg: "bg-slate-50"   },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-md px-3 py-2.5 text-center`}>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Showing Customer Service appointments that have checked in today.
          Tap a customer to review and finalise their loan plan.
        </p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white">
        {/* Column headers - tablet+ */}
        <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] items-center px-4 py-2 bg-slate-50 border-b border-slate-200 sticky top-0 gap-3">
          <div className="w-8" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer / Staff</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Queue #</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Station</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</p>
        </div>

        {arrivedCustomers.length === 0 ? (
          <EmptyState />
        ) : (
          arrivedCustomers.map((c) => (
            <CustomerRow
              key={c.id}
              customer={c}
              isConfirmed={!!state.loanPlans[c.id]}
              isStaffSummoned={state.staffAlerts.some((a) => a.customerId === c.id)}
              onClick={() => setSelectedId(c.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

