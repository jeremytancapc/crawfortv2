"use client";

import { useRouter } from "next/navigation";
import { AppointmentBooking, type BookingConfirmation } from "@/app/appointment-booking";
import { MobileHeader } from "@/app/mobile-header";
import { trackEvent } from "@/lib/analytics";
import type { LoanFormData } from "@/lib/loan-form";
import { useLocale } from "@/app/i18n/locale-provider";
import { AipSidebar } from "../aip-sidebar";

const LOG = "[aip/book:client]";

// AIP flow only needs idType for the "Things to Bring" list; default to sg_pr.
const AIP_FORM_DATA = { idType: "singaporean" } as unknown as LoanFormData;

export function AipBookingView() {
  const { t } = useLocale();
  const router = useRouter();

  async function handleConfirm(date: string, time: string): Promise<BookingConfirmation | null> {
    console.info(`${LOG} POST /api/aip/book`, { date, time });

    const res = await fetch("/api/aip/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, time }),
    });

    console.info(`${LOG} response`, { status: res.status, ok: res.ok });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      console.error(`${LOG} book failed`, { status: res.status, error: body.error });
      alert(t("We couldn't confirm your appointment. Please try again."));
      return null;
    }

    const json = (await res.json()) as BookingConfirmation;
    console.info(`${LOG} success - redirecting to /aip/booked`, {
      appointmentId: json.appointmentId,
      cfh5Id: json.cfh5Id,
      date: json.date,
      time: json.time,
    });
    trackEvent("aip_step2_appointment_booked", { date: json.date, time: json.time });
    router.replace("/aip/booked");
    return json;
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-dvh">
      <AipSidebar
        title="Book your appointment"
        description="Choose a date and time that works best for you to visit our office."
      />

      <main className="flex flex-col flex-1 overflow-x-clip">
        <MobileHeader />

        <div className="flex flex-col items-center justify-start px-5 pb-8 pt-6 sm:px-8 flex-1 lg:justify-center lg:px-12 lg:pt-10 lg:pb-10 xl:px-20">
          <div className="w-full max-w-[520px]">
            <AppointmentBooking
              formData={AIP_FORM_DATA}
              onBack={() => router.push("/aip")}
              onConfirm={handleConfirm}
              onBookedRedirect
            />
          </div>
        </div>
      </main>
    </div>
  );
}
