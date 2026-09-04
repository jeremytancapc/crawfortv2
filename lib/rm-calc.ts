/**
 * RM Loan Calculator — math, schedule building, and EIR computation.
 *
 * EIR model: nominal annual rate = periodic IRR × periods-per-year.
 * Processing fee is deducted upfront from the disbursed amount;
 * the repayment schedule is computed on the full loan face value.
 *
 * Verified against grade reference table (10% fee, 3.92%/month):
 *   D (3mo) → 116.0%, C (5mo) → 93.4%, B (10mo) → 73.0%,
 *   A (12mo) → 69.3%, S (15mo) → 65.5%
 */

export type Grade = "S" | "A" | "B" | "C" | "D";
export type Frequency = "monthly" | "biweekly" | "payday";

export interface GradeInfo {
  maxTenureMonths: number;
  /** Reference EIR at max tenure, monthly frequency, 10% fee (from grade table). */
  refEirPct: number;
  /** Default max approved amount for this grade, before staff override. */
  defaultMaxApproved: number;
}

export const GRADE_CONFIG: Record<Grade, GradeInfo> = {
  S: { maxTenureMonths: 15, refEirPct: 65.5, defaultMaxApproved: 20_000 },
  A: { maxTenureMonths: 12, refEirPct: 69.3, defaultMaxApproved: 10_000 },
  B: { maxTenureMonths: 10, refEirPct: 73.0, defaultMaxApproved: 5_000 },
  C: { maxTenureMonths: 5, refEirPct: 93.4, defaultMaxApproved: 3_000 },
  D: { maxTenureMonths: 3, refEirPct: 116.0, defaultMaxApproved: 900 },
};

export const GRADES: Grade[] = ["S", "A", "B", "C", "D"];
export const MONTHLY_RATE = 0.0392;
/** Lowest monthly rate we'll ever offer, for any grade — never interest-free. */
export const MIN_MONTHLY_RATE = 0.01;
/** Standard / max monthly rate — “max out interest”. */
export const MAX_MONTHLY_RATE = MONTHLY_RATE;
export const DEFAULT_FEE_PCT = 10;
/** Processing fee cannot go below 0% when matching ref EIR. */
export const MIN_FEE_PCT = 0;
/** Processing fee cannot exceed the 10% licensed-moneylender cap. */
export const MAX_FEE_PCT = DEFAULT_FEE_PCT;
export const MIN_LOAN_AMOUNT = 300;
/** Hard ceiling for staff-entered max approved amount. */
export const MAX_APPROVED_CAP = 200_000;
export const AMOUNT_STEP = 100;

export interface ScheduleRow {
  period: number;
  dueDate: Date;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface LoanSchedule {
  rows: ScheduleRow[];
  totalPayment: number;
  totalInterest: number;
  netDisbursed: number;
  feeAmount: number;
  /** Nominal annual EIR as a percentage, e.g. 65.5 */
  eir: number;
  frequency: Frequency;
  periodsPerYear: number;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Add calendar months, clamping to the last day of the target month. */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const daysInTarget = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, daysInTarget));
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ---------------------------------------------------------------------------
// IRR bisection
// ---------------------------------------------------------------------------

/**
 * Find the per-period rate r (via bisection) such that:
 *   netDisbursed = Σ payments[i] / (1+r)^(i+1)
 *
 * Returns the per-period rate. Multiply by periodsPerYear for nominal EIR.
 */
function computeIrr(netDisbursed: number, payments: number[]): number {
  if (!payments.length || netDisbursed <= 0) return 0;
  let lo = 1e-6;
  let hi = 10.0; // 1000% per period — broad enough for any realistic loan
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    const pv = payments.reduce((sum, p, idx) => sum + p / Math.pow(1 + mid, idx + 1), 0);
    if (pv > netDisbursed) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-10) break;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Schedule builders
// ---------------------------------------------------------------------------

