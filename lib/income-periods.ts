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

type Slice = { days: number; amount: number; employer: string | null; whole: boolean };

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
      incomplete.push({ month, daysCovered, daysInMonth });
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
