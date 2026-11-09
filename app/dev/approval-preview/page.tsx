import { notFound } from "next/navigation";

import { ApprovalView } from "@/app/apply/approval/approval-view";
import { initialLoanFormData, type LoanFormData } from "@/lib/loan-form";
import { parseWithdrawAmountParam } from "@/lib/withdraw-amount";

export const dynamic = "force-dynamic";

/** Demo figures: Ascend approves S$3,500 today against an MLCB Maximum Loan
 *  Quantum of S$8,000 - the dial runs to S$8,000 and stops at S$3,500. */
const DEMO_APPROVED_TODAY = 3500;
const DEMO_MAXIMUM_LOAN_QUANTUM = 8000;

const previewFormData: LoanFormData = {
  ...initialLoanFormData,
  amount: DEMO_APPROVED_TODAY,
  tenure: 12,
  monthlyIncome: "4210",
  approvedLoanAmount: DEMO_APPROVED_TODAY,
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
      limits={{
        aCardLimit: DEMO_APPROVED_TODAY,
        maximumLoanQuantum: DEMO_MAXIMUM_LOAN_QUANTUM,
      }}
      phase={phase}
      initialWithdrawAmount={initialWithdrawAmount}
      previewMode
    />
  );
}