function buildMonthlySchedule(
  amount: number,
  tenureMonths: number,
  monthlyRate: number,
  disbursedDate: Date,
  netDisbursed: number,
): LoanSchedule {
  const n = tenureMonths;
  const r = monthlyRate;

  // Standard amortized instalment, rounded up to the nearest cent.
  // r = 0 is a 0/0 in the formula — fall back to equal principal splits.
  const rawInstalment =
    r <= 0
      ? amount / n
      : (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const instalment = Math.ceil(rawInstalment * 100) / 100;

  const rows: ScheduleRow[] = [];
  let balance = Math.round(amount * 100) / 100;

  for (let i = 1; i <= n; i++) {
    const interest = Math.round(balance * r * 100) / 100;
    const isLast = i === n;
    let principal: number;
    let payment: number;

    if (isLast) {
      // Final instalment clears remaining balance exactly
      principal = balance;
      payment = Math.round((principal + interest) * 100) / 100;
    } else {
      principal = Math.round((instalment - interest) * 100) / 100;
      payment = instalment;
    }

    balance = Math.max(0, Math.round((balance - principal) * 100) / 100);

    rows.push({
      period: i,
      dueDate: addMonths(disbursedDate, i),
      payment,
      principal,
      interest,
      balance,
    });
  }

  const payments = rows.map((row) => row.payment);
  const irr = computeIrr(netDisbursed, payments);
  const eir = irr * 12 * 100;

  return {
    rows,
    totalPayment: Math.round(rows.reduce((s, row) => s + row.payment, 0) * 100) / 100,
    totalInterest: Math.round(rows.reduce((s, row) => s + row.interest, 0) * 100) / 100,
    netDisbursed,
    feeAmount: Math.round((amount - netDisbursed) * 100) / 100,
    eir,
    frequency: "monthly",
    periodsPerYear: 12,
  };
}

function buildBiweeklySchedule(
  amount: number,
  tenureMonths: number,
  monthlyRate: number,
  disbursedDate: Date,
  netDisbursed: number,
): LoanSchedule {
  // Number of 14-day periods spanning the tenure
  const n = Math.round(tenureMonths * 26 / 12);

  // Convert monthly rate to 14-day rate: 1 month ≈ 365.25/12 days
  const r = monthlyRate * (14 / (365.25 / 12));

  const rawInstalment =
    r <= 0
      ? amount / n
      : (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const instalment = Math.ceil(rawInstalment * 100) / 100;

  const rows: ScheduleRow[] = [];
  let balance = Math.round(amount * 100) / 100;

  for (let i = 1; i <= n; i++) {
    const interest = Math.round(balance * r * 100) / 100;
    const isLast = i === n;
    let principal: number;
    let payment: number;

    if (isLast) {
      principal = balance;
      payment = Math.round((principal + interest) * 100) / 100;
    } else {
      principal = Math.round((instalment - interest) * 100) / 100;
      payment = instalment;
    }

    balance = Math.max(0, Math.round((balance - principal) * 100) / 100);

    rows.push({
      period: i,
      dueDate: addDays(disbursedDate, i * 14),
      payment,
      principal,
      interest,
      balance,
    });
  }

  const payments = rows.map((row) => row.payment);
  const irr = computeIrr(netDisbursed, payments);
  const eir = irr * 26 * 100; // nominal: 26 biweekly periods per year

  return {
    rows,
    totalPayment: Math.round(rows.reduce((s, row) => s + row.payment, 0) * 100) / 100,
    totalInterest: Math.round(rows.reduce((s, row) => s + row.interest, 0) * 100) / 100,
    netDisbursed,
    feeAmount: Math.round((amount - netDisbursed) * 100) / 100,
    eir,
    frequency: "biweekly",
    periodsPerYear: 26,
  };
}

function buildPaydaySchedule(
  amount: number,
  monthlyRate: number,
  disbursedDate: Date,
  netDisbursed: number,
): LoanSchedule {
  // Single bullet payment = full principal + one month's interest
  const interest = Math.round(amount * monthlyRate * 100) / 100;
  const payment = Math.round((amount + interest) * 100) / 100;
  const dueDate = addMonths(disbursedDate, 1);

  const rows: ScheduleRow[] = [
    {
      period: 1,
      dueDate,
      payment,
      principal: amount,
      interest,
      balance: 0,
    },
  ];

  const irr = computeIrr(netDisbursed, [payment]);
  const eir = irr * 12 * 100;

  return {
    rows,
    totalPayment: payment,
    totalInterest: interest,
    netDisbursed,
    feeAmount: Math.round((amount - netDisbursed) * 100) / 100,
    eir,
    frequency: "payday",
    periodsPerYear: 12,
  };
}

/**
 * Build the full repayment schedule.
 *
 * @param amount       Loan face value (before fee deduction)
 * @param tenureMonths Repayment period in months (ignored for payday — always 1)
 * @param frequency    "monthly" | "biweekly" | "payday"
 * @param disbursedDate  Date the loan is disbursed
 * @param monthlyRate  Monthly interest rate (default: MONTHLY_RATE = 0.0392)
 * @param feePct       Processing fee as a percentage of loan amount (default: 10)
 */
export function buildSchedule(
  amount: number,
  tenureMonths: number,
  frequency: Frequency,
  disbursedDate: Date,
  monthlyRate: number = MONTHLY_RATE,
  feePct: number = DEFAULT_FEE_PCT,
): LoanSchedule {
  const feeAmount = Math.round((amount * feePct) / 100 * 100) / 100;
  const netDisbursed = Math.round((amount - feeAmount) * 100) / 100;

  switch (frequency) {
    case "payday":
      return buildPaydaySchedule(amount, monthlyRate, disbursedDate, netDisbursed);
    case "biweekly":
      return buildBiweeklySchedule(amount, tenureMonths, monthlyRate, disbursedDate, netDisbursed);
    default:
      return buildMonthlySchedule(amount, tenureMonths, monthlyRate, disbursedDate, netDisbursed);
  }
}

// ---------------------------------------------------------------------------
// Target instalment — solve loan amount from an affordability budget
// ---------------------------------------------------------------------------

export interface TargetInstalmentResult {
  /** The largest loan amount (snapped to AMOUNT_STEP) that keeps the
   *  periodic instalment at or under the target. */
  amount: number;
  /** The instalment produced by that amount — always <= target when reachable. */
  instalment: number;
  /** False when even `minAmount` produces an instalment above the target —
   *  the budget can't be met at the current tenure/fee/rate/frequency. */
  reachable: boolean;
}

/**
 * A customer with a fixed budget (e.g. "I can only pay S$500/month") should
 * get the largest loan that fits that budget, not a fixed loan amount with
 * an instalment that may exceed it. Instalment rises monotonically with
 * loan amount (holding tenure/fee/rate/frequency fixed), so this bisects on
 * amount for the largest value whose first-row payment is <= target.
 */
export function amountForTargetInstalment(
  targetInstalment: number,
  tenureMonths: number,
  frequency: Frequency,
  disbursedDate: Date,
  monthlyRate: number,
  feePct: number,
  minAmount: number,
  maxAmount: number,
): TargetInstalmentResult {
  const instalmentAt = (amount: number) =>
    buildSchedule(amount, tenureMonths, frequency, disbursedDate, monthlyRate, feePct).rows[0]?.payment ?? 0;

  const atMin = instalmentAt(minAmount);
  if (atMin > targetInstalment) {
    // Even the smallest loan blows the budget at this tenure/fee/rate.
    return { amount: minAmount, instalment: atMin, reachable: false };
  }

  const atMax = instalmentAt(maxAmount);
  if (atMax <= targetInstalment) {
    // The full approved amount already fits — nothing to shrink.
    return { amount: maxAmount, instalment: atMax, reachable: true };
  }

  let lo = minAmount;
  let hi = maxAmount;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (instalmentAt(mid) <= targetInstalment) lo = mid;
    else hi = mid;
  }

  // Snap down to the nearest step so we never round back over the budget.
  let amount = Math.max(minAmount, Math.floor(lo / AMOUNT_STEP) * AMOUNT_STEP);
  while (amount > minAmount && instalmentAt(amount) > targetInstalment) {
    amount -= AMOUNT_STEP;
  }

  return { amount, instalment: instalmentAt(amount), reachable: true };
}

// ---------------------------------------------------------------------------
// Quick-select presets (match grade ref EIR)
// ---------------------------------------------------------------------------

export type QuickSelectGoal = "longest_tenure" | "lowest_interest" | "lowest_fee";

export interface QuickSelectResult {
  tenureMonths: number;
  feePct: number;
  /** Monthly interest rate as a decimal, e.g. 0.0392. */
  monthlyRate: number;
  eir: number;
}

/** Live EIR is shown to 1 decimal; allow a hair of IRR/table rounding drift. */
function eirMatches(eir: number, target: number): boolean {
  return eir.toFixed(1) === target.toFixed(1) || Math.abs(eir - target) < 0.15;
}

function snapFeePct(feePct: number): number {
  return Math.round(feePct * 100) / 100;
}

/** Snap to 0.01 on the displayed monthly percent (3.92, 2.03). */
function snapMonthlyRate(rate: number): number {
  return Math.round(rate * 10000) / 10000;
}

function bisectToTargetEir(
  targetEirPct: number,
  read: (value: number) => number,
  lo: number,
  hi: number,
): number {
  let best = hi;
  let bestDiff = Infinity;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const eir = read(mid);
    const diff = Math.abs(eir - targetEirPct);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = mid;
    }
    if (eir > targetEirPct) hi = mid;
    else lo = mid;
  }
  return best;
}

