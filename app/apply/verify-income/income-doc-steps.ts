/**
 * Income verification is split by how the applicant earns: payslips, bank
 * statements, or - with no documents at all - a signed self-declaration. Every
 * step can be skipped, so an applicant with only a bank statement skips the
 * payslip step and lands on the one that fits them.
 */
export type IncomeDocStep = 1 | 2 | 3;

export const INCOME_DOC_STEP_COUNT = 3;

export type IncomeDocStepConfig = {
  id: "payslip" | "bank" | "declare";
  title: string;
  subtitle: string;
  /**
   * Optional note above the title that says why the step exists. The title
   * stays the instruction; this is the reason for it.
   */
  notice?: string;
  /** Label of the link that skips this step. */
  skipLabel: string;
};

export const INCOME_DOC_STEPS: Record<IncomeDocStep, IncomeDocStepConfig> = {
  1: {
    id: "payslip",
    notice: "No CPF/NOA detected",
    title: "Upload your income documents manually",
    subtitle: "Payslips for full-time employees, or monthly statements for PHV drivers.",
    skipLabel: "I do not have any payslips or income documents, skip this step",
  },
  2: {
    id: "bank",
    title: "Upload your Bank statements",
    subtitle: "For freelancers, self-employed and all other employment types.",
    skipLabel: "I do not have any bank statements, skip this step",
  },
  3: {
    id: "declare",
    title: "Declare your income",
    subtitle: "Tell us what you earn each month and sign to confirm it.",
    skipLabel: "I do not want to declare my income, skip this step",
  },
};

/** Reads a `?step=` value, falling back to the first step for anything unexpected. */
export function parseIncomeDocStep(
  value: string | string[] | null | undefined,
): IncomeDocStep {
  const raw = Array.isArray(value) ? value[0] : value;
  const step = Number(raw);
  return step === 2 || step === 3 ? step : 1;
}

/** Where the Confirm your income page got its figures. */
export type IncomeSource = "documents" | "declared";

export function parseIncomeSource(
  value: string | string[] | null | undefined,
): IncomeSource {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "declared" ? "declared" : "documents";
}
