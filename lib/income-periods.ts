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
  whole: boolean;
  /** Inclusive day range within this month, for working out what is absent. */
  from: number;
  to: number;
};

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
    const daysCovered = slices.reduce((sum, slice) => sum + slice.days, 0);

    if (daysCovered > daysInMonth) {
      overlapping.push(month);
      continue;
    }
    if (daysCovered < daysInMonth) {
      incomplete.push({ month, daysCovered, daysInMonth, missing: gapsIn(month, slices) });
      continue;
    }

    const amount = slices.reduce((sum, slice) => sum + slice.amount, 0);
    months.push({
      month,
      // Cents, not floating-point dust: 2690 + 1408 must read as 4098.
      amount: Math.round(amount * 100) / 100,
      employer: slices.find((slice) => slice.employer)?.employer ?? null,
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

/**
 * The two windows an applicant can prove income with: the three complete
 * calendar months before this one - what the upload screen names - or the
 * three ending with this month, for someone already paid for it.
 *
 * Only the first used to count, so on 28 September an applicant holding
 * September, August and July payslips was told to find June: a document older
 * than the one they already had, for a decision that is better made on the
 * newer one.
 *
 * Anchoring on today rather than on whatever arrived is still the point. A
 * single stale May payslip used to produce "please add your April 2026
 * payslip" - walking further into the past, away from the months the screen
 * had already named, and asking for a document no decision needs.
 */
function candidateWindows(today: Date): { named: string[]; latest: string[] } {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const window = (backs: number[]) =>
    backs.map((back) => new Date(Date.UTC(year, month - back, 1)).toISOString().slice(0, 7));
  return { named: window([3, 2, 1]), latest: window([2, 1, 0]) };
}

function monthsHeld(assembly: Assembly, window: string[], monthlyOnly: boolean): string[] {
  return assembly.months
    .filter((m) => window.includes(m.month) && (!monthlyOnly || m.exact))
    .map((m) => m.month);
}

/**
 * The three months this applicant's income is judged on, oldest first.
 *
 * Whichever window the documents come closer to filling. A tie goes to the
 * months the screen named, so the applicant is never asked for something the
 * page did not mention.
 */
export function incomeWindow(
  assembly: Assembly,
  options?: { monthlyOnly?: boolean; today?: Date },
): string[] {
  const monthlyOnly = options?.monthlyOnly ?? false;
  const { named, latest } = candidateWindows(options?.today ?? new Date());
  return monthsHeld(assembly, latest, monthlyOnly).length >
    monthsHeld(assembly, named, monthlyOnly).length
    ? latest
    : named;
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

export function nextUploadAsk(
  assembly: Assembly,
  options?: { monthlyOnly?: boolean; today?: Date; source?: IncomeSource },
): string | null {
  const monthlyOnly = options?.monthlyOnly ?? false;
  const source = options?.source ?? "payslip";
  const wanted = incomeWindow(assembly, options);

  if (assembly.overlapping.some((m) => wanted.includes(m))) {
    return (
      `The ${noun(source, 2)} for ${listMonths(assembly.overlapping.filter((m) => wanted.includes(m)))} ` +
      `cover some of the same days. Please upload one ${noun(source)} per pay period.`
    );
  }

  // Under a monthly-only policy an apportioned month is not underwritable,
  // however completely the weekly payslips cover it.
  const apportioned = assembly.months.filter((m) => !m.exact && wanted.includes(m.month));
  if (monthlyOnly && apportioned.length > 0) {
    return (
      `We can only use a monthly ${noun(source)} for ${listMonths(apportioned.map((m) => m.month))}. ` +
      `Please upload the monthly ${noun(source)} for that period.`
    );
  }

  // Only the months being asked for count. A complete May sitting next to a
  // wanted June is still not one of the three, and must not be treated as
  // progress towards them.
  const have = monthsHeld(assembly, wanted, monthlyOnly);
  const missing = wanted.filter((m) => !have.includes(m));

  if (missing.length === 0) return null;

  // A half-covered month inside the window is the cheapest thing to finish,
  // so ask for the rest of it before asking for a whole other month.
  const partial = assembly.incomplete.find((i) => wanted.includes(i.month));
  const gap = partial?.missing[0];
  if (partial && gap) {
    const from = new Date(`${gap.from}T00:00:00Z`).getUTCDate();
    const to = new Date(`${gap.to}T00:00:00Z`).getUTCDate();
    const span = from === to ? `${from}` : `${from} to ${to}`;
    return `We have part of ${monthName(partial.month)}. Please add the ${noun(source)} covering ${span} ${monthName(partial.month)}.`;
  }

  if (have.length === 0) {
    return `Please upload your ${noun(source, 2)} for ${listMonths(missing)}.`;
  }

  return `We have ${listMonths(have)}. Please add your ${
    missing.length === 1
      ? `${monthName(missing[0])} ${noun(source)}`
      : `${listMonths(missing)} ${noun(source, 2)}`
  }.`;
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
