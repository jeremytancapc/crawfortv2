/**
 * What to tell an applicant who has just had their income read, so they know
 * how to strengthen it - and that they are free to carry on without.
 *
 * Driven by the incomeType the reader settled on, because that is what Ascend
 * scores: payslips alone are taken on trust (NON_PANEL), the same payslips
 * with a bank statement showing the pay arriving are confirmed (PANEL), and a
 * bank statement alone counts money in, not salary. Worded as "can", never
 * "will": Ascend decides the limit, and a promise here would be ours to break.
 */

export type IncomeTip = { title: string; body: string };

/** The incomeType a bank statement is sent as, beside payslips or alone. */
const BANK_STATEMENT = "BANK_STATEMENT_OTHER_INCOME";

export function improveLimitTips(incomeType: string, fileTypes: string[] = []): IncomeTip[] {
  switch (incomeType) {
    case "NON_PANEL_PAYSLIP":
      // A bank statement was uploaded but did not show the pay arriving, so
      // the payslips stayed unconfirmed. Telling them to add one would be
      // telling them to do what they have already done.
      if (fileTypes.includes(BANK_STATEMENT)) {
        return [
          {
            title: "We could not match your pay to your bank statement",
            body: "Check the statement covers the same months as your payslips and shows your pay arriving. Income we can confirm can increase your credit limit.",
          },
        ];
      }
      return [
        {
          title: "Confirm your payslips",
          body: "Add a bank statement showing your pay arriving. Income we can confirm can increase your credit limit.",
        },
      ];
    case BANK_STATEMENT:
      return [
        {
          title: "Add your payslips",
          body: "If you have payslips, add them. A payslip together with your bank statement can increase your credit limit.",
        },
      ];
    default:
      return [];
  }
}
