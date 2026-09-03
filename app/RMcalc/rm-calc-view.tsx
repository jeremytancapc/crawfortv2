"use client";

import { useState, useMemo, useCallback, useId, useEffect, useRef } from "react";
import {
  GRADE_CONFIG,
  GRADES,
  MONTHLY_RATE,
  MIN_MONTHLY_RATE,
  MAX_MONTHLY_RATE,
  DEFAULT_FEE_PCT,
  MIN_LOAN_AMOUNT,
  MAX_APPROVED_CAP,
  AMOUNT_STEP,
  buildSchedule,
  formatCurrency,
  formatDate,
  solveQuickSelect,
  enforceEirFloor,
  amountForTargetInstalment,
  type Grade,
  type Frequency,
  type LoanSchedule,
  type QuickSelectGoal,
  type LeverKey,
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
  const [maxApprovedAmount, setMaxApprovedAmount] = useState(
    GRADE_CONFIG[grade].defaultMaxApproved,
  );
  const [maxApprovedRaw, setMaxApprovedRaw] = useState<string | null>(null);
  // Once staff types their own cap, grade switches stop overwriting it —
  // same "manual edit wins" pattern used for tenure/fee/rate.
  const maxApprovedIsCustomRef = useRef(false);
  const [feePct, setFeePct] = useState<number>(DEFAULT_FEE_PCT);
  const [feePctRaw, setFeePctRaw] = useState<string | null>(null);
  const [monthlyRatePct, setMonthlyRatePct] = useState(MONTHLY_RATE * 100);
  const [monthlyRatePctRaw, setMonthlyRatePctRaw] = useState<string | null>(null);
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
  const [quickSelect, setQuickSelect] = useState<QuickSelectGoal | null>(null);
  // Which lever the staff most recently edited by hand — the EIR-floor
  // effect below leaves this one alone and adjusts the other two instead.
  const lastLeverRef = useRef<LeverKey>("tenure");

  // Target instalment (affordability budget) — when set, the loan amount is
  // derived to be the largest one that keeps the instalment at or under this
  // figure, at whatever tenure/fee/rate is currently selected.
  const [targetInstalment, setTargetInstalment] = useState<number | null>(null);
  const [targetInstalmentRaw, setTargetInstalmentRaw] = useState<string | null>(null);

  // More details toggle
  const [showDetails, setShowDetails] = useState(false);

  const gradeInfo = GRADE_CONFIG[grade];

  // Derive effective values
  const effectiveMaxAmount = Math.max(MIN_LOAN_AMOUNT, maxApprovedAmount);
  const effectiveAmount = clamp(loanAmount, MIN_LOAN_AMOUNT, effectiveMaxAmount);

  const maxTenure = frequency === "payday" ? 1 : gradeInfo.maxTenureMonths;
  const effectiveTenure = frequency === "payday" ? 1 : clamp(tenureMonths, 1, maxTenure);

  const disbursedDate = useMemo(() => parseDateStr(disbursedDateStr), [disbursedDateStr]);
  const monthlyRate = monthlyRatePct / 100;

  const schedule: LoanSchedule = useMemo(
    () =>
      buildSchedule(
        effectiveAmount,
        effectiveTenure,
        frequency,
        disbursedDate,
        monthlyRate,
        feePct,
      ),
    [effectiveAmount, effectiveTenure, frequency, disbursedDate, monthlyRate, feePct],
  );

  const handleGradeChange = useCallback(
    (g: Grade) => {
      setGrade(g);
      const newMax = GRADE_CONFIG[g].maxTenureMonths;
      if (!quickSelect && frequency !== "payday" && tenureMonths > newMax) {
        setTenureMonths(newMax);
      }
      // Follow the new grade's default cap unless staff has typed their own.
      if (!maxApprovedIsCustomRef.current) {
        const newDefaultMax = GRADE_CONFIG[g].defaultMaxApproved;
        setMaxApprovedAmount(newDefaultMax);
        setLoanAmount((current) => Math.min(current, newDefaultMax));
      }
    },
    [frequency, tenureMonths, quickSelect],
  );

  const handleFrequencyChange = useCallback(
    (f: Frequency) => {
      setFrequency(f);
      if (f === "payday" && !quickSelect) setTenureMonths(1);
    },
    [quickSelect],
  );

  const handleLoanAmountChange = useCallback(
    (v: number) => {
      // Manually adjusting the amount overrides any affordability budget,
      // same as editing tenure/fee/rate clears an active quick-select preset.
      setTargetInstalment(null);
      setTargetInstalmentRaw(null);
      setLoanAmount(clamp(v, MIN_LOAN_AMOUNT, effectiveMaxAmount));
    },
    [effectiveMaxAmount],
  );

  const periodLabel =
    frequency === "monthly" ? "/month" : frequency === "biweekly" ? "/2 weeks" : "";

  const targetInstalmentResult = useMemo(() => {
    if (targetInstalment == null) return null;
    return amountForTargetInstalment(
      targetInstalment,
      effectiveTenure,
      frequency,
      disbursedDate,
      monthlyRate,
      feePct,
      MIN_LOAN_AMOUNT,
      effectiveMaxAmount,
    );
  }, [targetInstalment, effectiveTenure, frequency, disbursedDate, monthlyRate, feePct, effectiveMaxAmount]);

  const applyTargetInstalment = useCallback((next: number) => {
    setTargetInstalment(next);
  }, []);

  const clearTargetInstalment = useCallback(() => {
    setTargetInstalment(null);
    setTargetInstalmentRaw(null);
  }, []);

  // Keep the loan amount derived from the budget as tenure/fee/rate/grade
  // change (mirrors the quick-select sync effect, but for amount instead).
  useEffect(() => {
    if (targetInstalment == null || !targetInstalmentResult) return;
    setLoanAmount((current) =>
      current === targetInstalmentResult.amount ? current : targetInstalmentResult.amount,
    );
  }, [targetInstalment, targetInstalmentResult]);

  const handleTenureChange = useCallback(
    (v: number) => {
      lastLeverRef.current = "tenure";
      setQuickSelect(null);
      setTenureMonths(clamp(v, 1, maxTenure));
    },
    [maxTenure],
  );

  const applyFeePct = useCallback((next: number) => {
    lastLeverRef.current = "fee";
    setQuickSelect(null);
    setFeePct(next);
  }, []);

  const applyMonthlyRatePct = useCallback((next: number) => {
    lastLeverRef.current = "rate";
    setQuickSelect(null);
    setMonthlyRatePct(next);
  }, []);

  // Discard any quick-select discount or manual override and go back to
  // standard pricing — 10% processing fee, 3.92%/month interest.
  const resetRates = useCallback(() => {
    lastLeverRef.current = "tenure";
    setQuickSelect(null);
    setFeePct(DEFAULT_FEE_PCT);
    setFeePctRaw(null);
    setMonthlyRatePct(parseFloat((MONTHLY_RATE * 100).toFixed(2)));
    setMonthlyRatePctRaw(null);
  }, []);

  const formatRateLabel = (rate: number) =>
    `${parseFloat((rate * 100).toFixed(2))}%/mo`;
  const formatFeeLabel = (pct: number) => `${parseFloat(pct.toFixed(2))}% fee`;

  // Only show the reset control once fee/rate have actually drifted from
  // standard pricing (via a discount preset or a manual edit).
  const ratesModified =
    feePct !== DEFAULT_FEE_PCT || Math.abs(monthlyRatePct - MONTHLY_RATE * 100) > 1e-6;

  const quickSelectOptions = useMemo(() => {
    const goals: { id: QuickSelectGoal; label: string }[] = [
      { id: "longest_tenure", label: "Longest tenure" },
      { id: "lowest_interest", label: "Lowest interest paid" },
      { id: "lowest_fee", label: "Lowest processing fee" },
    ];
    return goals.map((goal) => ({
      ...goal,
      ...solveQuickSelect(
        goal.id,
        effectiveAmount,
        frequency,
        disbursedDate,
        maxTenure,
        gradeInfo.refEirPct,
      ),
    }));
  }, [effectiveAmount, frequency, disbursedDate, maxTenure, gradeInfo.refEirPct]);

  const handleQuickSelect = useCallback(
    (id: QuickSelectGoal) => {
      const option = quickSelectOptions.find((item) => item.id === id);
      if (!option) return;
      setTenureMonths(option.tenureMonths);
      setFeePct(option.feePct);
      setFeePctRaw(null);
      setMonthlyRatePct(parseFloat((option.monthlyRate * 100).toFixed(2)));
      setMonthlyRatePctRaw(null);
      setQuickSelect(id);
    },
    [quickSelectOptions],
  );

  // Keep an active preset aligned when grade, amount, or frequency changes.
  useEffect(() => {
    if (!quickSelect) return;
    const option = quickSelectOptions.find((item) => item.id === quickSelect);
    if (!option) return;
    setTenureMonths((current) =>
      current === option.tenureMonths ? current : option.tenureMonths,
    );
    setFeePct((current) => (current === option.feePct ? current : option.feePct));
    setFeePctRaw(null);
    const nextRatePct = parseFloat((option.monthlyRate * 100).toFixed(2));
    setMonthlyRatePct((current) => (current === nextRatePct ? current : nextRatePct));
    setMonthlyRatePctRaw(null);
  }, [quickSelect, quickSelectOptions]);

  // EIR floor: Live EIR must never sit below the grade's ref EIR. When no
  // preset is active (the effect above already keeps presets floor-safe),
  // re-solve the two levers the staff didn't just touch so the floor holds
  // no matter what combination of tenure/fee/rate they leave behind.
  useEffect(() => {
    if (quickSelect) return;
    const corrected = enforceEirFloor(
      lastLeverRef.current,
      { tenureMonths: effectiveTenure, feePct, monthlyRate },
      effectiveAmount,
      frequency,
      disbursedDate,
      maxTenure,
      gradeInfo.refEirPct,
    );
    if (corrected.tenureMonths !== effectiveTenure) {
      setTenureMonths(corrected.tenureMonths);
    }
    if (Math.abs(corrected.feePct - feePct) > 1e-6) {
      setFeePct(corrected.feePct);
      setFeePctRaw(null);
    }
    const correctedRatePct = parseFloat((corrected.monthlyRate * 100).toFixed(2));
    if (Math.abs(correctedRatePct - monthlyRatePct) > 1e-6) {
      setMonthlyRatePct(correctedRatePct);
      setMonthlyRatePctRaw(null);
    }
  }, [
    quickSelect,
    effectiveAmount,
    effectiveTenure,
    feePct,
    monthlyRate,
    monthlyRatePct,
    frequency,
    disbursedDate,
    maxTenure,
    gradeInfo.refEirPct,
  ]);

  const amountId = useId();
  const tenureId = useId();
  const targetInstalmentId = useId();

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
                        maxApprovedIsCustomRef.current = true;
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
                <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 focus-within:border-blue-800 focus-within:ring-2 focus-within:ring-blue-900/20">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={feePctRaw !== null ? feePctRaw : String(feePct)}
                    style={{ width: `${Math.max((feePctRaw ?? String(feePct)).length, 1)}ch` }}
                    className="shrink-0 bg-transparent text-gray-900 font-semibold outline-none text-base"
                    onChange={(e) => {
                      const s = e.target.value.replace(/[^0-9.]/g, "");
                      setFeePctRaw(s);
                    }}
                    onBlur={() => {
                      const parsed = parseFloat(feePctRaw ?? "");
                      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                        applyFeePct(parsed);
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

              {/* Monthly interest rate */}
              <div className="flex flex-col gap-1">
                <SectionLabel>Interest rate</SectionLabel>
                <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 focus-within:border-blue-800 focus-within:ring-2 focus-within:ring-blue-900/20">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={monthlyRatePctRaw !== null ? monthlyRatePctRaw : String(monthlyRatePct)}
                    style={{
                      width: `${Math.max((monthlyRatePctRaw ?? String(monthlyRatePct)).length, 1)}ch`,
                    }}
                    className="shrink-0 bg-transparent text-gray-900 font-semibold outline-none text-base"
                    onChange={(e) => {
                      const s = e.target.value.replace(/[^0-9.]/g, "");
                      setMonthlyRatePctRaw(s);
                    }}
                    onBlur={() => {
                      const parsed = parseFloat(monthlyRatePctRaw ?? "");
                      const minPct = MIN_MONTHLY_RATE * 100;
                      const maxPct = MAX_MONTHLY_RATE * 100;
                      if (!isNaN(parsed) && parsed >= minPct && parsed <= maxPct) {
                        applyMonthlyRatePct(parsed);
                      }
                      setMonthlyRatePctRaw(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <span className="text-gray-500 font-medium select-none">%/mo</span>
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

        {/* Quick-select presets — auto-set tenure + fee to match ref EIR */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <SectionLabel>Quick select</SectionLabel>
            {ratesModified && (
              <button
                type="button"
                onClick={resetRates}
                className="text-sm font-semibold text-white bg-red-600 border border-red-600 rounded-full px-4 py-1.5 hover:bg-red-700 hover:border-red-700 active:bg-red-800 transition-colors"
              >
                Reset rates
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {quickSelectOptions.map(({
              id,
              label,
              tenureMonths: presetTenure,
              feePct: presetFee,
              monthlyRate: presetRate,
            }) => {
              const selected = quickSelect === id;
              const tenureLabel =
                presetTenure === 1 ? "1 month" : `${presetTenure} months`;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleQuickSelect(id)}
                  className={`flex-1 py-3 px-2 rounded-md border transition-colors active:scale-[0.98] ${
                    selected
                      ? "bg-blue-950 text-white border-blue-950"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-700"
                  }`}
                >
                  <span className="block text-sm font-semibold leading-snug sm:text-base">
                    {label}
                  </span>
                  <span
                    className={`mt-0.5 block text-xs font-medium ${
                      selected ? "text-blue-200" : "text-gray-400"
                    }`}
                  >
                    {tenureLabel} · {formatFeeLabel(presetFee)} · {formatRateLabel(presetRate)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target instalment — optional affordability budget that OVERRIDES loan
            amount (and fee, if needed) below. Coloured distinctly from the
            plain white cards so staff can see at a glance that setting this
            takes control away from the Loan Amount slider underneath. */}
        <div className="flex flex-col gap-2">
          <SectionLabel>Target instalment (optional)</SectionLabel>
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-5 flex flex-col gap-3 w-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor={targetInstalmentId} className="font-semibold text-blue-950 text-base">
                Customer&apos;s budget
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 focus-within:border-blue-800 focus-within:ring-2 focus-within:ring-blue-900/20">
                  <span className="text-gray-500 font-medium select-none">S$</span>
                  <input
                    id={targetInstalmentId}
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 500"
                    value={
                      targetInstalmentRaw !== null
                        ? targetInstalmentRaw
                        : targetInstalment !== null
                          ? String(targetInstalment)
                          : ""
                    }
                    className="w-24 shrink-0 bg-transparent text-gray-900 font-semibold outline-none text-base placeholder:text-gray-300 placeholder:font-normal"
                    onChange={(e) => {
                      const s = e.target.value.replace(/[^0-9]/g, "");
                      setTargetInstalmentRaw(s);
                    }}
                    onBlur={() => {
                      const raw = targetInstalmentRaw ?? "";
                      if (raw === "") {
                        clearTargetInstalment();
                      } else {
                        const parsed = parseInt(raw, 10);
                        if (!isNaN(parsed) && parsed > 0) {
                          applyTargetInstalment(parsed);
                        }
                      }
                      setTargetInstalmentRaw(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                  {periodLabel && (
                    <span className="text-gray-500 text-sm select-none whitespace-nowrap">
                      {periodLabel}
                    </span>
                  )}
                </div>
                {targetInstalment !== null && (
                  <button
                    type="button"
                    onClick={clearTargetInstalment}
                    className="text-sm font-semibold text-blue-500 hover:text-blue-800 active:text-blue-900 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {targetInstalment !== null && targetInstalmentResult ? (
              targetInstalmentResult.reachable ? (
                <p className="text-sm text-blue-900/70">
                  Loan amount capped at{" "}
                  <strong className="text-blue-950">
                    {formatCurrency(targetInstalmentResult.amount)}
                  </strong>{" "}
                  to keep the instalment at or under {formatCurrency(targetInstalment)}
                  {periodLabel}.
                </p>
              ) : (
                <p className="text-sm text-amber-700">
                  Even the minimum loan amount ({formatCurrency(MIN_LOAN_AMOUNT)}) needs{" "}
                  {formatCurrency(targetInstalmentResult.instalment)}
                  {periodLabel} at this tenure — try a longer tenure to bring it down.
                </p>
              )
            ) : (
              <p className="text-sm text-blue-900/60">
                Setting a budget overrides the loan amount below (and the processing
                fee, if needed) to fit it.
              </p>
            )}
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
              <div className="mt-2 flex flex-wrap justify-between gap-x-6 gap-y-1 text-sm text-blue-200">
                {/* General info — what the loan is. flex-nowrap keeps this
                    pair on one line; only the whole group drops to its own
                    row (never splitting into two), capping the block at 2
                    rows total on tablet-width screens and up. */}
                <div className="flex flex-nowrap gap-x-4 gap-y-1 text-left">
                  <span className="whitespace-nowrap">
                    Loan amount: <strong className="text-white">{formatCurrency(effectiveAmount)}</strong>
                  </span>
                  <span className="whitespace-nowrap">
                    Number of Instalments: <strong className="text-white">{paymentCount}</strong>
                  </span>
                </div>
                {/* Cost of borrowing — what it costs */}
                <div className="flex flex-nowrap justify-end gap-x-4 gap-y-1 text-right">
                  <span className="whitespace-nowrap">
                    Total interest paid: <strong className="text-white">{formatCurrency(schedule.totalInterest)}</strong>
                  </span>
                  <span className="whitespace-nowrap">
                    Total repayment: <strong className="text-white">{formatCurrency(schedule.totalPayment)}</strong>
                  </span>
                </div>
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
                          <td className="px-4 py-3 text-gray-900 font-semibold text-right tabular-nums">
                            {formatCurrency(row.principal)}
                          </td>
                          <td className="px-4 py-3 text-gray-900 font-semibold text-right tabular-nums">
                            {formatCurrency(row.interest)}
                          </td>
                          <td className="px-4 py-3 text-gray-900 font-semibold text-right tabular-nums">
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
                className="w-full flex items-center justify-end gap-2 px-5 py-3 text-sm font-semibold text-blue-950 bg-blue-300 hover:bg-blue-400 active:bg-blue-400/90 transition-colors"
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
                      <span className="font-semibold text-gray-800">
                        {parseFloat(monthlyRatePct.toFixed(2))}% / month
                      </span>
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
