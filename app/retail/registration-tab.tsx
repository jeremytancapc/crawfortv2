"use client";

import { useState } from "react";
import {
  User,
  Phone,
  IdentificationCard,
  ClipboardText,
  CheckCircle,
  ArrowRight,
} from "@phosphor-icons/react";
import type { AppointmentType, RetailTab } from "./types";
import { useRetail } from "./retail-store";
import { TIME_SLOTS } from "./mock-data";

const APPT_OPTIONS: { value: AppointmentType; label: string; description: string; color: string }[] = [
  {
    value: "loan-application",
    label: "Loan Application",
    description: "New or reloan assessment",
    color: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    value: "customer-care",
    label: "Customer Service",
    description: "Account enquiries & support",
    color: "border-purple-200 bg-purple-50 text-purple-700",
  },
  {
    value: "cash-repayment",
    label: "Cash Repayment",
    description: "Monthly instalment or settlement",
    color: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    value: "cash-disbursement",
    label: "Cash Disbursement",
    description: "Loan cash release / pickup",
    color: "border-amber-200 bg-amber-50 text-amber-700",
  },
];

function getNearestSlot(): string {
  const now = new Date();
  const totalMins = now.getHours() * 60 + now.getMinutes();
  for (const slot of TIME_SLOTS) {
    const [h, m] = slot.split(":").map(Number);
    if (h * 60 + m >= totalMins) return slot;
  }
  return TIME_SLOTS[TIME_SLOTS.length - 1];
}

interface RegistrationTabProps {
  onRegistered: (tab: RetailTab) => void;
}

export function RegistrationTab({ onRegistered }: RegistrationTabProps) {
  const { registerWalkIn } = useRetail();

  const [name, setName]         = useState("");
  const [mobile, setMobile]     = useState("");
  const [nricLast4, setNric]    = useState("");
  const [apptType, setAppt]     = useState<AppointmentType>("loan-application");
  const [notes, setNotes]       = useState("");
  const [isWalkIn]              = useState(true);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) return;

    const slot = getNearestSlot();

    registerWalkIn({
      name:            name.trim(),
      mobile:          mobile.trim(),
      nricLast4:       nricLast4.trim(),
      appointmentType: apptType,
      slotTime:        slot,
      notes:           notes.trim(),
      isWalkIn:        isWalkIn,
      ascendStatus:    apptType === "loan-application" ? "create" : null,
    });

    setSubmitted(true);
  }

  function handleGoToQueue() {
    // Reset form
    setName(""); setMobile(""); setNric(""); setNotes("");
    setAppt("loan-application"); setSubmitted(false);
    onRegistered("queue");
  }

  function handleAddAnother() {
    setName(""); setMobile(""); setNric(""); setNotes("");
    setAppt("loan-application"); setSubmitted(false);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "#06DEC0" }}
        >
          <CheckCircle size={40} weight="fill" color="white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Walk-in Registered</h2>
        <p className="text-slate-500 mb-1">
          <strong className="text-slate-700">{name}</strong> has been added to today&apos;s queue.
        </p>
        <p className="text-sm text-slate-400 mb-8">
          They will appear in the Queue tab — assign a station to get started.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <button
            onClick={handleGoToQueue}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-white transition-all hover:opacity-90"
            style={{ background: "var(--brand-blue-hex)" }}
          >
            Go to Queue
            <ArrowRight size={16} />
          </button>
          <button
            onClick={handleAddAnother}
            className="flex-1 py-3 px-6 rounded-xl font-bold border-2 border-slate-200 text-slate-700 hover:border-slate-300 transition-all"
          >
            Add Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto">
      <div className="flex-shrink-0 max-w-2xl mx-auto w-full px-4 lg:px-8 py-6">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Walk-in Registration</h2>
        <p className="text-sm text-slate-500 mb-6">Register a customer who arrived without a prior appointment.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="reg-name">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tan Wei Liang"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-slate-200 text-slate-800 placeholder-slate-400 text-base focus:outline-none focus:border-[#0033AA] transition-colors bg-white"
              />
            </div>
          </div>

          {/* Mobile */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="reg-mobile">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="reg-mobile"
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+65 9123 4567"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-slate-200 text-slate-800 placeholder-slate-400 text-base focus:outline-none focus:border-[#0033AA] transition-colors bg-white"
              />
            </div>
          </div>

          {/* NRIC last 4 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="reg-nric">
              NRIC (last 4 characters)
            </label>
            <div className="relative">
              <IdentificationCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="reg-nric"
                type="text"
                maxLength={4}
                value={nricLast4}
                onChange={(e) => setNric(e.target.value.toUpperCase())}
                placeholder="e.g. 345D"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-slate-200 text-slate-800 placeholder-slate-400 text-base focus:outline-none focus:border-[#0033AA] transition-colors bg-white uppercase tracking-widest"
              />
            </div>
          </div>

          {/* Appointment type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Appointment Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {APPT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAppt(opt.value)}
                  className={[
                    "flex flex-col items-start p-3.5 rounded-xl border-2 text-left transition-all duration-150",
                    apptType === opt.value
                      ? `${opt.color} border-opacity-100 shadow-sm scale-[1.01]`
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                  ].join(" ")}
                >
                  <span className="font-bold text-sm">{opt.label}</span>
                  <span className="text-xs mt-0.5 opacity-70">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="reg-notes">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <ClipboardText className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              <textarea
                id="reg-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requirements or context…"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-slate-200 text-slate-800 placeholder-slate-400 text-base focus:outline-none focus:border-[#0033AA] transition-colors bg-white resize-none"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white text-base transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "var(--brand-blue-hex)" }}
          >
            Register Walk-in
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