/**
 * Solve for the processing fee in [0, 10] that makes live EIR match
 * `targetEirPct` at a fixed monthly rate. Higher fee raises EIR.
 */
export function feePctForTargetEir(
  amount: number,
  tenureMonths: number,
  frequency: Frequency,
  disbursedDate: Date,
  targetEirPct: number,
  monthlyRate: number = MONTHLY_RATE,
): { feePct: number; eir: number; reachable: boolean } {
  const eirAt = (feePct: number) =>
    buildSchedule(amount, tenureMonths, frequency, disbursedDate, monthlyRate, feePct).eir;

  const atMin = eirAt(MIN_FEE_PCT);
  const atMax = eirAt(MAX_FEE_PCT);

  if (!eirMatches(atMax, targetEirPct) && atMax < targetEirPct) {
    return { feePct: MAX_FEE_PCT, eir: atMax, reachable: false };
  }
  if (!eirMatches(atMin, targetEirPct) && atMin > targetEirPct) {
    return { feePct: MIN_FEE_PCT, eir: atMin, reachable: false };
  }

  let snapped = snapFeePct(
    bisectToTargetEir(targetEirPct, eirAt, MIN_FEE_PCT, MAX_FEE_PCT),
  );
  snapped = Math.min(MAX_FEE_PCT, Math.max(MIN_FEE_PCT, snapped));
  let eir = eirAt(snapped);

  while (snapped > MIN_FEE_PCT && Number(eir.toFixed(1)) > Number(targetEirPct.toFixed(1))) {
    snapped = snapFeePct(snapped - 0.01);
    eir = eirAt(snapped);
  }
  while (snapped < MAX_FEE_PCT && Number(eir.toFixed(1)) < Number(targetEirPct.toFixed(1))) {
    snapped = snapFeePct(snapped + 0.01);
    eir = eirAt(snapped);
  }

  return { feePct: snapped, eir, reachable: eirMatches(eir, targetEirPct) };
}

