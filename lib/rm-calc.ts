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
}

export const GRADE_CONFIG: Record<Grade, GradeInfo> = {
  S: { maxTenureMonths: 15, refEirPct: 65.5 },
  A: { maxTenureMonths: 12, refEirPct: 69.3 },
  B: { maxTenureMonths: 10, refEirPct: 73.0 },
  C: { maxTenureMonths: 5, refEirPct: 93.4 },
  D: { maxTenureMonths: 3, refEirPct: 116.0 },
};

export const GRADES: Grade[] = ["S", "A", "B", "C", "D"];
export const MONTHLY_RATE = 0.0392;
export const DEFAULT_FEE_PCT = 10;
export const MIN_LOAN_AMOUNT = 500;
/** Hard ceiling for staff-entered max approved amount. */
export const MAX_APPROVED_CAP = 200_000;
export const DEFAULT_MAX_APPROVED = 80_000;
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

  // Standard amortized instalment, rounded up to the nearest cent
  const rawInstalment = (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
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

  const rawInstalment = (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
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
