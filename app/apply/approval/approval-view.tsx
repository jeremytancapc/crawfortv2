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

  // Demo-only figures: derive the offer straight from the self-declared monthly
  // income captured at step 2/8, rather than the real underwriting output.
  const monthlyIncome = parseInt(formData.monthlyIncome, 10) || 0;
  const withdrawToday = monthlyIncome * 3;
  const maxCreditLimit = monthlyIncome * 6;

  const displayData = { ...formData, amount: withdrawToday };

  return (
    <div className="theme-fresh approval-theme flex flex-col lg:flex-row min-h-dvh bg-[var(--surface-primary)]">
      {/* Sidebar */}
      <aside
        className="hero-chrome relative hidden lg:flex lg:w-[42%] xl:w-[38%] flex-col justify-between overflow-hidden p-12 xl:p-16"
      >
        <div className="relative z-10">
          <div className="mb-16">
            <Image
              src="/images/crawfort-white.png"
              alt="Crawfort"
              width={151}
              height={20}
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
          <div className="w-full max-w-[520px] lg:max-w-[720px]">
            <LoanResults
              formData={displayData}
              creditLimit={maxCreditLimit}
              monthlyRepayment={0}
              onAccept={() => router.push("/apply/accept")}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
