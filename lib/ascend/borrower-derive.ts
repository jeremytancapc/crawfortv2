/**
 * The three borrowerMyInfo fields we work out rather than ask for.
 *
 * Ascend requires five. Two are genuinely the applicant's to declare -
 * employment type and bankruptcy - and asking for the other three would add
 * three more pickers, one of them 22 options long, to a form people already
 * abandon.
 *
 * Two of the three can be derived honestly:
 *
 *   employmentPeriod  CPF says how many consecutive months an employer has
 *                     been paying them. That is the answer, not an estimate.
 *   wokingPosition    MyInfo's occupation, matched against Ascend's list.
 *
 * The third cannot. MyInfo gives an employer's NAME and never its industry,
 * so jobCategory is Ascend's own documented catch-all rather than a guess at
 * a sector from a company name. Worth knowing when reading a decision: if
 * Ascend scores on industry, every applicant of ours looks the same to it.
 */

import {
  EMPLOYMENT_PERIOD_OPTIONS,
  WORKING_POSITION_OPTIONS,
  type BorrowerAnswers,
} from "./borrower-info";

type Derived = Pick<BorrowerAnswers, "employmentPeriod" | "wokingPosition" | "jobCategory">;

/** MyInfo wraps nearly every field as {value}. */
function valueOf(field: unknown): string {
  if (field && typeof field === "object" && "value" in field) {
    return String((field as { value: unknown }).value ?? "").trim();
  }
  return typeof field === "string" ? field.trim() : "";
}

/** Consecutive months at the most recent employer, from CPF. */
function monthsAtCurrentEmployer(cpfemployers: unknown): number {
  const history = (cpfemployers as { history?: unknown })?.history;
  if (!Array.isArray(history) || history.length === 0) return 0;

  const entries = history
    .map((row) => ({
      month: valueOf((row as { month?: unknown }).month),
      employer: valueOf((row as { employer?: unknown }).employer),
    }))
    .filter((row) => row.month && row.employer)
    .sort((a, b) => b.month.localeCompare(a.month));

  if (entries.length === 0) return 0;

  const current = entries[0].employer;
  const months = new Set<string>();
  for (const entry of entries) {
    // Stops at the first different employer: someone who changed jobs last
    // month has been there a month, however long the record runs.
    if (entry.employer !== current) break;
    months.add(entry.month);
  }
  return months.size;
}

function periodFor(months: number): BorrowerAnswers["employmentPeriod"] {
  if (months >= 120) return "10 YEARS AND ABOVE";
  if (months >= 96) return "8 - 10 YEARS";
  if (months >= 60) return "5 - 7 YEARS";
  if (months >= 36) return "3 - 4 YEARS";
  if (months >= 12) return "1-2 YEARS";
  if (months >= 10) return "10 - 12 MONTHS";
  if (months >= 8) return "8 - 9 MONTHS";
  if (months >= 6) return "6 - 7 MONTHS";
  if (months >= 2) {
    const exact = `${months} MONTHS` as (typeof EMPLOYMENT_PERIOD_OPTIONS)[number];
    return EMPLOYMENT_PERIOD_OPTIONS.includes(exact) ? exact : "6 - 7 MONTHS";
  }
  if (months === 1) return "1 MONTH";
  return "JUST START WORKING, LESS THAN A MONTH";
}

/**
 * Ascend's nine positions, matched loosely against a free-text occupation.
 * Ordered most specific first, so "ASSISTANT MANAGER" is not read as a
 * SENIOR MANAGER by an earlier, broader rule.
 */
const POSITION_RULES: Array<[RegExp, (typeof WORKING_POSITION_OPTIONS)[number]]> = [
  [/\b(DIRECTOR|GENERAL MANAGER|\bGM\b|CEO|CFO|COO|MANAGING)\b/, "DIRECTOR / GM"],
  [/\b(ASSISTANT MANAGER|ASST MANAGER|DEPUTY MANAGER)\b/, "MANAGER / ASSISTANT MANAGER"],
  [/\bSENIOR MANAGER\b/, "SENIOR MANAGER"],
  [/\bMANAGER\b/, "MANAGER / ASSISTANT MANAGER"],
  [/\bSUPERVISOR\b/, "SUPERVISOR"],
  [/\bSENIOR EXECUTIVE\b/, "SENIOR EXECUTIVE"],
  [/\b(JUNIOR EXECUTIVE|EXECUTIVE)\b/, "JUNIOR EXECUTIVE"],
  [
    /\b(CONSULTANT|ENGINEER|DOCTOR|LAWYER|ACCOUNTANT|ARCHITECT|ANALYST|SPECIALIST|PHARMACIST|SURVEYOR|TEACHER|NURSE)\b/,
    "PROFESSIONAL",
  ],
  [/\bNON.?EXECUTIVE\b/, "NON-EXECUTIVE"],
];

function positionFor(occupation: string): BorrowerAnswers["wokingPosition"] {
  const text = occupation.toUpperCase();
  for (const [pattern, position] of POSITION_RULES) {
    if (pattern.test(text)) return position;
  }
  // Honestly unknown. Guessing a seniority from a word that looked senior
  // would put a fact nobody established into a credit decision.
  return "OTHERS";
}

export function deriveBorrowerFields(person: Record<string, unknown>): Derived {
  return {
    employmentPeriod: periodFor(monthsAtCurrentEmployer(person.cpfemployers)),
    wokingPosition: positionFor(valueOf(person.occupation)),
    jobCategory: "ACTIVITIES NOT ADEQUATELY DEFINED",
  };
}
