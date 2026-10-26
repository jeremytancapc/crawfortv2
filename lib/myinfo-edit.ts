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

/** Singapore NRIC / FIN: a letter, seven digits, a check letter. */
const NRIC_SHAPE = /^[STFGM]\d{7}[A-Z]$/;

/** The NRIC as it is stored: trimmed and upper case. */
export function normaliseNric(value: string): string {
  return value.trim().toUpperCase();
}

const NRIC_WEIGHTS = [2, 7, 6, 5, 4, 3, 2];
// Citizens and PRs (S, T) and foreigners (F, G) each have their own letter table.
const CHECK_LETTERS: Record<string, string> = { S: "JZIHGFEDCBA", T: "JZIHGFEDCBA", F: "XWUTRQPNMLK", G: "XWUTRQPNMLK" };

/**
 * The check letter for an ID number, by Modulus 11: the seven digits weighted
 * 2,7,6,5,4,3,2, plus 4 for a T or G, remainder after dividing by 11, looked up
 * in the table for that prefix. Ascend's credit bureau runs this check and
 * refuses a number that fails it.
 *
 * Only S, T, F and G are worked out; the newer M series is not (null).
 */
export function nricCheckLetter(prefix: string, digits: string): string | null {
  const table = CHECK_LETTERS[prefix.trim().toUpperCase()];
  if (!table || !/^\d{7}$/.test(digits)) return null;
  const p = prefix.trim().toUpperCase();
  const sum = [...digits].reduce((total, d, i) => total + Number(d) * NRIC_WEIGHTS[i], 0) + (p === "T" || p === "G" ? 4 : 0);
  return table[sum % 11];
}

/** A whole ID number from its prefix and seven digits, with the right check letter; null when it cannot be made. */
export function completeNric(prefix: string, digits: string): string | null {
  const letter = nricCheckLetter(prefix, digits);
  return letter ? `${prefix.trim().toUpperCase()}${digits}${letter}` : null;
}

export function validateNric(value: string): string[] {
  const nric = normaliseNric(value);
  if (!NRIC_SHAPE.test(nric)) {
    return [`"${value.trim()}" is not an NRIC or FIN (a letter, seven digits and a letter, like S1234567D).`];
  }
  const expected = nricCheckLetter(nric[0], nric.slice(1, 8));
  // The M series is not worked out here; its shape is all that is checked.
  if (expected && expected !== nric[8]) {
    return [`${nric}: the check letter should be ${expected} (this ID number fails the Modulus 11 check Ascend's credit bureau runs).`];
  }
  return [];
}

/**
 * The `sub` a person with this NRIC gets once edited.
 *
 * Ascend identifies people by `sub`, not by `uinfin`, so a new NRIC with the
 * old `sub` would be the original person to Ascend. A UUID derived from the
 * NRIC keeps the same NRIC the same person on every edit, and two NRICs apart.
 */
export function subForEditedNric(nric: string): string {
  const hex = hash128(`crawfort-myinfo-edit:${normaliseNric(nric)}`);
  return [hex.slice(0, 8), hex.slice(8, 12), `4${hex.slice(13, 16)}`, `a${hex.slice(17, 20)}`, hex.slice(20, 32)].join("-");
}

/**
 * A fixed 128 bits for a string, as 32 hex characters (cyrb128). Not for
 * secrecy - it only has to be the same every time and different per NRIC - and
 * written out here because this file is also loaded by the edit sheet in the
 * browser, which has no node:crypto.
 */
function hash128(text: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1, h2, h3, h4].map((n) => (n >>> 0).toString(16).padStart(8, "0")).join("");
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

export type MyinfoEdits = { cpf?: CpfRow[]; noa?: NoaRow[]; nric?: string };

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

  if (edits.nric !== undefined) {
    const nric = normaliseNric(edits.nric);
    const existing = person.uinfin;
    person.uinfin = { ...(existing && typeof existing === "object" ? existing : {}), value: nric };
    // `sub` sits beside the person in v5 and at the top in the flat shape - in
    // both cases on the payload itself.
    next.sub = subForEditedNric(nric);
  }

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
