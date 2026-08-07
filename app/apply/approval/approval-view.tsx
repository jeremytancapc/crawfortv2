"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import type { LoanFormData } from "@/lib/loan-form";
import { LoanResults } from "@/app/loan-results";
import { MobileHeader } from "@/app/mobile-header";
import { MobileLegalFooter } from "@/app/mobile-legal-footer";

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
          <h1 className="font-display text-4xl xl:text-5xl font-semibold leading-[1.1] tracking-tight text-[var(--text-on-brand)] max-w-[420px]">
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

        {/* Match home page: full-bleed blue hero on mobile + floating white card. */}
        <div className="flex flex-col items-center justify-start pb-8 flex-1 lg:justify-center lg:px-12 lg:pt-10 lg:pb-10 xl:px-20">
          <div className="flex w-full flex-col lg:max-w-[720px]">
            {/* Mobile/tablet blue hero band */}
            <div className="relative w-full lg:hidden">
              <div
                aria-hidden
                className="hero-chrome pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2"
              />
              <div className="relative mx-auto w-full max-w-[520px] px-5 pt-6 pb-16 sm:px-8">
                <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-white">
                  Your loan offer is confirmed.
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-white/75 max-w-[38ch]">
                  Choose the repayment plan that works best for you, then book an appointment to collect your funds.
                </p>
              </div>
            </div>

            <div className="relative z-10 mx-auto -mt-10 flex w-full max-w-[520px] flex-1 flex-col px-5 sm:px-8 lg:mt-0 lg:max-w-none lg:px-0">
              <div className="rounded-[28px] bg-[var(--surface-elevated)] p-5 sm:p-7 lg:rounded-none lg:bg-transparent lg:p-0 shadow-[0_20px_40px_-24px_rgba(20,30,70,0.25),0_2px_10px_-2px_rgba(20,30,70,0.08)] lg:shadow-none">
                <LoanResults
                  formData={displayData}
                  creditLimit={maxCreditLimit}
                  monthlyRepayment={0}
                  onAccept={() => router.push("/apply/accept")}
                />
              </div>
            </div>
          </div>
        </div>

        <MobileLegalFooter />
      </main>
    </div>
  );
}
