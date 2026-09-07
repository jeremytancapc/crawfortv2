import type { LoanFormData } from "@/lib/loan-form";

/** 3× / 6× monthly income figures used on the post-approval offer pages. */
export function approvalOfferDisplay(formData: LoanFormData) {
  const monthlyIncome =
    parseInt(formData.monthlyIncome.replace(/,/g, ""), 10) ||
    Number(formData.verifiedMonthlyIncome) ||
    0;
  const withdrawToday =
    monthlyIncome > 0 ? monthlyIncome * 3 : formData.approvedLoanAmount;
  const creditLimit =
    monthlyIncome > 0 ? monthlyIncome * 6 : formData.approvedLoanAmount * 2;

  return {
    displayData: { ...formData, amount: withdrawToday },
    creditLimit,
    withdrawToday,
  };
}

export function formatOfferAmount(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
