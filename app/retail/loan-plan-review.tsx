"use client";

import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Eye,
  Warning,
  LockKey,
  CheckCircle,
  X,
  Printer,
} from "@phosphor-icons/react";
import type { RetailCustomer, ApprovedLoanOffer, ConfirmedLoanPlan } from "./types";
import { computeRepaymentPlan, formatCurrency } from "./mock-data";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stationLabel(stationId: string | null): string {
  if (!stationId) return "—";
  return stationId
    .replace("room-", "Room ")
    .replace("kiosk-", "Kiosk ")
    .replace("cashier-1", "Cashier");
}

// ─── Repayment Plan Modal ─────────────────────────────────────────────────────

interface RepaymentModalProps {
  amount: number;
  tenureMonths: number;
  interestRate: number;
  processingFee: number;
  customerName: string;
  onClose: () => void;
}

function RepaymentPlanModal({
  amount,
  tenureMonths,
  interestRate,
  processingFee,
  customerName,
  onClose,
}: RepaymentModalProps) {
  const plan = useMemo(
    () => computeRepaymentPlan(amount, tenureMonths, interestRate, processingFee),
    [amount, tenureMonths, interestRate, processingFee],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-md sm:rounded-md shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-5 py-4"
          style={{ background: "var(--brand-blue-hex)" }}
        >
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-white/80" />
            <div>
              <p className="text-white font-bold text-base leading-tight">Repayment Plan Preview</p>
              <p className="text-white/70 text-xs mt-0.5">{customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Summary cards */}
        <div className="flex-shrink-0 grid grid-cols-3 gap-2 p-4 border-b border-slate-100">
          {[
            { label: "Loan Amount",  value: formatCurrency(plan.principal) },
            { label: "Net Disbursed", value: formatCurrency(plan.netDisbursement) },
            { label: "Processing Fee", value: formatCurrency(plan.processingFeeAmount) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-md p-2.5 text-center">
              <p className="text-[10px] text-slate-500 leading-tight">{label}</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex-shrink-0 grid grid-cols-3 gap-2 px-4 pb-4 border-b border-slate-100">
          {[
            { label: "Total Interest", value: formatCurrency(plan.totalInterest) },
            { label: "Total Repayable", value: formatCurrency(plan.totalRepayable) },
            { label: "Monthly Instalment", value: formatCurrency(plan.monthlyInstallment) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-blue-50 rounded-md p-2.5 text-center">
              <p className="text-[10px] text-blue-600 leading-tight">{label}</p>
              <p className="font-bold text-[#0033AA] text-sm mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Schedule table */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Monthly Schedule — {tenureMonths} instalments at {interestRate}% p.a.
            </p>
          </div>
          <div className="px-4">
            {/* Column headers */}
            <div className="grid grid-cols-5 gap-1 py-1.5 border-b border-slate-200 mb-1">
              {["#", "Due", "Instalment", "Principal", "Balance"].map((h) => (
                <p key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right first:text-left">
                  {h}
                </p>
              ))}
            </div>
            {plan.schedule.map((row) => (
              <div
                key={row.month}
                className="grid grid-cols-5 gap-1 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
              >
                <p className="text-xs text-slate-500 tabular-nums">{row.month}</p>
                <p className="text-xs text-slate-600 text-right tabular-nums">{row.dueLabel}</p>
                <p className="text-xs font-semibold text-slate-800 text-right tabular-nums">
                  {formatCurrency(row.installment)}
                </p>
                <p className="text-xs text-slate-500 text-right tabular-nums">
                  {formatCurrency(row.principalPortion)}
                </p>
                <p className="text-xs text-slate-600 text-right tabular-nums">
                  {formatCurrency(row.balance)}
                </p>
              </div>
            ))}
          </div>
          <div className="h-4" />
        </div>

        <div className="flex-shrink-0 p-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-md font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "var(--brand-blue-hex)" }}
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Field row helper ─────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LoanPlanReviewProps {
  customer: RetailCustomer;
  offer: ApprovedLoanOffer;
  existingPlan: ConfirmedLoanPlan | null;
  onBack: () => void;
  /** Called with the finalised plan; parent handles store update + modal. */
  onConfirm: (plan: Omit<ConfirmedLoanPlan, "confirmedAt">) => void;
}

export function LoanPlanReview({ customer, offer, existingPlan, onBack, onConfirm }: LoanPlanReviewProps) {
  const [amount, setAmount]          = useState<number>(existingPlan?.amount ?? offer.maxAmount);
  const [tenure, setTenure]          = useState<number>(existingPlan?.tenureMonths ?? offer.defaultTenureMonths);
  const [interest, setInterest]      = useState<number>(existingPlan?.interestRate ?? offer.defaultInterestRate);
  const [fee, setFee]                = useState<number>(existingPlan?.processingFee ?? offer.defaultProcessingFee);
  const [staffCode, setStaffCode]    = useState("");
  const [codeError, setCodeError]    = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Which fields are outside their default-safe boundary?
  const requiresOverride =
    tenure > offer.defaultTenureMonths ||
    interest === offer.altInterestRate ||
    fee < offer.defaultProcessingFee;

  const overrideUnlocked = !requiresOverride || staffCode.length >= 4;

  const amountValid = amount >= offer.minAmount && amount <= offer.maxAmount && amount > 0;
  const canConfirm  = amountValid && overrideUnlocked;

  const tenureOptions: number[] = Array.from({ length: offer.maxTenureMonths }, (_, i) => i + 1);

  function handleAmountChange(raw: string) {
    const v = parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (!isNaN(v)) setAmount(Math.min(offer.maxAmount, Math.max(0, v)));
  }

  function handleConfirm() {
    if (requiresOverride && staffCode.length < 4) {
      setCodeError(true);
      return;
    }
    setCodeError(false);
    onConfirm({ customerId: customer.id, amount, tenureMonths: tenure, interestRate: interest, processingFee: fee });
  }

  // Estimated monthly instalment for inline display
  const estimated = useMemo(() => {
    if (!amountValid) return null;
    const result = computeRepaymentPlan(amount, tenure, interest, fee);
    return result.monthlyInstallment;
  }, [amount, tenure, interest, fee, amountValid]);

  const room = stationLabel(customer.assignedStationId);

  return (
    <>
      <div className="flex flex-col h-full min-h-0 bg-slate-50">
        {/* ── Sticky top bar ───────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-white">
          {/* Customer header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <button
              onClick={onBack}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600"
              aria-label="Back to list"
            >
              <ArrowLeft size={18} weight="bold" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-base truncate">{customer.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {customer.nricLast4} · {customer.mobile}
              </p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <span
                className="inline-block text-xs font-bold px-2.5 py-1 rounded-full text-white"
                style={{ background: "var(--brand-blue-hex)" }}
              >
                {customer.queueNumber}
              </span>
              {room !== "—" && (
                <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                  {room}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">

          {/* Approved terms summary (read-only) */}
          <div className="bg-white rounded-md border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-black">
                Approved Offer
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                <Warning size={12} weight="fill" />
                Approval Range: {formatCurrency(offer.minAmount)} ~ {formatCurrency(offer.maxAmount)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Default Tenure", value: `${offer.defaultTenureMonths} mths` },
                { label: "Base Rate",      value: `${offer.defaultInterestRate}% p.a.` },
                { label: "Processing Fee", value: `${offer.defaultProcessingFee}%` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-md p-2.5">
                  <p className="text-[10px] text-slate-400">{label}</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Loan Plan card ────────────────────────────────────────── */}
          <div className="bg-white rounded-md border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Loan Plan
            </p>

            <div className="space-y-4">
              {/* Amount */}
              <div>
                <FieldLabel required>
                  Amount
                  <span className="ml-2 text-[10px] font-normal text-amber-600">
                    (max {formatCurrency(offer.maxAmount)})
                  </span>
                </FieldLabel>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">$</span>
                  <input
                    type="number"
                    min={offer.minAmount}
                    max={offer.maxAmount}
                    step={100}
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    onBlur={() => {
                      const clamped = Math.min(offer.maxAmount, Math.max(offer.minAmount, amount));
                      setAmount(clamped);
                    }}
                    className={[
                      "w-full pl-8 pr-4 py-3 rounded-md border-2 text-slate-800 text-base font-semibold focus:outline-none transition-colors",
                      !amountValid
                        ? "border-red-400 bg-red-50 focus:border-red-500"
                        : "border-slate-200 bg-white focus:border-[#0033AA]",
                    ].join(" ")}
                  />
                </div>
                {!amountValid && (
                  <p className="mt-1 text-xs text-red-600">
                    Must be between {formatCurrency(offer.minAmount)} and {formatCurrency(offer.maxAmount)}
                  </p>
                )}
              </div>

              {/* Tenure */}
              <div>
                <FieldLabel required>
                  Installments (Tenure)
                  {tenure > offer.defaultTenureMonths && (
                    <span className="ml-2 text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                      Override needed
                    </span>
                  )}
                </FieldLabel>
                <div className="relative">
                  <select
                    value={tenure}
                    onChange={(e) => setTenure(Number(e.target.value))}
                    className="w-full appearance-none pl-4 pr-10 py-3 rounded-md border-2 border-slate-200 text-slate-800 font-semibold text-base bg-white focus:outline-none focus:border-[#0033AA] transition-colors"
                  >
                    {tenureOptions.map((m) => (
                      <option key={m} value={m}>
                        {m} {m === 1 ? "month" : "months"}
                        {m > offer.defaultTenureMonths ? " ⚠ override" : ""}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
                </div>
              </div>

              {/* Interest Rate */}
              <div>
                <FieldLabel required>
                  Annual Interest Rate
                  {interest === offer.altInterestRate && (
                    <span className="ml-2 text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                      Override needed
                    </span>
                  )}
                </FieldLabel>
                <div className="relative">
                  <select
                    value={interest}
                    onChange={(e) => setInterest(Number(e.target.value))}
                    className="w-full appearance-none pl-4 pr-10 py-3 rounded-md border-2 border-slate-200 text-slate-800 font-semibold text-base bg-white focus:outline-none focus:border-[#0033AA] transition-colors"
                  >
                    <option value={offer.defaultInterestRate}>{offer.defaultInterestRate}%</option>
                    <option value={offer.altInterestRate}>{offer.altInterestRate}% ⚠ override</option>
                  </select>
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
                </div>
              </div>

              {/* Processing Fee */}
              <div>
                <FieldLabel required>
                  Processing Fee
                  {fee < offer.defaultProcessingFee && (
                    <span className="ml-2 text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                      Override needed
                    </span>
                  )}
                </FieldLabel>
                <div className="relative">
                  <select
                    value={fee}
                    onChange={(e) => setFee(Number(e.target.value))}
                    className="w-full appearance-none pl-4 pr-10 py-3 rounded-md border-2 border-slate-200 text-slate-800 font-semibold text-base bg-white focus:outline-none focus:border-[#0033AA] transition-colors"
                  >
                    {Array.from({ length: 10 }, (_, i) => 10 - i).map((pct) => (
                      <option key={pct} value={pct}>
                        {pct}%{pct < offer.defaultProcessingFee ? " ⚠ override" : ""}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
                </div>
              </div>
            </div>

            {/* Estimated instalment */}
            {estimated !== null && (
              <div className="mt-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md px-4 py-3">
                <p className="text-sm text-blue-700 font-semibold">Est. Monthly Instalment</p>
                <p className="text-base font-bold text-[#0033AA]">{formatCurrency(estimated)}</p>
              </div>
            )}

            {/* Repayment Plan Preview button */}
            <button
              type="button"
              disabled={!amountValid}
              onClick={() => setShowPreview(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-md border-2 border-[#0033AA] text-[#0033AA] font-bold text-sm hover:bg-blue-50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Eye size={16} />
              Repayment Plan Preview
            </button>
          </div>

          {/* ── Staff Override banner ─────────────────────────────── */}
          {requiresOverride && (
            <div className="bg-orange-50 border-2 border-orange-300 rounded-md p-4">
              <div className="flex items-start gap-3 mb-3">
                <LockKey size={20} weight="fill" className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-orange-800">Manager Override Required</p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    The selected terms deviate from the approved defaults. A supervisor or senior
                    staff code is required to proceed.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-orange-700 mb-1.5" htmlFor="staff-code">
                  Staff Authorization Code
                </label>
                <input
                  id="staff-code"
                  type="password"
                  inputMode="numeric"
                  value={staffCode}
                  onChange={(e) => { setStaffCode(e.target.value); setCodeError(false); }}
                  placeholder="Enter code (min. 4 characters)"
                  className={[
                    "w-full px-4 py-3 rounded-md border-2 text-slate-800 placeholder-slate-400 text-base focus:outline-none transition-colors bg-white",
                    codeError
                      ? "border-red-400 focus:border-red-500"
                      : overrideUnlocked
                      ? "border-emerald-400 focus:border-emerald-500"
                      : "border-orange-300 focus:border-orange-500",
                  ].join(" ")}
                />
                {codeError && (
                  <p className="mt-1 text-xs text-red-600">Please enter a valid staff code (min. 4 characters).</p>
                )}
                {overrideUnlocked && !codeError && (
                  <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle size={12} weight="fill" />
                    Override authorised
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Spacer so content clears bottom bar */}
          <div className="h-4" />
        </div>

        {/* ── Sticky bottom bar ────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3 flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3.5 rounded-md border-2 border-slate-300 text-slate-700 font-bold text-sm hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] transition-all"
          >
            Back
          </button>
          <button
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="flex-[2] py-3.5 rounded-md font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--brand-blue-hex)" }}
          >
            Confirm
          </button>
        </div>
      </div>

      {/* Repayment preview modal */}
      {showPreview && (
        <RepaymentPlanModal
          amount={amount}
          tenureMonths={tenure}
          interestRate={interest}
          processingFee={fee}
          customerName={customer.name}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
