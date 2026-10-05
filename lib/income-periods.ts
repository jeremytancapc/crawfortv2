/**
 * Turning the pay periods printed on payslips into calendar months.
 *
 * A payslip states a *period*, not a month. Monthly payslips happen to line
 * up; weekly, fortnightly and semi-monthly ones do not, and asking the model
 * to reconcile them was what blocked three of eighteen real applicants -
 * correctly, but at the cost of people who simply are not paid monthly.
 *
 * So the model reports what is printed and this module does the arithmetic.
 * That split is deliberate and is not only about accuracy: a licensed
 * moneylender has to be able to show *why* it lent against a figure. Summing
 * done here can be replayed from the stored periods and shown to a customer
 * or a regulator; summing done inside a model cannot.
 *
 * One rule covers every pay frequency - calendar months, apportioned by day,
 * gated on complete coverage:
 *
 *   - a whole-month period passes through untouched (`exact`),
 *   - periods wholly inside a month are summed (`exact`),
 *   - a period straddling month-end contributes in proportion to the days it
 *     lends each month,
 *   - a month is reported only when its days are *fully* covered, so partial
 *     uploads are never mistaken for a low income,
 *   - overlapping periods are refused outright, because an overlap counts a
 *     day's pay twice and pushes income up - the direction that costs an
 *     applicant money they cannot repay.
 */

export type PayPeriod = {
  employer: string | null;
  /** ISO date, the first day the period pays for. */
  start: string;
  /** ISO date, the last day the period pays for, inclusive. */
  end: string;
  /** Gross for this period alone - never year-to-date, never net. */
  gross: number;
  /** Take-home pay as printed, when the document shows it: what reaches the bank. */
  net?: number | null;
  /** From a platform's earnings statement, which pays out in many cash-outs. */
  platform?: boolean;
};

export type AssembledMonth = {
  /** YYYY-MM. */
  month: string;
  amount: number;
  employer: string | null;
  /** True when no apportionment was needed, so the figure appears on a payslip. */
  exact: boolean;
  /** How many pay periods contributed, for the audit trail. */
  periods: number;
};

export type IncompleteMonth = {
  month: string;
  daysCovered: number;
  daysInMonth: number;
  /** The date ranges with no payslip, so the applicant is asked for those. */
  missing: Array<{ from: string; to: string }>;
};

export type Assembly = {
  /** Fully covered months, most recent first. */
  months: AssembledMonth[];
  /** Months with some data but gaps - what to tell the applicant is missing. */
  incomplete: IncompleteMonth[];
  /** Months whose periods double-count days. */
  overlapping: string[];
};

const DAY_MS = 86_400_000;

/** Parses an ISO date as UTC midnight, or null if it is not one. */
function parseDay(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  // Date.parse accepts 2025-11-31 and rolls it into December; a payslip that
  // prints an impossible date has been misread, so reject rather than shift.
  return new Date(ms).toISOString().slice(0, 10) === iso ? ms : null;
}

function monthKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 7);
}

function daysInMonthOf(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthBounds(key: string): { first: number; last: number } {
  const [year, month] = key.split("-").map(Number);
  return {
    first: Date.UTC(year, month - 1, 1),
    last: Date.UTC(year, month - 1, daysInMonthOf(key)),
  };
}

/** Whole days from `from` to `to`, counting both ends. */
function inclusiveDays(from: number, to: number): number {
  return Math.round((to - from) / DAY_MS) + 1;
}

type Slice = {
  days: number;
  amount: number;
  employer: string | null;
  /** The employer as compared: "Sunrise Logistics Pte. Ltd." and "SUNRISE LOGISTICS PTE LTD" are one. */
  employerKey: string;
  whole: boolean;
  /** Inclusive day range within this month, for working out what is absent. */
  from: number;
  to: number;
};

/**
 * An employer name as compared, not as shown. Case, punctuation and the
 * company suffix vary between one payslip and the next from the same payroll,
 * and treating those as two employers would let a duplicate upload through as
 * a second job.
 */
function employerKey(employer: string | null): string {
  return (employer ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(PTELTD|PRIVATELIMITED|LTD|LIMITED|LLP|INC)$/, "");
}

function overlapsWithinAnEmployer(slices: Slice[]): boolean {
  const byEmployer = new Map<string, Slice[]>();
  for (const slice of slices) {
    byEmployer.set(slice.employerKey, [...(byEmployer.get(slice.employerKey) ?? []), slice]);
  }
  for (const own of byEmployer.values()) {
    const sorted = [...own].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].from <= sorted[i - 1].to) return true;
    }
  }

  // The same days and the same pay under two employer names is one payslip
  // whose employer was read two ways, not two jobs that pay to the cent.
  const fingerprints = new Set<string>();
  for (const slice of slices) {
    const print = `${slice.from}|${slice.to}|${slice.amount.toFixed(2)}`;
    if (fingerprints.has(print)) return true;
    fingerprints.add(print);
  }
  return false;
}

