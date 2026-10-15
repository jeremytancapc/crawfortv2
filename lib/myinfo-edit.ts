/**
 * Editing CPF and NOA on a staging application.
 *
 * Testers need to try an applicant with different figures than the Singpass
 * sandbox hands out, without finding a persona that has them. This writes
 * their figures into the retrieved record in exactly the shape Singpass uses,
 * so what Ascend receives and what our own parser reads are the same thing.
 *
 * Nothing here is reached in production: the route that uses it is switched on
 * per deployment by MYINFO_EDITOR_ENABLED.
 */

import { buildMyInfoPatch, myinfoPersonData } from "./myinfo";
import type { CpfContribution, NoaRecord } from "./loan-form";

export type CpfRow = { month: string; amount: number; employer: string };

export type NoaRow = {
  yearOfAssessment: string;
  employmentIncome: number;
  tradeIncome: number;
  rentIncome: number;
  interestIncome: number;
};

export const MAX_CPF_ROWS = 24;
export const MAX_NOA_ROWS = 6;

// ── Defaults, so there is always something sensible to start from ─────────

/** "2026-09", n months before `today`'s month (0 is this month). */
function monthBefore(today: Date, n: number): string {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - n, 1)).toISOString().slice(0, 7);
}

/** A year of CPF at $2,516 a month, most recent first, ending last month. */
export function defaultCpfRows(today: Date = new Date()): CpfRow[] {
  return generateCpfRows({
    latestMonth: monthBefore(today, 1),
    months: 12,
    amount: 2516,
    employer: "TEST EMPLOYER PTE LTD",
  });
}

/** The last two years of assessment, most recent first. */
export function defaultNoaRows(today: Date = new Date()): NoaRow[] {
  const year = today.getUTCFullYear();
  return [
    { yearOfAssessment: String(year - 1), employmentIncome: 96000, tradeIncome: 0, rentIncome: 0, interestIncome: 0 },
    { yearOfAssessment: String(year - 2), employmentIncome: 84000, tradeIncome: 0, rentIncome: 0, interestIncome: 0 },
  ];
}

/** `months` of the same contribution, counting back from `latestMonth`. */
export function generateCpfRows(args: {
  latestMonth: string;
  months: number;
  amount: number;
  employer: string;
}): CpfRow[] {
  const [year, month] = args.latestMonth.split("-").map(Number);
  return Array.from({ length: args.months }, (_, i) => ({
    month: new Date(Date.UTC(year, month - 1 - i, 1)).toISOString().slice(0, 7),
    amount: args.amount,
    employer: args.employer,
  }));
}

// ── Checking what was typed ───────────────────────────────────────────────

export function validateCpfRows(rows: CpfRow[]): string[] {
  const errors: string[] = [];
  if (rows.length > MAX_CPF_ROWS) errors.push(`CPF can have at most ${MAX_CPF_ROWS} months.`);

  const seen = new Set<string>();
  for (const row of rows) {
    const match = /^(\d{4})-(\d{2})$/.exec(row.month);
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
      errors.push(`"${row.month}" is not a month (use YYYY-MM).`);
    } else if (seen.has(row.month)) {
      errors.push(`${row.month} is in the list twice.`);
    }
    seen.add(row.month);
    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      errors.push(`${row.month}: the amount must be more than 0.`);
    }
  }
  return errors;
}

export function validateNoaRows(rows: NoaRow[]): string[] {
  const errors: string[] = [];
  if (rows.length > MAX_NOA_ROWS) errors.push(`NOA can have at most ${MAX_NOA_ROWS} years.`);

  const seen = new Set<string>();
  for (const row of rows) {
    if (!/^\d{4}$/.test(row.yearOfAssessment)) {
      errors.push(`"${row.yearOfAssessment}" is not a year (use 4 digits).`);
    } else if (seen.has(row.yearOfAssessment)) {
      errors.push(`YA ${row.yearOfAssessment} is in the list twice.`);
    }
    seen.add(row.yearOfAssessment);

    for (const [label, value] of [
      ["employment", row.employmentIncome],
      ["trade", row.tradeIncome],
      ["rent", row.rentIncome],
      ["interest", row.interestIncome],
    ] as const) {
      if (!Number.isFinite(value) || value < 0) {
        errors.push(`YA ${row.yearOfAssessment}: ${label} income cannot be negative.`);
      }
    }
  }
  return errors;
}

// ── Writing it in Singpass's shape ────────────────────────────────────────

const day = (today: Date) => today.toISOString().slice(0, 10);

function cpfField(rows: CpfRow[], today: Date) {
  return {
    source: "1",
    classification: "C",
    lastupdated: day(today),
    history: rows.map((row) => ({
      month: { value: row.month },
      date: { value: `${row.month}-01` },
      amount: { value: row.amount },
      employer: { value: row.employer },
    })),
  };
}

function noaField(rows: NoaRow[], today: Date) {
  return {
    source: "1",
    classification: "C",
    lastupdated: day(today),
    noas: rows.map((row) => ({
      yearofassessment: { value: row.yearOfAssessment },
      category: { value: "ORIGINAL" },
      taxclearance: { value: "N" },
      employment: { value: row.employmentIncome },
      trade: { value: row.tradeIncome },
      rent: { value: row.rentIncome },
      interest: { value: row.interestIncome },
      // Assessable income is the sum of its parts, as on a real NOA.
      amount: { value: row.employmentIncome + row.tradeIncome + row.rentIncome + row.interestIncome },
    })),
  };
}

export type MyinfoEdits = { cpf?: CpfRow[]; noa?: NoaRow[] };

export type ProcessedMyinfo = {
  cpfContributions: CpfContribution[];
  noaHistory: NoaRecord[];
  dob: string;
};

/**
 * The retrieved record with the edits written in, plus the same figures as our
 * own mapped copy and the monthly NOA figure we keep beside it.
 *
 * Pure: the record given is not modified, and anything not named in `edits` is
 * left exactly as it was. The mapped copy is produced by the same parser the
 * application uses, so it cannot differ from what a fresh retrieval would give.
 */
export function applyMyinfoEdits(
  payload: Record<string, unknown>,
  edits: MyinfoEdits,
  today: Date = new Date(),
): { payload: Record<string, unknown>; processed: ProcessedMyinfo; monthlyIncomeNoa: number | null } {
  const next = structuredClone(payload);
  // Wherever the person's fields live - flat, or under person_info (FAPI 2.0).
  const person = myinfoPersonData(next);

  if (edits.cpf) person.cpfcontributions = cpfField(edits.cpf, today);
  if (edits.noa) person.noahistory = noaField(edits.noa, today);

  const patch = buildMyInfoPatch(next);
  const processed: ProcessedMyinfo = {
    cpfContributions: patch.cpfContributions ?? [],
    noaHistory: patch.noaHistory ?? [],
    dob: patch.dob ?? "",
  };
  const latest = processed.noaHistory[0];
  return {
    payload: next,
    processed,
    monthlyIncomeNoa: latest ? latest.employmentIncome / 12 : null,
  };
}
