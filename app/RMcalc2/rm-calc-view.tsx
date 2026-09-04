"use client";

import { useState, useMemo, useCallback, useId, useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowCounterClockwise, CaretDown, Eye, Plus, User, X } from "@phosphor-icons/react";
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
  formatCurrencyWhole,
  paymentCountLabel,
  solveQuickSelect,
  enforceEirFloor,
  amountForTargetInstalment,
  type Grade,
  type Frequency,
  type LoanSchedule,
  type QuickSelectGoal,
  type LeverKey,
} from "@/lib/rm-calc";
import { cn } from "@/lib/utils";
import { DashedRule, FieldLabel, PillGroup, Slider, UnderlineField } from "./controls";
import { OfferCard, type OfferCell } from "./offer-card";
import { SchedulePanel } from "./schedule-panel";

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

/** "3.92" rather than "3.9200". */
function fmtPct(pct: number): string {
  return String(parseFloat(pct.toFixed(2)));
}

function tenureLabel(months: number): string {
  return months === 1 ? "1 month" : `${months} months`;
}

const FREQUENCY_OPTIONS: readonly { id: Frequency; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "biweekly", label: "Biweekly" },
  { id: "payday", label: "Payday" },
];

const GRADE_OPTIONS = GRADES.map((g) => ({ id: g, label: g }));

const PRESET_GOALS: readonly { id: QuickSelectGoal; label: string }[] = [
  { id: "longest_tenure", label: "Longest tenure" },
  { id: "lowest_interest", label: "Lowest interest" },
  { id: "lowest_fee", label: "Lowest processing fee" },
];

interface OfferCellsInput {
  schedule: LoanSchedule;
  amount: number;
  tenureMonths: number;
  feePct: number;
  monthlyRate: number;
  maxTenure: number;
  frequency: Frequency;
  /** Custom terms highlights the instalment; presets highlight discounted levers. */
  highlightInstalment?: boolean;
}

