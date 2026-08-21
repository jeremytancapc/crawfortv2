"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppointmentBooking, type BookingConfirmation } from "@/app/appointment-booking";
import { ApplyIosShell } from "@/app/apply-gate/ios-ui";
import { APPLY_PROGRESS } from "@/lib/apply-progress";
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
    <ApplyIosShell
      sidebarTitle="Book your appointment"
      sidebarSubtitle="Choose a date and time that works best for you to visit our office."
      progressStep={APPLY_PROGRESS.book}
    >
      <div className="shrink-0 px-5 pb-4 pt-7">
        <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.022em] text-[var(--text-primary)]">
          Book your appointment
        </h1>
        <p className="mt-1.5 text-[17px] leading-[1.4] text-[var(--text-secondary)]">
          The visit only takes around 30 minutes.
        </p>
      </div>
      <div className="flex-1 px-5 pb-8">
        <AppointmentBooking
          formData={formData}
          onBack={() => router.push("/apply/approval")}
          onConfirm={handleConfirm}
          onBookedRedirect
          hideHeaderOnMobile
        />
      </div>
    </ApplyIosShell>
  );
}
