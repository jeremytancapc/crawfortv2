import type {
  EligibilityTag,
  EmploymentTag,
  ForeignerDocTag,
  IncomeDocTag,
  LeadTags,
  OutstandingTag,
  ResidencyTag,
} from "./types";

export const RESIDENCY_OPTIONS: { id: ResidencyTag; label: string }[] = [
  { id: "sg-pr", label: "SG/PR" },
  { id: "foreigner", label: "Foreigner" },
];

export const EMPLOYMENT_OPTIONS: { id: EmploymentTag; label: string; shortLabel?: string }[] = [
  { id: "employed", label: "Employed" },
  { id: "self-employed", label: "Self-employed", shortLabel: "Self-emp" },
];

export const ELIGIBILITY_OPTIONS: { id: EligibilityTag; label: string; className: string }[] = [
  { id: "ascend-approved", label: "Ascend Approved", className: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300" },
  { id: "ascend-pending-docs", label: "Ascend Pending Docs", className: "bg-amber-100 text-amber-800 ring-1 ring-amber-300" },
  { id: "h5-approved-with-appt", label: "H5 Approved with Appt", className: "bg-teal-100 text-teal-800 ring-1 ring-teal-300" },
  { id: "h5-approved-without-appt", label: "H5 Approved without Appt", className: "bg-sky-100 text-sky-800 ring-1 ring-sky-300" },
  { id: "h5-system-rejected", label: "H5 System Rejected (Zero Loan Cap)", className: "bg-red-100 text-red-800 ring-1 ring-red-300" },
  { id: "h5-customer-reject", label: "H5 Customer Reject", className: "bg-orange-100 text-orange-800 ring-1 ring-orange-300" },
  { id: "h5-customer-never-completed", label: "H5 Customer Never Completed", className: "bg-violet-100 text-violet-800 ring-1 ring-violet-300" },
];

export const INCOME_DOC_OPTIONS: { id: IncomeDocTag; label: string; shortLabel?: string; title?: string }[] = [
  { id: "cpf", label: "CPF" },
  { id: "noa", label: "NOA" },
  { id: "payslip", label: "Payslip" },
  { id: "bank-statement", label: "Bank Statement", shortLabel: "Bank stmt", title: "Bank Statement" },
];

export const FOREIGNER_DOC_OPTIONS: { id: ForeignerDocTag; label: string; title?: string }[] = [
  { id: "por", label: "POR", title: "Proof of Residence" },
  { id: "wp-over-3m", label: "WP > 3M", title: "Work Permit valid for more than 3 months" },
];

export function emptyLeadTags(): LeadTags {
  return {
    residency: null,
    employment: null,
    incomeDocs: [],
    foreignerDocs: [],
    outstanding: null,
    monthlyIncome: null,
  };
}

export function toggleExclusive<T>(current: T | null, next: T): T | null {
  return current === next ? null : next;
}

function toggleInList<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

export function toggleIncomeDoc(docs: IncomeDocTag[], doc: IncomeDocTag): IncomeDocTag[] {
  return toggleInList(docs, doc);
}

export function toggleForeignerDoc(docs: ForeignerDocTag[], doc: ForeignerDocTag): ForeignerDocTag[] {
  return toggleInList(docs, doc);
}

/** Normalise free-typed outstanding amounts to the CRM's 5K-style labels when possible. */
export function formatOutstandingLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const compact = trimmed.replace(/[$,\s]/g, "");
  const kMatch = compact.match(/^(\d+(?:\.\d+)?)k$/i);
  if (kMatch) return `${kMatch[1]}K`;

  const numeric = Number(compact);
  if (Number.isFinite(numeric) && numeric >= 1000 && numeric % 1000 === 0) {
    return `${numeric / 1000}K`;
  }
  if (Number.isFinite(numeric)) return String(numeric);

  return trimmed;
}

export function outstandingAmountLabel(outstanding: OutstandingTag | null): string {
  return outstanding?.kind === "amount" ? outstanding.label : "";
}

/** Normalise a free-typed monthly income into a comma-grouped number, e.g. "4500" -> "4,500". */
export function formatMonthlyIncomeLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const digits = trimmed.replace(/[^0-9.]/g, "");
  const numeric = Number(digits);
  if (!digits || !Number.isFinite(numeric)) return trimmed;

  return numeric.toLocaleString("en-SG");
}

export function selectedTagLabels(tags: LeadTags): string[] {
  const labels: string[] = [];
  const residency = RESIDENCY_OPTIONS.find((option) => option.id === tags.residency);
  const employment = EMPLOYMENT_OPTIONS.find((option) => option.id === tags.employment);

  if (residency) labels.push(residency.label);
  if (employment) labels.push(employment.label);
  if (tags.monthlyIncome) labels.push(`Income $${tags.monthlyIncome}/mo`);

  INCOME_DOC_OPTIONS.forEach((option) => {
    if (tags.incomeDocs.includes(option.id)) labels.push(option.title ?? option.label);
  });

  FOREIGNER_DOC_OPTIONS.forEach((option) => {
    if (tags.foreignerDocs.includes(option.id)) labels.push(option.title ?? option.label);
  });

  if (tags.outstanding?.kind === "none") labels.push("No OS");
  if (tags.outstanding?.kind === "amount") labels.push(`OS ${tags.outstanding.label}`);

  return labels;
}