/** "A PTE LTD + B PTE LTD", each employer once, in the order they were read. */
function employersOf(slices: Slice[]): string | null {
  const seen = new Map<string, string>();
  for (const slice of slices) {
    if (slice.employer && !seen.has(slice.employerKey)) seen.set(slice.employerKey, slice.employer);
  }
  return seen.size > 0 ? [...seen.values()].join(" + ") : null;
}

export function assembleMonths(periods: PayPeriod[]): Assembly {
  const byMonth = new Map<string, Slice[]>();

  for (const period of periods) {
    const start = parseDay(period.start);
    const end = parseDay(period.end);
    if (start === null || end === null || end < start) continue;
    if (!Number.isFinite(period.gross) || period.gross <= 0) continue;

    const totalDays = inclusiveDays(start, end);

    // Walk the calendar months this period touches, giving each the share of
    // the gross that matches the days it lends.
    for (let cursor = start; cursor <= end; ) {
      const key = monthKey(cursor);
      const { first, last } = monthBounds(key);
      const overlapFrom = Math.max(cursor, first);
      const overlapTo = Math.min(end, last);
      const days = inclusiveDays(overlapFrom, overlapTo);

      const slices = byMonth.get(key) ?? [];
      slices.push({
        days,
        amount: (period.gross * days) / totalDays,
        employer: period.employer,
        employerKey: employerKey(period.employer),
        whole: days === totalDays,
        from: overlapFrom,
        to: overlapTo,
      });
      byMonth.set(key, slices);

      cursor = last + DAY_MS;
    }
  }

  const months: AssembledMonth[] = [];
  const incomplete: IncompleteMonth[] = [];
  const overlapping: string[] = [];

  for (const [month, slices] of byMonth) {
    const daysInMonth = daysInMonthOf(month);

    // An overlap is one employer paying for the same day twice - the same
    // payslip uploaded twice, or a fortnightly one beside a monthly one.
    // Two employers paying for the same day is two jobs, and both count.
    if (overlapsWithinAnEmployer(slices)) {
      overlapping.push(month);
      continue;
    }

    // Covered is covered by anyone: a job change on the 16th, or a second
    // job that started then, leaves no day of the month without pay.
    const missing = gapsIn(month, slices);
    if (missing.length > 0) {
      const gapDays = missing.reduce(
        (sum, gap) => sum + inclusiveDays(Date.parse(`${gap.from}T00:00:00Z`), Date.parse(`${gap.to}T00:00:00Z`)),
        0,
      );
      incomplete.push({ month, daysCovered: daysInMonth - gapDays, daysInMonth, missing });
      continue;
    }

    const amount = slices.reduce((sum, slice) => sum + slice.amount, 0);
    months.push({
      month,
      // Cents, not floating-point dust: 2690 + 1408 must read as 4098.
      amount: Math.round(amount * 100) / 100,
      employer: employersOf(slices),
      exact: slices.every((slice) => slice.whole),
      periods: slices.length,
    });
  }

  months.sort((a, b) => b.month.localeCompare(a.month));
  incomplete.sort((a, b) => b.month.localeCompare(a.month));
  overlapping.sort((a, b) => b.localeCompare(a));

  return { months, incomplete, overlapping };
}

