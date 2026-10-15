/**
 * Putting CPF back into a salary credit read off a bank statement.
 *
 * A payslip is scored on gross pay. A bank statement shows what reached the
 * account, which is gross less the employee's CPF - the same person would be
 * measured at about 80% of their pay depending on which document they had to
 * hand. CPF is still the applicant's money, so a salary deposit is taken back
 * up to the gross it came from.
 */

import { ageAt } from "@/lib/credit-score";

/** What an applicant needs for their CPF to be worked out. */
export type CpfProfile = {
  /** YYYY-MM-DD, from MyInfo. */
  dob: string;
  /** Only citizens and PRs pay CPF; a foreigner's salary arrives whole. */
  paysCpf: boolean;
};

/** Employee share of CPF, by age. Rates from 1 Jan 2026. */
const EMPLOYEE_RATES: Array<{ maxAge: number; rate: number }> = [
  { maxAge: 55, rate: 0.2 },
  { maxAge: 60, rate: 0.15 },
  { maxAge: 65, rate: 0.095 },
  { maxAge: 70, rate: 0.07 },
  { maxAge: Infinity, rate: 0.05 },
];

/**
 * CPF is only taken on wages up to this a month (ordinary wage ceiling, 1 Jan
 * 2026). Above it the deduction stops growing, so the gross is not simply the
 * deposit divided by what is left.
 */
const MONTHLY_WAGE_CEILING = 8000;

/**
 * The gross a take-home deposit came from, or the deposit itself when there
 * is no CPF to put back (no profile, a foreigner, an unusable date of birth).
 */
export function grossUpSalary(deposit: number, profile: CpfProfile | undefined, today = new Date()): number {
  if (!profile?.paysCpf || !Number.isFinite(deposit) || deposit <= 0) return deposit;

  const age = ageAt(profile.dob, today);
  if (!profile.dob || !(age > 15 && age < 120)) return deposit;

  const rate = EMPLOYEE_RATES.find((r) => age <= r.maxAge)?.rate ?? 0.05;
  const gross = deposit / (1 - rate);
  const grossed = gross > MONTHLY_WAGE_CEILING ? deposit + rate * MONTHLY_WAGE_CEILING : gross;
  return Math.round(grossed * 100) / 100;
}
