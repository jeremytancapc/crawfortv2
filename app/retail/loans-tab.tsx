"use client";

import { useState, useMemo } from "react";
import {
  MagnifyingGlass,
  X,
  ArrowRight,
  Warning,
  CheckCircle,
  Clock,
  CaretDown,
} from "@phosphor-icons/react";
import type { RetailLoan } from "./types";
import { RETAIL_LOANS, formatCurrency } from "./mock-data";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RetailLoan["status"], { label: string; classes: string; dot: string }> = {
  active:    { label: "Active",    classes: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  overdue:   { label: "Overdue",   classes: "text-red-700 bg-red-50 border-red-200",             dot: "bg-red-500"     },
  completed: { label: "Completed", classes: "text-slate-500 bg-slate-50 border-slate-200",       dot: "bg-slate-400"   },
};

// ─── Payment schedule row ─────────────────────────────────────────────────────

function PaymentRow({ entry }: { entry: RetailLoan["paymentSchedule"][number] }) {
  const cfg = {
    paid:     { color: "text-emerald-600", icon: <CheckCircle size={14} weight="fill" className="text-emerald-500" /> },
    upcoming: { color: "text-slate-600",   icon: <Clock size={14} className="text-slate-400" /> },
    overdue:  { color: "text-red-600",     icon: <Warning size={14} weight="fill" className="text-red-500" /> },
  }[entry.status];

  return (
    <div className={`flex items-center justify-between py-2 border-b border-slate-100 last:border-0 ${cfg.color}`}>
      <div className="flex items-center gap-2">
        {cfg.icon}
        <span className="text-sm">{entry.date}</span>
      </div>
      <span className="text-sm font-semibold">{formatCurrency(entry.amount)}</span>
    </div>
  );
}

// ─── Loan detail slide-over ───────────────────────────────────────────────────

interface LoanDetailProps {
  loan: RetailLoan;
  onClose: () => void;
}

function LoanDetail({ loan, onClose }: LoanDetailProps) {
  const status = STATUS_CONFIG[loan.status];
  const progress = Math.round((loan.paymentsCompleted / loan.totalPayments) * 100);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md z-50 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100" style={{ background: "var(--brand-blue-hex)" }}>
          <div>
            <p className="text-white/70 text-xs font-medium">Loan ID</p>
            <p className="text-white font-bold text-lg">{loan.loanId}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Customer info */}
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Customer</p>
            <p className="font-bold text-slate-800 text-base">{loan.customerName}</p>
            <p className="text-sm text-slate-500">{loan.nric} · {loan.mobile}</p>
          </div>

          {/* Status + amounts */}
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${status.classes}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              <span className="text-xs text-slate-400">{loan.loanPurpose}</span>
            </div>

            {loan.status === "overdue" && loan.overdueAmount && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-2 text-red-700 mb-1">
                  <Warning size={16} weight="fill" />
                  <span className="font-bold text-sm">Overdue</span>
                </div>
                <p className="text-sm text-red-600">
                  {formatCurrency(loan.overdueAmount)} overdue · {loan.overdueDays} days
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Principal",     value: formatCurrency(loan.principalAmount) },
                { label: "Outstanding",   value: formatCurrency(loan.outstandingBalance) },
                { label: "Monthly",       value: formatCurrency(loan.monthlyPayment) },
                { label: "Interest Rate", value: `${loan.interestRate}% /mo` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">Repayment Progress</p>
              <p className="text-sm text-slate-500">{loan.paymentsCompleted}/{loan.totalPayments} payments</p>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: "var(--brand-teal-hex)" }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">{progress}% complete</p>
          </div>

          {/* Dates */}
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-xs text-slate-500">Start Date</p>
                <p className="font-semibold text-slate-700 mt-0.5">{loan.startDate}</p>
              </div>
              <ArrowRight size={16} className="text-slate-300" />
              <div className="text-right">
                <p className="text-xs text-slate-500">Next Payment</p>
                <p className={`font-semibold mt-0.5 ${loan.status === "overdue" ? "text-red-600" : "text-slate-700"}`}>
                  {loan.nextPaymentDate}
                </p>
              </div>
            </div>
          </div>

          {/* Payment schedule */}
          {loan.paymentSchedule.length > 0 && (
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-700 mb-3">Payment Schedule</p>
              <div>
                {loan.paymentSchedule.map((entry, i) => (
                  <PaymentRow key={i} entry={entry} />
                ))}
              </div>
            </div>
          )}

          {/* Quick actions (non-functional UI) */}
          <div className="px-5 py-4 pb-8">
            <p className="text-sm font-bold text-slate-700 mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {["Record Payment", "Send Reminder", "Update Details", "Request Documents"].map((action) => (
                <button
                  key={action}
                  className="py-3 px-3 rounded-xl border-2 border-slate-200 text-xs font-semibold text-slate-600 hover:border-[#0033AA]/30 hover:text-[#0033AA] transition-all text-left"
                  onClick={() => {}}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Loan row ─────────────────────────────────────────────────────────────────

interface LoanRowProps {
  loan: RetailLoan;
  onClick: () => void;
}

function LoanRow({ loan, onClick }: LoanRowProps) {
  const status = STATUS_CONFIG[loan.status];

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center px-4 py-3 hover:bg-blue-50/50 transition-colors border-b border-slate-100 last:border-0 group"
    >
      {/* Status dot */}
      <div className="flex-shrink-0 w-8 flex justify-center">
        <div className={`w-2 h-2 rounded-full ${status.dot}`} />
      </div>

      {/* Customer */}
      <div className="flex-1 min-w-0 mr-3">
        <p className="font-semibold text-sm text-slate-800 truncate">{loan.customerName}</p>
        <p className="text-xs text-slate-400 truncate">{loan.nric}</p>
      </div>

      {/* Loan ID */}
      <div className="hidden sm:block flex-shrink-0 w-24 mr-3">
        <p className="text-xs font-mono font-bold text-slate-600">{loan.loanId}</p>
        <p className="text-xs text-slate-400">{loan.loanPurpose}</p>
      </div>

      {/* Amount */}
      <div className="flex-shrink-0 w-24 text-right mr-3">
        <p className="text-sm font-bold text-slate-800">{formatCurrency(loan.outstandingBalance)}</p>
        <p className="text-xs text-slate-400">outstanding</p>
      </div>

      {/* Next payment */}
      <div className="hidden lg:block flex-shrink-0 w-28 text-right mr-3">
        <p className={`text-xs font-semibold ${loan.status === "overdue" ? "text-red-600" : "text-slate-600"}`}>
          {loan.nextPaymentDate}
        </p>
        <p className="text-xs text-slate-400">next payment</p>
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0 ml-auto">
        <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border ${status.classes}`}>
          {status.label}
        </span>
      </div>

      <ArrowRight size={14} className="flex-shrink-0 ml-2 text-slate-300 group-hover:text-slate-400 transition-colors" />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LoansTab() {
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState<RetailLoan["status"] | "all">("all");
  const [selectedLoan, setSelected] = useState<RetailLoan | null>(null);

  const filtered = useMemo(() => {
    return RETAIL_LOANS.filter((l) => {
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        l.customerName.toLowerCase().includes(q) ||
        l.loanId.toLowerCase().includes(q) ||
        l.nric.toLowerCase().includes(q) ||
        l.mobile.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter]);

  const summary = useMemo(() => ({
    total:    RETAIL_LOANS.length,
    active:   RETAIL_LOANS.filter((l) => l.status === "active").length,
    overdue:  RETAIL_LOANS.filter((l) => l.status === "overdue").length,
    completed: RETAIL_LOANS.filter((l) => l.status === "completed").length,
  }), []);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header + stats */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-slate-100 bg-white">
        <h2 className="text-base font-bold text-slate-800 mb-3">Loan Management</h2>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: "Total",     value: summary.total,     color: "text-slate-700",   bg: "bg-slate-50"   },
            { label: "Active",    value: summary.active,    color: "text-emerald-700", bg: "bg-emerald-50" },
            { label: "Overdue",   value: summary.overdue,   color: "text-red-700",     bg: "bg-red-50"     },
            { label: "Completed", value: summary.completed, color: "text-slate-500",   bg: "bg-slate-50"   },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl px-3 py-2.5 text-center`}>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Search + filter row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, loan ID, NRIC…"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0033AA] transition-colors bg-white"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatus(e.target.value as RetailLoan["status"] | "all")}
              className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold focus:outline-none focus:border-[#0033AA] transition-colors bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
            </select>
            <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white">
        {/* Column headers — desktop only */}
        <div className="hidden lg:flex items-center px-4 py-2 bg-slate-50 border-b border-slate-200 sticky top-0">
          <div className="w-8" />
          <div className="flex-1 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</div>
          <div className="w-24 mr-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Loan ID</div>
          <div className="w-24 text-right mr-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Outstanding</div>
          <div className="w-28 text-right mr-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Next Payment</div>
          <div className="flex-shrink-0 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</div>
          <div className="w-6" />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <MagnifyingGlass size={32} className="mb-3 opacity-40" />
            <p className="text-sm">No loans match your filters</p>
          </div>
        ) : (
          filtered.map((loan) => (
            <LoanRow key={loan.loanId} loan={loan} onClick={() => setSelected(loan)} />
          ))
        )}
      </div>

      {/* Slide-over detail */}
      {selectedLoan && (
        <LoanDetail loan={selectedLoan} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