/** Six label/value pairs for an offer card, with discounted levers in mint. */
function buildOfferCells({
  schedule,
  amount,
  tenureMonths,
  feePct,
  monthlyRate,
  maxTenure,
  frequency,
  highlightInstalment = false,
}: OfferCellsInput): OfferCell[] {
  const instalmentLabel =
    frequency === "monthly"
      ? "Monthly instalment"
      : frequency === "biweekly"
        ? "Biweekly instalment"
        : "Payday repayment";
  const isLongest = frequency !== "payday" && tenureMonths === maxTenure;

  return [
    {
      label: instalmentLabel,
      value: formatCurrency(schedule.rows[0]?.payment ?? 0),
      emphasis: true,
      tone: highlightInstalment ? "mint" : "default",
    },
    { label: "Loan amount", value: formatCurrencyWhole(amount) },
    {
      label: "Interest rate",
      value: `${fmtPct(monthlyRate * 100)}%/mo`,
      tone: !highlightInstalment && monthlyRate < MONTHLY_RATE - 1e-9 ? "mint" : "default",
    },
    {
      label: "Processing fee",
      value: `${fmtPct(feePct)}%`,
      tone: feePct < DEFAULT_FEE_PCT - 1e-9 ? "mint" : "default",
    },
    { label: "Total interest", value: formatCurrency(schedule.totalInterest) },
    {
      label: "Tenure",
      value: tenureLabel(tenureMonths),
      tone: !highlightInstalment && isLongest ? "blue" : "default",
    },
  ];
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function RmCalcView() {
  // Staff panel
  const [staffOpen, setStaffOpen] = useState(true);
  const [grade, setGrade] = useState<Grade>("A");
  const [maxApprovedAmount, setMaxApprovedAmount] = useState(GRADE_CONFIG[grade].defaultMaxApproved);
  // Once staff types their own cap, grade switches stop overwriting it —
  // same "manual edit wins" pattern used for tenure/fee/rate.
  const maxApprovedIsCustomRef = useRef(false);
  const [feePct, setFeePct] = useState<number>(DEFAULT_FEE_PCT);
  const [monthlyRatePct, setMonthlyRatePct] = useState(MONTHLY_RATE * 100);
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
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);

  const [showSchedule, setShowSchedule] = useState(false);

  const gradeInfo = GRADE_CONFIG[grade];

  // Derive effective values
  const effectiveMaxAmount = Math.max(MIN_LOAN_AMOUNT, maxApprovedAmount);
  const effectiveAmount = clamp(loanAmount, MIN_LOAN_AMOUNT, effectiveMaxAmount);

  const maxTenure = frequency === "payday" ? 1 : gradeInfo.maxTenureMonths;
  const effectiveTenure = frequency === "payday" ? 1 : clamp(tenureMonths, 1, maxTenure);

  const disbursedDate = useMemo(() => parseDateStr(disbursedDateStr), [disbursedDateStr]);
  const monthlyRate = monthlyRatePct / 100;

  const schedule: LoanSchedule = useMemo(
    () => buildSchedule(effectiveAmount, effectiveTenure, frequency, disbursedDate, monthlyRate, feePct),
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

  const clearTargetInstalment = useCallback(() => {
    setTargetInstalment(null);
    setIsBudgetOpen(false);
  }, []);

  const handleLoanAmountChange = useCallback(
    (v: number) => {
      // Manually adjusting the amount overrides any affordability budget,
      // same as editing tenure/fee/rate clears an active quick-select preset.
      if (targetInstalment !== null) clearTargetInstalment();
      setLoanAmount(clamp(v, MIN_LOAN_AMOUNT, effectiveMaxAmount));
    },
    [effectiveMaxAmount, targetInstalment, clearTargetInstalment],
  );

  const periodLabel = frequency === "monthly" ? "/ month" : frequency === "biweekly" ? "/ 2 weeks" : "";

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
    setMonthlyRatePct(parseFloat((MONTHLY_RATE * 100).toFixed(2)));
  }, []);

  // Only show the reset control once fee/rate have actually drifted from
  // standard pricing (via a discount preset or a manual edit).
  const ratesModified =
    feePct !== DEFAULT_FEE_PCT || Math.abs(monthlyRatePct - MONTHLY_RATE * 100) > 1e-6;

  // Each preset solved for the current amount/frequency, plus its own schedule
  // so the offer cards can show instalment and total interest side by side.
  const offers = useMemo(
    () =>
      PRESET_GOALS.map((goal) => {
        const solved = solveQuickSelect(
          goal.id,
          effectiveAmount,
          frequency,
          disbursedDate,
          maxTenure,
          gradeInfo.refEirPct,
        );
        return {
          ...goal,
          ...solved,
          schedule: buildSchedule(
            effectiveAmount,
            solved.tenureMonths,
            frequency,
            disbursedDate,
            solved.monthlyRate,
            solved.feePct,
          ),
        };
      }),
    [effectiveAmount, frequency, disbursedDate, maxTenure, gradeInfo.refEirPct],
  );

  const handleQuickSelect = useCallback(
    (id: QuickSelectGoal) => {
      const option = offers.find((item) => item.id === id);
      if (!option) return;
      setTenureMonths(option.tenureMonths);
      setFeePct(option.feePct);
      setMonthlyRatePct(parseFloat((option.monthlyRate * 100).toFixed(2)));
      setQuickSelect(id);
    },
    [offers],
  );

  // Keep an active preset aligned when grade, amount, or frequency changes.
  useEffect(() => {
    if (!quickSelect) return;
    const option = offers.find((item) => item.id === quickSelect);
    if (!option) return;
    setTenureMonths((current) => (current === option.tenureMonths ? current : option.tenureMonths));
    setFeePct((current) => (current === option.feePct ? current : option.feePct));
    const nextRatePct = parseFloat((option.monthlyRate * 100).toFixed(2));
    setMonthlyRatePct((current) => (current === nextRatePct ? current : nextRatePct));
  }, [quickSelect, offers]);

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
    }
    const correctedRatePct = parseFloat((corrected.monthlyRate * 100).toFixed(2));
    if (Math.abs(correctedRatePct - monthlyRatePct) > 1e-6) {
      setMonthlyRatePct(correctedRatePct);
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
  const budgetId = useId();
  const dateId = useId();

  const paymentCount = schedule.rows.length;
  const isPayday = frequency === "payday";

  const liveCells = useMemo(
    () =>
      buildOfferCells({
        schedule,
        amount: effectiveAmount,
        tenureMonths: effectiveTenure,
        feePct,
        monthlyRate,
        maxTenure,
        frequency,
        highlightInstalment: true,
      }),
    [schedule, effectiveAmount, effectiveTenure, feePct, monthlyRate, maxTenure, frequency],
  );

  return (
    <div className="rm-theme flex flex-1 flex-col px-5 py-6 md:px-10 md:py-9">
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-6">
        {/* ---------------------------------------------------------------- */}
        {/* Page header */}
        {/* ---------------------------------------------------------------- */}
        <header className="flex items-center justify-between gap-4 px-1">
          <h1 className="flex min-w-0 items-center gap-3 text-white">
            <Image
              src="/images/crawfort-white-color-dot.png"
              alt="Crawfort"
              width={1261}
              height={155}
              className="h-6 w-auto object-contain object-left md:h-7"
              priority
            />
            <span className="text-[24px] leading-none md:text-[28px]">Loan Plans</span>
          </h1>
          <button
            type="button"
            onClick={() => setStaffOpen((o) => !o)}
            aria-pressed={staffOpen}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold transition-[background-color,box-shadow,transform] active:scale-[0.98]",
              staffOpen
                ? "bg-[#E11D48] text-white shadow-[0_0_0_3px_rgba(225,29,72,0.45),0_8px_18px_-6px_rgba(225,29,72,0.85)] hover:bg-[#BE123C]"
                : "bg-[var(--rm-mint)] text-[var(--rm-ink)] shadow-[0_0_0_3px_rgba(6,222,192,0.35),0_8px_18px_-6px_rgba(6,222,192,0.55)] hover:bg-[#05c9ad]",
            )}
          >
            {staffOpen ? <Eye size={16} weight="bold" /> : <User size={16} weight="bold" />}
            <span>{staffOpen ? "Staff view" : "Customer view"}</span>
          </button>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Split card */}
        {/* ---------------------------------------------------------------- */}
        <main className="grid overflow-hidden rounded-[24px] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.06)] md:grid-cols-[minmax(0,11fr)_minmax(0,13fr)]">
          {/* ============================ LEFT ============================ */}
          <section
            aria-labelledby="calc-heading"
            className="flex flex-col gap-7 px-6 py-7 md:px-7 md:py-9 lg:px-9"
          >
            <h2 id="calc-heading" className="text-[22px] leading-tight text-balance">
              {staffOpen ? "Enter customer approved plan" : "Adjust Loan amount and Tenure"}
            </h2>

            {/* Staff-only pricing controls */}
            {staffOpen && (
              <>
                <div className="relative flex flex-col gap-5">
                  <div aria-hidden className="rm-staff-watermark" />
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <FieldLabel>Customer grade</FieldLabel>
                      <span className="text-[12px] font-medium text-[var(--rm-ink-3)]">
                        Max {tenureLabel(gradeInfo.maxTenureMonths)} · Ref EIR {gradeInfo.refEirPct.toFixed(1)}%
                      </span>
                    </div>
                    <PillGroup
                      size="sm"
                      ariaLabel="Customer grade"
                      options={GRADE_OPTIONS}
                      value={grade}
                      onChange={handleGradeChange}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                    <UnderlineField
                      label="Max approved amount"
                      prefix="S$"
                      value={maxApprovedAmount.toLocaleString("en-SG")}
                      onCommit={(raw) => {
                        const parsed = parseInt(raw, 10);
                        if (isNaN(parsed) || parsed < MIN_LOAN_AMOUNT) return;
                        const capped = Math.min(parsed, MAX_APPROVED_CAP);
                        maxApprovedIsCustomRef.current = true;
                        setMaxApprovedAmount(capped);
                        if (loanAmount > capped) setLoanAmount(capped);
                      }}
                    />

                    <div className="flex flex-col gap-1.5">
                      <FieldLabel htmlFor={dateId}>Disbursement date</FieldLabel>
                      <div className="rm-field pb-1.5">
                        <input
                          id={dateId}
                          type="date"
                          value={disbursedDateStr}
                          onChange={(e) => e.target.value && setDisbursedDateStr(e.target.value)}
                          className="w-full min-w-0 text-[16px] font-bold leading-6 text-[var(--rm-ink)]"
                        />
                      </div>
                    </div>

                    <UnderlineField
                      label="Processing fee"
                      suffix="%"
                      mode="decimal"
                      value={fmtPct(feePct)}
                      onCommit={(raw) => {
                        const parsed = parseFloat(raw);
                        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) applyFeePct(parsed);
                      }}
                    />

                    <UnderlineField
                      label="Interest rate"
                      suffix="% / month"
                      mode="decimal"
                      value={fmtPct(monthlyRatePct)}
                      onCommit={(raw) => {
                        const parsed = parseFloat(raw);
                        const minPct = MIN_MONTHLY_RATE * 100;
                        const maxPct = MAX_MONTHLY_RATE * 100;
                        if (!isNaN(parsed) && parsed >= minPct && parsed <= maxPct) applyMonthlyRatePct(parsed);
                      }}
                    />
                  </div>
                </div>
                <DashedRule />
              </>
            )}

            {/* Payment frequency */}
            <div className="flex flex-col gap-2.5">
              <FieldLabel>Payment frequency</FieldLabel>
              <PillGroup
                fill
                ariaLabel="Payment frequency"
                options={FREQUENCY_OPTIONS}
                value={frequency}
                onChange={handleFrequencyChange}
              />
            </div>

            {/* Loan amount */}
            <div className="flex flex-col gap-1">
              <UnderlineField
                id={amountId}
                label="Loan amount"
                prefix="S$"
                emphasis
                value={effectiveAmount.toLocaleString("en-SG")}
                onCommit={(raw) => {
                  const parsed = parseInt(raw, 10);
                  if (isNaN(parsed)) return;
                  const snapped = Math.round(parsed / AMOUNT_STEP) * AMOUNT_STEP;
                  handleLoanAmountChange(snapped);
                }}
              />
              <Slider
                ariaLabel="Loan amount"
                min={MIN_LOAN_AMOUNT}
                max={effectiveMaxAmount}
                step={AMOUNT_STEP}
                value={effectiveAmount}
                minLabel={formatCurrencyWhole(MIN_LOAN_AMOUNT)}
                maxLabel={formatCurrencyWhole(effectiveMaxAmount)}
                onChange={handleLoanAmountChange}
              />
            </div>

            {/* Tenure */}
            <div className="flex flex-col gap-1">
              <UnderlineField
                id={tenureId}
                label="Loan tenure"
                suffix={effectiveTenure === 1 ? "month" : "months"}
                emphasis
                disabled={isPayday}
                value={String(effectiveTenure)}
                onCommit={(raw) => {
                  const parsed = parseInt(raw, 10);
                  if (!isNaN(parsed)) handleTenureChange(parsed);
                }}
              />
              <Slider
                ariaLabel="Loan tenure in months"
                min={1}
                max={maxTenure}
                step={1}
                value={effectiveTenure}
                disabled={isPayday}
                minLabel="1 month"
                maxLabel={maxTenure === 1 ? "1 month" : `${maxTenure} months`}
                onChange={handleTenureChange}
              />
            </div>

            <DashedRule />

            {/* Affordability budget — optional, overrides loan amount */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[15px] leading-none">Affordability</h3>

              {!isBudgetOpen ? (
                <button
                  type="button"
                  onClick={() => setIsBudgetOpen(true)}
                  className="group flex items-center gap-3 self-start rounded-full py-1 pr-2 text-[15px] font-semibold text-[var(--rm-blue)] transition-colors hover:text-[var(--rm-blue-deep)]"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-[var(--rm-mint-tint)] text-[var(--rm-mint-ink)] transition-transform group-hover:scale-105 group-active:scale-95">
                    <Plus size={16} weight="bold" />
                  </span>
                  Set the customer&apos;s budget
                </button>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <UnderlineField
                    id={budgetId}
                    autoFocus
                    label={`Target instalment ${periodLabel}`.trim()}
                    prefix="S$"
                    placeholder="e.g. 500"
                    value={targetInstalment !== null ? targetInstalment.toLocaleString("en-SG") : ""}
                    onCommit={(raw) => {
                      if (raw === "") {
                        if (targetInstalment !== null) clearTargetInstalment();
                        return;
                      }
                      const parsed = parseInt(raw, 10);
                      if (!isNaN(parsed) && parsed > 0) setTargetInstalment(parsed);
                    }}
                    trailing={
                      <button
                        type="button"
                        onClick={clearTargetInstalment}
                        aria-label="Clear budget"
                        className="ml-1 grid size-7 place-items-center rounded-full text-[var(--rm-ink-3)] transition-colors hover:bg-[var(--rm-panel)] hover:text-[var(--rm-ink)]"
                      >
                        <X size={14} weight="bold" />
                      </button>
                    }
                  />
                  <p className="text-[13px] leading-snug text-[var(--rm-ink-2)]">
                    {targetInstalment !== null && targetInstalmentResult ? (
                      targetInstalmentResult.reachable ? (
                        <>
                          Loan amount capped at{" "}
                          <strong className="text-[var(--rm-ink)]">
                            {formatCurrency(targetInstalmentResult.amount)}
                          </strong>{" "}
                          to keep the instalment at or under {formatCurrency(targetInstalment)} {periodLabel}.
                        </>
                      ) : (
                        <>
                          Even the minimum loan ({formatCurrency(MIN_LOAN_AMOUNT)}) needs{" "}
                          {formatCurrency(targetInstalmentResult.instalment)} {periodLabel} at this tenure — try a
                          longer tenure to bring it down.
                        </>
                      )
                    ) : (
                      <>Setting a budget overrides the loan amount above (and the processing fee, if needed) to fit it.</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ============================ RIGHT =========================== */}
          <aside
            aria-labelledby="offers-heading"
            className="flex flex-col gap-5 bg-[var(--rm-panel)] px-6 py-7 md:px-7 md:py-9 lg:px-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 id="offers-heading" className="text-[22px] leading-tight">
                Choose an offer
              </h2>
              <div className="flex items-center gap-2">
                {staffOpen && (
                  <span
                    title={`Nominal, ${schedule.periodsPerYear} periods/yr · floor ${gradeInfo.refEirPct.toFixed(1)}%`}
                    className="rounded-full bg-[rgba(0,51,170,0.08)] px-3 py-1.5 text-[12px] font-bold tabular-nums text-[var(--rm-blue)]"
                  >
                    Live EIR {schedule.eir.toFixed(1)}%
                  </span>
                )}
                {ratesModified && (
                  <button
                    type="button"
                    onClick={resetRates}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-[var(--rm-ink-2)] transition-colors hover:bg-white hover:text-[var(--rm-ink)]"
                  >
                    <ArrowCounterClockwise size={14} weight="bold" />
                    Reset pricing
                  </button>
                )}
              </div>
            </div>

            <div role="radiogroup" aria-label="Offers" className="flex flex-col gap-3">
              <OfferCard
                title="Custom terms"
                caption={ratesModified ? "Adjusted" : "Standard"}
                variant="custom"
                cells={liveCells}
                selected={quickSelect === null}
                onSelect={() => setQuickSelect(null)}
              />
              {offers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  title={offer.label}
                  variant={offer.id}
                  cells={buildOfferCells({
                    schedule: offer.schedule,
                    amount: effectiveAmount,
                    tenureMonths: offer.tenureMonths,
                    feePct: offer.feePct,
                    monthlyRate: offer.monthlyRate,
                    maxTenure,
                    frequency,
                  })}
                  selected={quickSelect === offer.id}
                  onSelect={() => handleQuickSelect(offer.id)}
                />
              ))}
            </div>

            {/* Footer: totals + schedule CTA */}
            <div className="mt-auto flex items-end justify-between gap-4 pt-1">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium leading-none text-[var(--rm-ink-3)]">Total repayment</div>
                <div className="mt-1.5 text-[22px] font-bold leading-none tabular-nums text-[var(--rm-ink)]">
                  {formatCurrency(schedule.totalPayment)}
                </div>
                <div className="mt-1.5 text-[13px] font-medium leading-snug text-[var(--rm-ink-3)]">
                  {paymentCountLabel(paymentCount, frequency)} · net disbursed {formatCurrency(schedule.netDisbursed)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSchedule((s) => !s)}
                aria-expanded={showSchedule}
                className="flex shrink-0 items-center gap-2.5 rounded-xl bg-[var(--rm-blue)] px-5 py-3.5 text-[15px] font-bold text-white shadow-[0_8px_20px_-6px_rgba(0,51,170,0.6)] transition-[background-color,transform] hover:bg-[var(--rm-blue-deep)] active:scale-[0.98]"
              >
                {showSchedule ? "Hide schedule" : "Repayment schedule"}
                <CaretDown
                  size={16}
                  weight="bold"
                  className={cn("transition-transform duration-200", showSchedule && "rotate-180")}
                />
              </button>
            </div>

            {showSchedule && (
              <SchedulePanel
                schedule={schedule}
                loanAmount={effectiveAmount}
                feePct={feePct}
                monthlyRatePct={monthlyRatePct}
              />
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
