"use client";

import { useState, useMemo, useCallback, useId, useEffect } from "react";
import {
  GRADE_CONFIG,
  GRADES,
  MONTHLY_RATE,
  DEFAULT_FEE_PCT,
  MIN_LOAN_AMOUNT,
  MAX_APPROVED_CAP,
  DEFAULT_MAX_APPROVED,
  AMOUNT_STEP,
  buildSchedule,
  formatCurrency,
  formatDate,
  type Grade,
  type Frequency,
  type LoanSchedule,
} from "@/lib/rm-calc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
      {children}
    </span>
  );
}

interface NumberInputProps {
  id?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
  className?: string;
}

function NumberInput({
  id,
  value,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  disabled,
  onChange,
  className = "",
}: NumberInputProps) {
  const [raw, setRaw] = useState<string | null>(null);

  const displayValue = raw !== null ? raw : String(value);

  return (
    <div
      className={`flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 focus-within:border-blue-800 focus-within:ring-2 focus-within:ring-blue-900/20 ${disabled ? "opacity-50" : ""} ${className}`}
    >
      {prefix && <span className="text-gray-500 font-medium select-none">{prefix}</span>}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={displayValue}
        className="w-full min-w-0 bg-transparent text-gray-900 font-semibold outline-none text-base disabled:cursor-not-allowed"
        onChange={(e) => {
          const s = e.target.value.replace(/[^0-9]/g, "");
          setRaw(s);
        }}
        onBlur={() => {
          const parsed = parseInt(raw ?? "", 10);
          if (!isNaN(parsed)) {
            const snapped = Math.round(parsed / (step || 1)) * (step || 1);
            onChange(clamp(snapped, min, max));
          }
          setRaw(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {suffix && <span className="text-gray-500 text-sm select-none whitespace-nowrap">{suffix}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function RmCalcView() {
  // Staff panel
  const [staffOpen, setStaffOpen] = useState(true);
  const [grade, setGrade] = useState<Grade>("A");
  const [maxApprovedAmount, setMaxApprovedAmount] = useState(DEFAULT_MAX_APPROVED);
  const [maxApprovedRaw, setMaxApprovedRaw] = useState<string | null>(null);
  const [feePct, setFeePct] = useState<number>(DEFAULT_FEE_PCT);
  const [feePctRaw, setFeePctRaw] = useState<string | null>(null);
  const [disbursedDateStr, setDisbursedDateStr] = useState(todayStr());

  // Always sync disbursement date to the client’s real “today” on mount
  // (avoids SSR/timezone drift and keeps the default current on every load).
  useEffect(() => {
    setDisbursedDateStr(todayStr());
  }, []);

  // Customer controls
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [loanAmount, setLoanAmount] = useState(5000);
  const [tenureMonths, setTenureMonths] = useState(6);

  // More details toggle
  const [showDetails, setShowDetails] = useState(false);

  const gradeInfo = GRADE_CONFIG[grade];

  // Derive effective values
  const effectiveMaxAmount = Math.max(MIN_LOAN_AMOUNT, maxApprovedAmount);
  const effectiveAmount = clamp(loanAmount, MIN_LOAN_AMOUNT, effectiveMaxAmount);

  const maxTenure = frequency === "payday" ? 1 : gradeInfo.maxTenureMonths;
  const effectiveTenure = frequency === "payday" ? 1 : clamp(tenureMonths, 1, maxTenure);

  const disbursedDate = useMemo(() => parseDateStr(disbursedDateStr), [disbursedDateStr]);

  const schedule: LoanSchedule = useMemo(
    () =>
      buildSchedule(
        effectiveAmount,
        effectiveTenure,
        frequency,
        disbursedDate,
        MONTHLY_RATE,
        feePct,
      ),
    [effectiveAmount, effectiveTenure, frequency, disbursedDate, feePct],
  );

  const handleGradeChange = useCallback(
    (g: Grade) => {
      setGrade(g);
      const newMax = GRADE_CONFIG[g].maxTenureMonths;
      if (frequency !== "payday" && tenureMonths > newMax) {
        setTenureMonths(newMax);
      }
    },
    [frequency, tenureMonths],
  );

  const handleFrequencyChange = useCallback(
    (f: Frequency) => {
      setFrequency(f);
      if (f === "payday") setTenureMonths(1);
    },
    [],
  );

  const handleLoanAmountChange = useCallback(
    (v: number) => setLoanAmount(clamp(v, MIN_LOAN_AMOUNT, effectiveMaxAmount)),
    [effectiveMaxAmount],
  );

  const handleTenureChange = useCallback(
    (v: number) => setTenureMonths(clamp(v, 1, maxTenure)),
    [maxTenure],
  );

  const amountId = useId();
  const tenureId = useId();

  const firstRow = schedule.rows[0];
  const paymentCount = schedule.rows.length;

  // Grade reference EIR display label
  const refEirLabel = `${gradeInfo.refEirPct.toFixed(1)}%`;

  const frequencyOptions: { id: Frequency; label: string }[] = [
    { id: "monthly", label: "Monthly" },
    { id: "biweekly", label: "Biweekly" },
    { id: "payday", label: "Payday" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* Staff panel (collapsible) */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-gray-100 border-b border-gray-300">
        {/* Collapsible content */}
        {staffOpen && (
          <div className="px-5 pt-4 pb-2 space-y-4">
            {/* Row 1: Grade tabs + Max approved amount */}
            <div className="flex flex-wrap items-end gap-4">
              {/* Grade tabs */}
              <div className="flex flex-col gap-1">
                <SectionLabel>Customer grade</SectionLabel>
                <div className="flex gap-1">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      onClick={() => handleGradeChange(g)}
                      className={`min-w-[52px] py-3 px-4 rounded-md text-lg font-bold transition-colors border ${
                        grade === g
                          ? "bg-blue-950 text-white border-blue-950"
                          : "bg-white text-gray-700 border-gray-300 hover:border-blue-700"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max approved amount */}
              <div className="flex flex-col gap-1">
                <SectionLabel>Max approved amount</SectionLabel>
                <div
                  className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 focus-within:border-blue-800 focus-within:ring-2 focus-within:ring-blue-900/20"
                  style={{ minWidth: 160 }}
                >
                  <span className="text-gray-500 font-medium select-none">S$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={maxApprovedRaw !== null ? maxApprovedRaw : String(maxApprovedAmount)}
                    className="w-full min-w-0 bg-transparent text-gray-900 font-semibold outline-none text-base"
                    onChange={(e) => {
                      const s = e.target.value.replace(/[^0-9]/g, "");
                      setMaxApprovedRaw(s);
                    }}
                    onBlur={() => {
                      const parsed = parseInt(maxApprovedRaw ?? "", 10);
                      if (!isNaN(parsed) && parsed >= MIN_LOAN_AMOUNT) {
                        const capped = Math.min(parsed, MAX_APPROVED_CAP);
                        setMaxApprovedAmount(capped);
                        if (loanAmount > capped) setLoanAmount(capped);
                      }
                      setMaxApprovedRaw(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                </div>
              </div>

              {/* Disbursement date */}
              <div className="flex flex-col gap-1">
                <SectionLabel>Disbursement date</SectionLabel>
                <input
                  type="date"
                  value={disbursedDateStr}
                  onChange={(e) => setDisbursedDateStr(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 font-medium outline-none focus:border-blue-800 focus:ring-2 focus:ring-blue-900/20 text-base"
                />
              </div>

              {/* Processing fee */}
              <div className="flex flex-col gap-1">
                <SectionLabel>Processing fee</SectionLabel>
                <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 focus-within:border-blue-800 focus-within:ring-2 focus-within:ring-blue-900/20" style={{ width: 100 }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={feePctRaw !== null ? feePctRaw : String(feePct)}
                    className="w-full min-w-0 bg-transparent text-gray-900 font-semibold outline-none text-base"
                    onChange={(e) => {
                      const s = e.target.value.replace(/[^0-9.]/g, "");
                      setFeePctRaw(s);
                    }}
                    onBlur={() => {
                      const parsed = parseFloat(feePctRaw ?? "");
                      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                        setFeePct(parsed);
                      }
                      setFeePctRaw(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <span className="text-gray-500 font-medium select-none">%</span>
                </div>
              </div>
            </div>

            {/* Row 2: Grade info + live EIR */}
            <div className="flex flex-wrap gap-6 items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Grade {grade} max tenure:</span>
                <span className="font-bold text-gray-800">{gradeInfo.maxTenureMonths} months</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Ref EIR at max tenure (monthly, 10% fee):</span>
                <span className="font-bold text-gray-800">{refEirLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Live EIR:</span>
                <span className="font-bold text-blue-950 text-base">{schedule.eir.toFixed(1)}%</span>
                <span className="text-gray-400 text-xs">
                  ({frequency === "biweekly" ? "nominal, 26 periods/yr" : "nominal, 12 periods/yr"})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Processing fee amount:</span>
                <span className="font-bold text-gray-800">{formatCurrency(schedule.feeAmount)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Collapse toggle — below staff panel; double chevrons L/R, title in middle */}
        <button
          onClick={() => setStaffOpen((o) => !o)}
          className="w-full flex items-center justify-between min-h-12 px-5 py-2 bg-blue-950 text-white hover:bg-blue-900 active:bg-[#0a1628] transition-colors"
          aria-expanded={staffOpen}
          aria-label={staffOpen ? "Collapse staff settings" : "Expand staff settings"}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-200 ${staffOpen ? "rotate-0" : "rotate-180"}`}
            aria-hidden
          >
            <polyline points="17 11 12 6 7 11" />
            <polyline points="17 18 12 13 7 18" />
          </svg>
          <span className="text-base font-semibold tracking-wide">Loan Calculator</span>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-200 ${staffOpen ? "rotate-0" : "rotate-180"}`}
            aria-hidden
          >
            <polyline points="17 11 12 6 7 11" />
            <polyline points="17 18 12 13 7 18" />
          </svg>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Customer-visible section */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-5 py-6 gap-6">

        {/* Payment frequency */}
        <div className="flex flex-col gap-2">
          <SectionLabel>Payment frequency</SectionLabel>
          <div className="flex gap-2">
            {frequencyOptions.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleFrequencyChange(id)}
                className={`flex-1 py-4 rounded-md text-lg font-semibold border transition-colors ${
                  frequency === id
                    ? "bg-blue-950 text-white border-blue-950"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount + Tenure controls — stacked full width */}
        <div className="flex flex-col gap-4">
          {/* Loan amount */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between">
              <label htmlFor={amountId} className="font-semibold text-gray-700 text-base">
                Loan Amount
              </label>
              <NumberInput
                id={amountId}
                value={effectiveAmount}
                min={MIN_LOAN_AMOUNT}
                max={effectiveMaxAmount}
                step={AMOUNT_STEP}
                prefix="S$"
                onChange={handleLoanAmountChange}
                className="w-44"
              />
            </div>
            <input
              type="range"
              min={MIN_LOAN_AMOUNT}
              max={effectiveMaxAmount}
              step={AMOUNT_STEP}
              value={effectiveAmount}
              onChange={(e) => handleLoanAmountChange(parseInt(e.target.value, 10))}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-400">
              <span>S${MIN_LOAN_AMOUNT.toLocaleString()}</span>
              <span>S${effectiveMaxAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Tenure */}
          <div className={`bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-4 w-full ${frequency === "payday" ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between">
              <label htmlFor={tenureId} className="font-semibold text-gray-700 text-base">
                Tenure
              </label>
              <NumberInput
                id={tenureId}
                value={effectiveTenure}
                min={1}
                max={maxTenure}
                step={1}
                suffix="months"
                disabled={frequency === "payday"}
                onChange={handleTenureChange}
                className="w-44"
              />
            </div>
            <input
              type="range"
              min={1}
              max={maxTenure}
              step={1}
              value={effectiveTenure}
              disabled={frequency === "payday"}
              onChange={(e) => handleTenureChange(parseInt(e.target.value, 10))}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-400">
              <span>1 month</span>
              <span>{maxTenure} {maxTenure === 1 ? "month" : "months"}</span>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Results summary */}
        {/* ---------------------------------------------------------------- */}
        {firstRow && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Summary headline — right-aligned */}
            <div className="bg-blue-950 px-6 py-5 text-white text-right">
              <div className="flex flex-wrap items-baseline justify-end gap-x-2">
                <span className="text-4xl font-bold tracking-tight">
                  {formatCurrency(firstRow.payment)}
                </span>
                <span className="text-blue-300 text-xl">
                  {frequency === "monthly"
                    ? "monthly"
                    : frequency === "biweekly"
                      ? "every 2 weeks"
                      : "payday"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm text-blue-200">
                <span>
                  Number of Instalments: <strong className="text-white">{paymentCount}</strong>
                </span>
                <span>
                  First payment: <strong className="text-white">{formatDate(firstRow.dueDate)}</strong>
                </span>
                <span>
                  Total repayment: <strong className="text-white">{formatCurrency(schedule.totalPayment)}</strong>
                </span>
                <span>
                  Loan amount: <strong className="text-white">{formatCurrency(effectiveAmount)}</strong>
                </span>
              </div>
            </div>

            {/* Payment schedule table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
                    <th className="text-left px-4 py-3 font-semibold w-10">#</th>
                    <th className="text-left px-4 py-3 font-semibold">Due date</th>
                    <th className="text-right px-4 py-3 font-semibold">Amount</th>
                    {showDetails && (
                      <>
                        <th className="text-right px-4 py-3 font-semibold">Principal</th>
                        <th className="text-right px-4 py-3 font-semibold">Interest</th>
                        <th className="text-right px-4 py-3 font-semibold">Balance</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {schedule.rows.map((row, idx) => (
                    <tr
                      key={row.period}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="px-4 py-3 text-gray-400 font-mono">{row.period}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">
                        {formatDate(row.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-semibold text-right tabular-nums">
                        {formatCurrency(row.payment)}
                      </td>
                      {showDetails && (
                        <>
                          <td className="px-4 py-3 text-gray-700 text-right tabular-nums">
                            {formatCurrency(row.principal)}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-right tabular-nums">
                            {formatCurrency(row.interest)}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-right tabular-nums">
                            {formatCurrency(row.balance)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* More details toggle */}
            <div className="border-t border-gray-100">
              <button
                onClick={() => setShowDetails((s) => !s)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <span>{showDetails ? "Hide details" : "More details"}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showDetails ? "rotate-180" : "rotate-0"}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showDetails && (
                <div className="px-5 pb-5 pt-1">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Loan amount</span>
                      <span className="font-semibold text-gray-800">{formatCurrency(effectiveAmount)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Processing fee ({feePct}%)</span>
                      <span className="font-semibold text-gray-800">{formatCurrency(schedule.feeAmount)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Net disbursed</span>
                      <span className="font-semibold text-gray-800">{formatCurrency(schedule.netDisbursed)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Total interest</span>
                      <span className="font-semibold text-gray-800">{formatCurrency(schedule.totalInterest)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Total repayment</span>
                      <span className="font-semibold text-gray-800">{formatCurrency(schedule.totalPayment)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Interest rate</span>
                      <span className="font-semibold text-gray-800">3.92% / month</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
