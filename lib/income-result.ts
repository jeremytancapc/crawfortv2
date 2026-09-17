/**
 * What the income step should show, decided from the extraction response.
 *
 * The screen used to open with three figures - 4,280, 4,150, 4,200 against
 * "Grab Holdings Limited" - seeded as placeholders and replaced only when
 * reading succeeded. When it did not, those numbers stayed on a page titled
 * "Your income, confirmed. Read from the documents you uploaded." Reading
 * eighteen real payslips, sixteen would have landed there, because strictly
 * monthly means a single upload is not enough.
 *
 * Two of them were worse than cosmetic. Continue submits whatever is on
 * screen to Ascend, so a placeholder would have gone into a real credit
 * decision for someone who never earned it.
 *
 * Hence a closed union: the figures only exist on the branch where they were
 * actually read, so there is no shape in which the screen or the submit call
 * can reach a number nobody took off a payslip.
 */

import { monthParts } from "./income-extraction";

export type IncomeMonthView = {
  label: string;
  month: string;
  year: string;
  amount: number;
  employer: string;
};

export type IncomeResult =
  | { kind: "read"; months: IncomeMonthView[]; average: number }
  | { kind: "not_read"; ask: string };

export type ExtractResponse = {
  status?: string;
  months?: Array<{ month: string; amount: number; employer: string | null }>;
  reason?: string;
  error?: string;
};

/** Said to an applicant when nothing more specific came back. */
const GENERIC_ASK = "Please upload your last 3 monthly payslips.";

export function incomeResultFrom(response: ExtractResponse): IncomeResult {
  if (response.status === "usable" && response.months && response.months.length > 0) {
    const months = response.months.map((m) => ({
      ...monthParts(m.month),
      amount: m.amount,
      employer: m.employer || "",
    }));

    return {
      kind: "read",
      months,
      average: Math.round(
        months.reduce((sum, month) => sum + month.amount, 0) / months.length,
      ),
    };
  }

  // `reason` is written to be read by an applicant - it names the payslip that
  // would finish the application. A status like "needs_review" is not, so it
  // is never what gets shown.
  return { kind: "not_read", ask: response.reason || response.error || GENERIC_ASK };
}
