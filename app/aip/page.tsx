import { redirect } from "next/navigation";
import { getAipBookingConfirmation } from "@/lib/aip-session";
import { MobileHeader } from "@/app/mobile-header";
import { AipSidebar } from "./aip-sidebar";
import { AipMobileForm } from "./aip-mobile-form";

export const dynamic = "force-dynamic";

export default async function AipPage() {
  // If they already booked, send straight to confirmation.
  const existing = await getAipBookingConfirmation();
  if (existing) redirect("/aip/booked");

  return (
    <div className="flex flex-col lg:flex-row min-h-dvh">
      <AipSidebar
        title="Good news - you've been pre-approved."
        description="Book your appointment at our office to finalise your loan offer in person."
        points={[
          "No credit check required at this step",
          "No documents needed - just bring your NRIC",
          "Disbursed same day upon approval",
        ]}
      />

      <main className="flex flex-col flex-1 overflow-x-clip">
        <MobileHeader />

        <div className="flex flex-col items-center justify-start px-5 pb-8 pt-6 sm:px-8 flex-1 lg:justify-center lg:px-12 lg:pt-10 lg:pb-10 xl:px-20">
          <div className="w-full max-w-[520px]">
            <AipMobileForm />
          </div>
        </div>
      </main>
    </div>
  );
}
