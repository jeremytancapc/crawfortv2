"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, MapPin, User, X, CheckCircle } from "@phosphor-icons/react";
import type { AppointmentType, RetailCustomer, Station } from "./types";
import { useRetail } from "./retail-store";
import { RETAIL_STAFF } from "./retail-staff";

const APPT_LABELS: Record<AppointmentType, string> = {
  "loan-application": "Loan Application",
  "customer-care": "Customer Service",
  "cash-repayment": "Cash Repayment",
  "cash-disbursement": "Cash Disbursement",
};

function slotLabel(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

// ─── Details popup ────────────────────────────────────────────────────────────

interface AlertDetailsPopupProps {
  customer: RetailCustomer;
  station: Station;
  onClose: () => void;
  onAttend: () => void;
}

function AlertDetailsPopup({
  customer,
  station,
  onClose,
  onAttend,
}: AlertDetailsPopupProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-alert-title"
    >
      <div
        className="w-full max-w-sm bg-white rounded-md shadow-2xl overflow-hidden animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ background: "var(--brand-blue-hex)" }}
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
            <MapPin size={22} weight="fill" className="text-white" />
            <span className="absolute inset-0 rounded-full bg-amber-400/40 animate-staff-alert-ping" />
          </div>
          <div className="min-w-0 flex-1">
            <p id="staff-alert-title" className="text-base font-bold leading-tight text-white">
              Required at {station.label}
            </p>
            <p className="mt-0.5 text-xs text-white/70">
              Customer is waiting — please attend now
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-1 text-white/70 transition-colors hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
              <User size={20} weight="duotone" className="text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-900">{customer.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {APPT_LABELS[customer.appointmentType]} · {slotLabel(customer.slotTime)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Queue no.", value: customer.queueNumber },
              { label: "Station", value: station.label },
              { label: "NRIC", value: `****${customer.nricLast4}` },
              { label: "Mobile", value: customer.mobile },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-md bg-slate-50 px-3 py-2">
                <p className="text-[10px] text-slate-400">{label}</p>
                <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          {customer.notes ? (
            <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Notes
              </p>
              <p className="mt-0.5 text-sm text-amber-900">{customer.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onAttend}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-800 py-3.5 text-sm font-bold text-white transition-all hover:bg-emerald-900 active:scale-[0.98]"
          >
            <CheckCircle size={18} weight="bold" />
            Attend to customer
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Tap when you arrive at {station.label}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Header banner ────────────────────────────────────────────────────────────

export function StaffAlertBanner() {
  const { state, attendCustomer } = useRetail();
  const [isOpen, setIsOpen] = useState(false);
  const prevAlertIdRef = useRef<string | null>(null);

  const myAlerts = state.staffAlerts.filter((a) => a.staffId === RETAIL_STAFF.id);
  // Newest first — staff should respond to the latest call
  const activeAlert = myAlerts.length > 0 ? myAlerts[myAlerts.length - 1] : null;
  const pendingCount = myAlerts.length;

  const customer = activeAlert
    ? state.customers.find((c) => c.id === activeAlert.customerId)
    : undefined;
  const station = activeAlert
    ? state.stations.find((s) => s.id === activeAlert.stationId)
    : undefined;

  // Device vibrate when a new alert arrives
  useEffect(() => {
    if (!activeAlert) {
      setIsOpen(false);
      prevAlertIdRef.current = null;
      return;
    }

    if (prevAlertIdRef.current !== activeAlert.id) {
      prevAlertIdRef.current = activeAlert.id;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([180, 80, 180, 80, 240]);
      }
    }
  }, [activeAlert]);

  if (!activeAlert || !customer || !station) return null;

  const alertId = activeAlert.id;

  function handleAttend() {
    attendCustomer(alertId);
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Required at ${station.label}. ${customer.name} is waiting. Open details.`}
        className="relative flex max-w-[11rem] shrink-0 items-center gap-2 overflow-hidden rounded-full py-1.5 pl-1.5 pr-3 text-left transition-colors hover:bg-white/10 sm:max-w-[14rem]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-amber-400/25"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-amber-300/70 animate-staff-alert-ring"
        />

        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-amber-400/50 animate-staff-alert-ping" />
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-[#0033AA] shadow-sm animate-staff-alert-shake">
            <Bell size={14} weight="fill" />
          </span>
          {pendingCount > 1 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white ring-1 ring-white/40">
              {pendingCount}
            </span>
          ) : null}
        </span>

        <span className="relative min-w-0">
          <span className="block truncate text-[11px] font-bold leading-tight text-white">
            Go to {station.label}
          </span>
          <span className="block truncate text-[10px] leading-tight text-white/75">
            {customer.name}
          </span>
        </span>
      </button>

      {isOpen ? (
        <AlertDetailsPopup
          customer={customer}
          station={station}
          onClose={() => setIsOpen(false)}
          onAttend={handleAttend}
        />
      ) : null}
    </>
  );
}
