"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CalendarBlank } from "@phosphor-icons/react";
import { AppointmentBooking, type BookingConfirmation } from "@/app/appointment-booking";
import { MobileHeader } from "@/app/mobile-header";
import { MobileLegalFooter } from "@/app/mobile-legal-footer";
import type { LoanFormData } from "@/lib/loan-form";

interface Props {
  formData: LoanFormData;
}

const LOG = "[apply/book:client]";

export function BookingView({ formData }: Props) {
  const router = useRouter();

  useEffect(() => {
    const lid = formData.leadId;
    console.info(`${LOG} BookingView mounted`, {
      hasLeadId: Boolean(lid),
      cfh5Hint:
        typeof lid === "string" && lid.length > 0
          ? `CFH5-${lid.slice(-8).toUpperCase()}`
          : undefined,
      authMethod: formData.authMethod ?? null,
    });
  }, [formData.leadId, formData.authMethod]);

  async function handleConfirm(date: string, time: string): Promise<BookingConfirmation | null> {
    console.info(`${LOG} POST /api/apply/book`, { date, time });

    // Include idNumber when customer authenticated via Singpass
    const payload: Record<string, string> = { date, time };
    if (formData.authMethod === "singpass" && formData.nric) {
      payload.idNumber = formData.nric;
    }

    const res = await fetch("/api/apply/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.info(`${LOG} response`, { status: res.status, ok: res.ok });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      console.error(`${LOG} book failed`, { status: res.status, error: body.error, body });
      alert("We couldn’t confirm your appointment. Please try again.");
      return null;
    }

    const json = (await res.json()) as BookingConfirmation;
    console.info(`${LOG} success - redirecting to /apply/booked`, {
      appointmentId: json.appointmentId,
      cfh5Id: json.cfh5Id,
      date: json.date,
      time: json.time,
      loanAmount: json.loanAmount,
    });
    router.replace("/apply/booked");
    return json;
  }

  return (
    <div className="theme-fresh flex flex-col lg:flex-row min-h-dvh bg-[var(--surface-primary)]">
      <aside
        className="hero-chrome relative hidden lg:flex lg:w-[42%] xl:w-[38%] flex-col justify-between overflow-hidden p-12 xl:p-16"
      >
        <div className="relative z-10">
          <div className="mb-16">
            <Image src="/images/crawfort-white.png" alt="Crawfort" width={151} height={20} className="h-6 w-auto" priority />
          </div>
          <h1 className="font-display text-4xl xl:text-5xl font-semibold leading-[1.1] tracking-tight text-[var(--text-on-brand)] max-w-[420px]">
            Book your appointment
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[var(--text-on-brand)] opacity-75 max-w-[380px]">
            Choose a date and time that works best for you to visit our office.
          </p>
        </div>
      </aside>

      <main className="flex flex-col flex-1 overflow-x-clip">
        <MobileHeader />

        {/* Match home page: full-bleed blue hero on mobile + floating white card. */}
        <div className="flex flex-col items-center justify-start pb-8 flex-1 lg:justify-center lg:px-12 lg:pt-10 lg:pb-10 xl:px-20">
          <div className="flex w-full flex-col lg:max-w-[520px]">
            {/* Mobile/tablet blue hero band */}
            <div className="relative w-full lg:hidden">
              <div
                aria-hidden
                className="hero-chrome pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2"
              />
              <div className="relative mx-auto flex w-full max-w-[520px] flex-col items-center gap-2 px-5 pt-6 pb-16 text-center sm:px-8">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]"
                  style={{ background: "rgba(255,255,255,0.16)" }}
                  aria-hidden="true"
                >
                  <CalendarBlank size={18} weight="duotone" className="text-white" />
                </span>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
                  Pick a time to collect your funds
                </h1>
                <p className="text-sm leading-relaxed text-white/75 max-w-[42ch]">
                  A physical visit is required for KYC and AML under local regulations.
                </p>
              </div>
            </div>

            <div className="relative z-10 mx-auto -mt-10 flex w-full max-w-[520px] flex-1 flex-col px-5 sm:px-8 lg:mt-0 lg:px-0">
              <div className="rounded-[28px] bg-[var(--surface-elevated)] p-5 sm:p-7 lg:rounded-none lg:bg-transparent lg:p-0 shadow-[0_20px_40px_-24px_rgba(20,30,70,0.25),0_2px_10px_-2px_rgba(20,30,70,0.08)] lg:shadow-none">
                <AppointmentBooking
                  formData={formData}
                  onBack={() => router.push("/apply/approval")}
                  onConfirm={handleConfirm}
                  onBookedRedirect
                  hideHeaderOnMobile
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