/**
 * Solve for the monthly rate in [0, 3.92%] that makes live EIR match
 * `targetEirPct` at a fixed processing fee. Higher rate raises EIR.
 */
export function monthlyRateForTargetEir(
  amount: number,
  tenureMonths: number,
  frequency: Frequency,
  disbursedDate: Date,
  targetEirPct: number,
  feePct: number = MAX_FEE_PCT,
): { monthlyRate: number; eir: number; reachable: boolean } {
  const eirAt = (rate: number) =>
    buildSchedule(amount, tenureMonths, frequency, disbursedDate, rate, feePct).eir;

  const atMin = eirAt(MIN_MONTHLY_RATE);
  const atMax = eirAt(MAX_MONTHLY_RATE);

  if (!eirMatches(atMax, targetEirPct) && atMax < targetEirPct) {
    return { monthlyRate: MAX_MONTHLY_RATE, eir: atMax, reachable: false };
  }
  if (!eirMatches(atMin, targetEirPct) && atMin > targetEirPct) {
    return { monthlyRate: MIN_MONTHLY_RATE, eir: atMin, reachable: false };
  }

  let snapped = snapMonthlyRate(
    bisectToTargetEir(targetEirPct, eirAt, MIN_MONTHLY_RATE, MAX_MONTHLY_RATE),
  );
  snapped = Math.min(MAX_MONTHLY_RATE, Math.max(MIN_MONTHLY_RATE, snapped));
  let eir = eirAt(snapped);

  while (snapped > MIN_MONTHLY_RATE && Number(eir.toFixed(1)) > Number(targetEirPct.toFixed(1))) {
    snapped = snapMonthlyRate(snapped - 0.0001);
    eir = eirAt(snapped);
  }
  while (snapped < MAX_MONTHLY_RATE && Number(eir.toFixed(1)) < Number(targetEirPct.toFixed(1))) {
    snapped = snapMonthlyRate(snapped + 0.0001);
    eir = eirAt(snapped);
  }

  return { monthlyRate: snapped, eir, reachable: eirMatches(eir, targetEirPct) };
}

function tenureCapFor(frequency: Frequency, maxTenureMonths: number): number {
  return frequency === "payday" ? 1 : maxTenureMonths;
}