/** The day ranges of `month` that no slice covers, earliest first. */
function gapsIn(month: string, slices: Slice[]): Array<{ from: string; to: string }> {
  const { first, last } = monthBounds(month);
  const covered = [...slices].sort((a, b) => a.from - b.from);

  const gaps: Array<{ from: string; to: string }> = [];
  let cursor = first;
  for (const slice of covered) {
    if (slice.from > cursor) {
      gaps.push({ from: isoDay(cursor), to: isoDay(slice.from - DAY_MS) });
    }
    cursor = Math.max(cursor, slice.to + DAY_MS);
  }
  if (cursor <= last) gaps.push({ from: isoDay(cursor), to: isoDay(last) });

  return gaps;
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function monthName(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-SG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * "September and October 2025", "August, September and October 2025".
 *
 * The year is printed once when every month shares it - "September 2025 and
 * October 2025" is how a form talks, not how a person does.
 */
function listMonths(keys: string[]): string {
  const sorted = [...keys].sort();
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return monthName(sorted[0]);

  const sameYear = sorted.every((key) => key.slice(0, 4) === sorted[0].slice(0, 4));
  const names = sorted.map((key, index) =>
    sameYear && index < sorted.length - 1 ? monthName(key).replace(/ \d{4}$/, "") : monthName(key),
  );
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-09" moved by `delta` months. */
function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7);
}

function thisMonth(today: Date): string {
  return today.toISOString().slice(0, 7);
}

/**
 * The months the latest document may be for, most recent first: this month,
 * last month, or the one before. In October that is October, September or
 * August - an August payslip is recent enough, and a September one is not
 * required.
 */
export function latestAllowed(today: Date): string[] {
  const now = thisMonth(today);
  return [0, -1, -2].map((delta) => shiftMonth(now, delta));
}

/** What the applicant uploaded. Ascend takes one kind per submission. */
export type IncomeSource = "payslip" | "bank_statement" | "earnings_statement";

const NOUN: Record<IncomeSource, string> = {
  payslip: "payslip",
  bank_statement: "bank statement",
  earnings_statement: "earnings statement",
};

/** "payslip" / "payslips", "bank statement" / "bank statements". */
function noun(source: IncomeSource, count = 1): string {
  return count === 1 ? NOUN[source] : `${NOUN[source]}s`;
}

/**
 * The months the upload screen names: last month or the one before, as the
 * latest, and the two before that. Spelled out here rather than taken from
 * the locale, which shortens September to "Sept" in en-SG.
 */
export function uploadWindowLabel(today: Date = new Date()): { long: string; short: string } {
  const [, last, before] = latestAllowed(today);
  const name = (key: string) => MONTH_LONG[Number(key.slice(5, 7)) - 1];
  return {
    long: `${name(last)} or ${name(before)}, and the 2 months before it`,
    short: `latest: ${name(last).slice(0, 3)} or ${name(before).slice(0, 3)}`,
  };
}

export type MonthPlan =
  /** Nothing can go to Ascend yet; `ask` says what would let it. */
  | { kind: "ask"; ask: string }
  | {
      kind: "ready";
      /** The latest month held and the two before it, oldest first. */
      window: string[];
      /** The window's months that were read, most recent first. */
      held: string[];
      /** The window's months not read, oldest first. */
      missing: string[];
      /** What would confirm the figure, when months are missing. Never blocks. */
      advice: string | null;
    };

/**
 * Which months an applicant's income is judged on.
 *
 * The latest month read decides it: it has to be this month, last month or
 * the month before, and the two months before it are asked for. One is enough
 * to go ahead - the applicant is told which months would confirm the figure,
 * not stopped for them.
 *
 * Anchoring on today rather than on whatever arrived still matters: a single
 * stale May payslip used to produce "please add your April 2026 payslip",
 * walking further into the past. A latest month older than allowed is asked
 * for again by name, never walked back from.
 *
 * Under a monthly-only policy a month assembled from weekly payslips does not
 * count, however completely they cover it.
 */
export function planIncomeMonths(
  assembly: Assembly,
  options?: { monthlyOnly?: boolean; today?: Date; source?: IncomeSource },
): MonthPlan {
  const monthlyOnly = options?.monthlyOnly ?? false;
  const source = options?.source ?? "payslip";
  const allowed = latestAllowed(options?.today ?? new Date());

  const usable = new Set(
    assembly.months.filter((m) => !monthlyOnly || m.exact).map((m) => m.month),
  );

  // The most recent allowed month that has *anything* in it decides what to
  // ask: a half-covered September is finished, not skipped for August.
  const touched = (month: string) =>
    usable.has(month) ||
    assembly.overlapping.includes(month) ||
    assembly.incomplete.some((i) => i.month === month) ||
    assembly.months.some((m) => m.month === month);
  // This month is still running, so a part of it is expected, not a gap:
  // it only counts once it is whole.
  const latest = allowed.find((month, i) => (i === 0 ? usable.has(month) : touched(month)));

  if (latest && !usable.has(latest)) {
    if (assembly.overlapping.includes(latest)) {
      return {
        kind: "ask",
        ask:
          `The ${noun(source, 2)} for ${monthName(latest)} cover some of the same days. ` +
          `Please upload one ${noun(source)} per pay period.`,
      };
    }
    const partial = assembly.incomplete.find((i) => i.month === latest);
    const gap = partial?.missing[0];
    if (partial && gap) {
      const from = new Date(`${gap.from}T00:00:00Z`).getUTCDate();
      const to = new Date(`${gap.to}T00:00:00Z`).getUTCDate();
      const span = from === to ? `${from}` : `${from} to ${to}`;
      return {
        kind: "ask",
        ask: `We have part of ${monthName(latest)}. Please add the ${noun(source)} covering ${span} ${monthName(latest)}.`,
      };
    }
    return {
      kind: "ask",
      ask:
        `We can only use a monthly ${noun(source)} for ${monthName(latest)}. ` +
        `Please upload the monthly ${noun(source)} for that period.`,
    };
  }

  if (!latest) {
    const [, last, before] = allowed;
    return {
      kind: "ask",
      ask: `Please upload your latest ${noun(source)} - for ${monthName(last).replace(/ \d{4}$/, "")} or ${monthName(before)}.`,
    };
  }

  const window = [shiftMonth(latest, -2), shiftMonth(latest, -1), latest];
  const held = window.filter((m) => usable.has(m)).reverse();
  const missing = window.filter((m) => !usable.has(m));

  return {
    kind: "ready",
    window,
    held,
    missing,
    advice:
      missing.length === 0
        ? null
        : `We'll go with your ${listMonths(held)} ${noun(source, held.length)}. Adding your ` +
          `${listMonths(missing)} ${noun(source, missing.length)} helps us confirm your income.`,
  };
}

// ── Bank statements ───────────────────────────────────────────────────────

export type StatementPeriod = {
  /** ISO date, the first day the statement covers. */
  start: string;
  /** ISO date, the last day it covers, inclusive. */
  end: string;
};

export type IncomeCredit = {
  /** ISO date the money arrived. */
  date: string;
  amount: number;
  payer: string | null;
};

/** A year of statements is far more than anyone uploads; past it, a date was misread. */
const MAX_STATEMENT_DAYS = 400;

/**
 * Turns bank statements into months of income, as pay periods.
 *
 * A bank credit lands on one day, so unlike pay it is never apportioned: a
 * month's income is the income credits dated inside it. That figure only
 * means something when the statements cover the whole month - a statement
 * running 15 July to 14 August holds half of each - so a month counts once
 * the statements between them cover every day of it, and not before.
 *
 * Which credits are income is decided upstream, when the statement is read;
 * this only does the sums. The same credit reported twice - one statement
 * uploaded twice - is counted once: the direction that errs is towards less
 * income, never more.
 *
 * `withoutIncome` names whole months that arrived with no income in them.
 * They cannot become pay periods (a period of zero is a misread payslip), and
 * leaving them out would ask the applicant for a statement they had already
 * given.
 */
export function bankStatementMonths(
  statements: StatementPeriod[],
  credits: IncomeCredit[],
): { periods: PayPeriod[]; withoutIncome: string[] } {
  const covered = new Set<string>();
  for (const statement of statements) {
    const start = parseDay(statement.start);
    const end = parseDay(statement.end);
    if (start === null || end === null || end < start) continue;
    if (inclusiveDays(start, end) > MAX_STATEMENT_DAYS) continue;
    for (let day = start; day <= end; day += DAY_MS) covered.add(isoDay(day));
  }

  const byMonth = new Map<string, Map<string, number>>();
  const seen = new Set<string>();
  for (const credit of credits) {
    if (!covered.has(credit.date)) continue;
    if (!Number.isFinite(credit.amount) || credit.amount <= 0) continue;
    const key = `${credit.date}|${credit.amount}|${credit.payer ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const month = credit.date.slice(0, 7);
    const payers = byMonth.get(month) ?? new Map<string, number>();
    const payer = credit.payer ?? "";
    payers.set(payer, (payers.get(payer) ?? 0) + credit.amount);
    byMonth.set(month, payers);
  }

  const months = [...new Set([...covered].map((day) => day.slice(0, 7)))].sort().reverse();
  const periods: PayPeriod[] = [];
  const withoutIncome: string[] = [];

  for (const month of months) {
    const { first, last } = monthBounds(month);
    let whole = true;
    for (let day = first; day <= last; day += DAY_MS) {
      if (!covered.has(isoDay(day))) {
        whole = false;
        break;
      }
    }
    if (!whole) continue;

    const payers = byMonth.get(month);
    if (!payers) {
      withoutIncome.push(month);
      continue;
    }

    const gross = Math.round([...payers.values()].reduce((sum, a) => sum + a, 0) * 100) / 100;
    const [employer] = [...payers.entries()].sort((a, b) => b[1] - a[1])[0];
    periods.push({ start: isoDay(first), end: isoDay(last), gross, employer: employer || null });
  }

  return { periods, withoutIncome };
}

/** How close a bank credit has to be to a payslip's take-home pay, in dollars. */
const PAY_MATCH_TOLERANCE = 1;

/** Pay for a month often lands in the first days of the next. */
const PAY_LANDS_WITHIN_DAYS = 20;

/**
 * A platform pays out weekly or on demand, so its earnings arrive as many
 * credits that never sum to the cent: the last week's cash-out lands after
 * the statement closes, an earlier one before it opens. Payouts from the
 * platform dated in the period or the week after, within 10% of its
 * earnings, are taken as the earnings arriving.
 */
const PLATFORM_PAYOUT_TOLERANCE = 0.1;
const PLATFORM_PAYOUT_TRAILING_DAYS = 7;

/** True when a credit's payer is the platform: its first real word appears in it. */
function paidBy(payer: string | null, platform: string | null): boolean {
  const name = (platform ?? "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .find((word) => word.length >= 3 && !["THE", "PTE", "LTD"].includes(word));
  if (!name || !payer) return false;
  return payer.toUpperCase().split(/[^A-Z0-9]+/).includes(name);
}

/**
 * True when every payslip for `months` can be seen arriving in the bank: a
 * credit within a dollar of its take-home pay, dated from the start of its
 * period to three weeks after it ends. Each credit pays one payslip only.
 *
 * Take-home, not gross - the bank receives pay after CPF, so it is the net
 * line that should appear there. A payslip that prints no net cannot be
 * matched, and one month unmatched means none of it is confirmed.
 *
 * A platform's earnings may instead arrive as several cash-outs; see
 * PLATFORM_PAYOUT_TOLERANCE.
 */
export function paidIntoBank(periods: PayPeriod[], credits: IncomeCredit[], months: string[]): boolean {
  const owed = periods.filter((p) => months.includes(p.start.slice(0, 7)));
  if (owed.length === 0) return false;

  const unused = [...credits];
  for (const period of owed) {
    const net = period.net ?? 0;
    const from = parseDay(period.start);
    const end = parseDay(period.end);
    if (net <= 0 || from === null || end === null) return false;
    const until = end + PAY_LANDS_WITHIN_DAYS * DAY_MS;

    const at = unused.findIndex((credit) => {
      const day = parseDay(credit.date);
      return (
        day !== null && day >= from && day <= until &&
        Math.abs(credit.amount - net) <= PAY_MATCH_TOLERANCE
      );
    });
    if (at !== -1) {
      unused.splice(at, 1);
      continue;
    }

    if (!period.platform) return false;
    const payoutsUntil = end + PLATFORM_PAYOUT_TRAILING_DAYS * DAY_MS;
    const payouts = unused.filter((credit) => {
      const day = parseDay(credit.date);
      return day !== null && day >= from && day <= payoutsUntil && paidBy(credit.payer, period.employer);
    });
    const total = payouts.reduce((sum, credit) => sum + credit.amount, 0);
    if (Math.abs(total - net) > net * PLATFORM_PAYOUT_TOLERANCE) return false;
    for (const payout of payouts) unused.splice(unused.indexOf(payout), 1);
  }
  return true;
}
