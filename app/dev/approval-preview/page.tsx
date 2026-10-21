import { notFound } from "next/navigation";

import { ApprovalView } from "@/app/apply/approval/approval-view";
import { initialLoanFormData, type LoanFormData } from "@/lib/loan-form";
import { parseWithdrawAmountParam } from "@/lib/withdraw-amount";

export const dynamic = "force-dynamic";

const previewFormData: LoanFormData = {
  ...initialLoanFormData,
  amount: 8000,
  tenure: 12,
  monthlyIncome: "4210",
  approvedLoanAmount: 8000,
  verifiedMonthlyIncome: 4210,
  incomeSource: "cpf",
};

interface PageProps {
  searchParams: Promise<{ phase?: string | string[]; amount?: string | string[] }>;
}

export default async function ApprovalPreviewPage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const phase = params.phase === "plan" ? "plan" : "amount";
  const initialWithdrawAmount =
    phase === "plan"
      ? parseWithdrawAmountParam(params.amount, previewFormData.approvedLoanAmount) ?? undefined
      : undefined;

  return (
    <ApprovalView
      formData={previewFormData}
      limits={{ aCardLimit: 8000, maximumLoanQuantum: 20000 }}
      phase={phase}
      initialWithdrawAmount={initialWithdrawAmount}
      previewMode
    />
  );
}