/**
 * Pick tenure + fee + monthly rate so live EIR matches the grade ref EIR.
 *
 * The two discount buttons pull opposite levers:
 * - Lowest interest: lock fee at 10%, reduce the monthly rate, shorten
 *   tenure only as far as a 10% fee can still hit the ref.
 * - Lowest processing fee: lock rate at 3.92%, discount the fee, shorten
 *   tenure so the fee can fall while still hitting the ref.
 * - Longest tenure: standard pricing (10% fee, 3.92%), longest term.
 */
export function solveQuickSelect(
  goal: QuickSelectGoal,
  amount: number,
  frequency: Frequency,
  disbursedDate: Date,
  maxTenureMonths: number,
  targetEirPct: number,
): QuickSelectResult {
  const tenureCap = tenureCapFor(frequency, maxTenureMonths);
  const fallback: QuickSelectResult = {
    tenureMonths: tenureCap,
    feePct: DEFAULT_FEE_PCT,
    monthlyRate: MONTHLY_RATE,
    eir: buildSchedule(
      amount,
      tenureCap,
      frequency,
      disbursedDate,
      MONTHLY_RATE,
      DEFAULT_FEE_PCT,
    ).eir,
  };

  if (goal === "longest_tenure") {
    for (let tenureMonths = tenureCap; tenureMonths >= 1; tenureMonths--) {
      const schedule = buildSchedule(
        amount,
        tenureMonths,
        frequency,
        disbursedDate,
        MONTHLY_RATE,
        MAX_FEE_PCT,
      );
      if (eirMatches(schedule.eir, targetEirPct) || schedule.eir >= targetEirPct - 0.15) {
        return {
          tenureMonths,
          feePct: MAX_FEE_PCT,
          monthlyRate: MONTHLY_RATE,
          eir: schedule.eir,
        };
      }
    }
    return fallback;
  }

  if (goal === "lowest_interest") {
    let best: QuickSelectResult | null = null;
    let bestInterest = Infinity;
    for (let tenureMonths = 1; tenureMonths <= tenureCap; tenureMonths++) {
      const solved = monthlyRateForTargetEir(
        amount,
        tenureMonths,
        frequency,
        disbursedDate,
        targetEirPct,
        MAX_FEE_PCT,
      );
      if (!solved.reachable) continue;
      const schedule = buildSchedule(
        amount,
        tenureMonths,
        frequency,
        disbursedDate,
        solved.monthlyRate,
        MAX_FEE_PCT,
      );
      if (
        schedule.totalInterest < bestInterest ||
        (schedule.totalInterest === bestInterest &&
          solved.monthlyRate < (best?.monthlyRate ?? Infinity))
      ) {
        bestInterest = schedule.totalInterest;
        best = {
          tenureMonths,
          feePct: MAX_FEE_PCT,
          monthlyRate: solved.monthlyRate,
          eir: schedule.eir,
        };
      }
    }
    return best ?? fallback;
  }

  let best: QuickSelectResult | null = null;
  for (let tenureMonths = 1; tenureMonths <= tenureCap; tenureMonths++) {
    const solved = feePctForTargetEir(
      amount,
      tenureMonths,
      frequency,
      disbursedDate,
      targetEirPct,
      MONTHLY_RATE,
    );
    if (!solved.reachable) continue;
    if (!best || solved.feePct < best.feePct) {
      best = {
        tenureMonths,
        feePct: solved.feePct,
        monthlyRate: MONTHLY_RATE,
        eir: solved.eir,
      };
    }
  }
  return best ?? fallback;
}

// ---------------------------------------------------------------------------
// EIR floor enforcement — keep Live EIR >= grade ref EIR at all times
// ---------------------------------------------------------------------------

export type LeverKey = "tenure" | "fee" | "rate";

export interface LeverState {
  tenureMonths: number;
  feePct: number;
  monthlyRate: number;
}

/**
 * Live EIR must never sit below the grade's ref EIR — that reference is the
 * floor price for the grade, not just a quick-select target. Whenever the
 * staff edits one lever (tenure, fee, or rate) in a way that would push EIR
 * below the floor, the OTHER two levers compensate automatically, in this
 * order:
 *
 *   tenure changed -> raise rate, then fee, then (last resort) shrink tenure
 *   fee changed    -> raise rate, then (last resort) shrink tenure
 *   rate changed   -> raise fee,  then (last resort) shrink tenure
 *
 * The lever the staff just edited is never overridden — only the other two
 * move. Shrinking tenure is a last resort because it directly contradicts
 * what the staff is trying to do (e.g. lengthen the loan); it only happens
 * once both pricing levers are already pinned at their ceiling and tenure
 * itself is still too long to reach the floor (e.g. biweekly at max tenure).
 *
 * Returns the state unchanged if EIR is already at or above the floor.
 */
