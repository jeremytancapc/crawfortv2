"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import type { LoanFormData } from "@/lib/loan-form";
import { LoanResults } from "@/app/loan-results";
import { MobileHeader } from "@/app/mobile-header";

interface Props {
  formData: LoanFormData;
}

export function ApprovalView({ formData }: Props) {
  const router = useRouter();

  // Show the approved amount (not the requested amount) in the results screen.
  const displayData = { ...formData, amount: formData.approvedLoanAmount };

  return (
    <div className="approval-theme flex flex-col lg:flex-row min-h-dvh">
      {/* Sidebar */}
      <aside className="relative hidden lg:flex lg:w-[42%] xl:w-[38%] flex-col justify-between overflow-hidden bg-brand-blue p-12 xl:p-16">
        <div className="relative z-10">
          <div className="mb-16">
            <Image
              src="/images/cf-money-white.png"
              alt="CF Money"
              width={160}
              height={48}
              className="h-6 w-auto"
              priority
            />
          </div>
          <h1 className="font-display text-4xl xl:text-5xl font-extrabold leading-[1.08] tracking-[-0.04em] text-[var(--text-on-brand)] max-w-[420px]">
            Your loan offer is confirmed.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[var(--text-on-brand)] opacity-75 max-w-[380px]">
            Choose the repayment plan that works best for you, then book an appointment to collect your funds.
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-col flex-1 overflow-x-clip">
        <MobileHeader />

        <div className="flex flex-col items-center justify-start px-5 pb-8 pt-6 sm:px-8 flex-1 lg:justify-center lg:px-12 lg:pt-10 lg:pb-10 xl:px-20">
          <div className="w-full max-w-[520px]">
            <LoanResults
              formData={displayData}
              creditLimit={formData.amount}
              monthlyRepayment={0}
              onAccept={() => router.push("/apply/accept")}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