export function enforceEirFloor(
  changed: LeverKey,
  state: LeverState,
  amount: number,
  frequency: Frequency,
  disbursedDate: Date,
  maxTenureMonths: number,
  targetEirPct: number,
): LeverState {
  const tenureCap = tenureCapFor(frequency, maxTenureMonths);
  const tenureMonths = Math.min(Math.max(1, Math.round(state.tenureMonths)), tenureCap);
  // Never charge below the 1% interest-rate floor, even if the incoming
  // state (e.g. a stale value from before this floor existed) says otherwise.
  const monthlyRate = Math.max(MIN_MONTHLY_RATE, state.monthlyRate);

  const eirOf = (t: number, feePct: number, rate: number) =>
    buildSchedule(amount, t, frequency, disbursedDate, rate, feePct).eir;

  const current = eirOf(tenureMonths, state.feePct, monthlyRate);
  if (current >= targetEirPct || eirMatches(current, targetEirPct)) {
    return { tenureMonths, feePct: state.feePct, monthlyRate };
  }

  // The lever just edited is fixed; the other pricing lever may only rise
  // as far as its own ceiling (its real max, unless IT is the fixed one).
  const feeCeiling = changed === "fee" ? state.feePct : MAX_FEE_PCT;
  const rateCeiling = changed === "rate" ? monthlyRate : MAX_MONTHLY_RATE;

  if (changed !== "rate") {
    const solved = monthlyRateForTargetEir(
      amount,
      tenureMonths,
      frequency,
      disbursedDate,
      targetEirPct,
      state.feePct,
    );
    if (solved.reachable) {
      return {
        tenureMonths,
        feePct: state.feePct,
        monthlyRate: Math.max(solved.monthlyRate, monthlyRate),
      };
    }
  }

  if (changed !== "fee") {
    const solved = feePctForTargetEir(
      amount,
      tenureMonths,
      frequency,
      disbursedDate,
      targetEirPct,
      rateCeiling,
    );
    if (solved.reachable) {
      return {
        tenureMonths,
        feePct: Math.max(solved.feePct, state.feePct),
        monthlyRate: rateCeiling,
      };
    }
  }

  // Both pricing levers are pinned at their ceiling and it's still not
  // enough (e.g. biweekly right at max tenure) — shorten tenure until it is.
  for (let t = tenureMonths; t >= 1; t--) {
    const eir = eirOf(t, feeCeiling, rateCeiling);
    if (eir >= targetEirPct || eirMatches(eir, targetEirPct)) {
      return { tenureMonths: t, feePct: feeCeiling, monthlyRate: rateCeiling };
    }
  }

  // Last resort: the lever the staff fixed is so low that no tenure can
  // reach the floor even with the other lever maxed (e.g. a 1% fee typed
  // in directly). The floor is inviolable, so it wins over field
  // ownership here — solve with full latitude on both pricing levers at
  // the shortest, most forgiving tenure (guaranteed reachable for any
  // tenure within range, since the grade's ref EIR is calibrated at
  // standard pricing).
  for (let t = 1; t <= tenureMonths; t++) {
    const solved = feePctForTargetEir(amount, t, frequency, disbursedDate, targetEirPct, MAX_MONTHLY_RATE);
    if (solved.reachable) {
      return { tenureMonths: t, feePct: solved.feePct, monthlyRate: MAX_MONTHLY_RATE };
    }
  }

  return { tenureMonths: 1, feePct: MAX_FEE_PCT, monthlyRate: MAX_MONTHLY_RATE };
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCurrencyWhole(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function frequencyLabel(frequency: Frequency): string {
  switch (frequency) {
    case "monthly":
      return "monthly";
    case "biweekly":
      return "biweekly";
    case "payday":
      return "payday";
  }
}

/** Plural label for payments, e.g. "3 monthly payments" */
export function paymentCountLabel(count: number, frequency: Frequency): string {
  const unit =
    frequency === "payday"
      ? "payment"
      : frequency === "biweekly"
        ? count === 1
          ? "biweekly payment"
          : "biweekly payments"
        : count === 1
          ? "monthly payment"
          : "monthly payments";
  return `${count} ${unit}`;
}
