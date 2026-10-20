import { redirect } from "next/navigation";
import { getAipBookingConfirmation } from "@/lib/aip-session";
import { MobileHeader } from "@/app/mobile-header";
import { AipSidebar } from "../aip-sidebar";
import { AipBookedView } from "./aip-booked-view";

export const dynamic = "force-dynamic";

export default async function AipBookedPage() {
  const booking = await getAipBookingConfirmation();
  if (!booking) redirect("/aip");

  return (
    <div className="flex flex-col lg:flex-row min-h-dvh">
      <AipSidebar
        title="You're all set"
        description="Your appointment reference and visit time are below."
      />

      <main className="flex flex-col flex-1 overflow-x-clip">
        <MobileHeader />

        <div className="flex flex-col items-center justify-start px-5 pb-8 pt-6 sm:px-8 flex-1 lg:justify-center lg:px-12 lg:pt-10 lg:pb-10 xl:px-20">
          <div className="w-full max-w-[520px]">
            <AipBookedView booking={booking} />
          </div>
        </div>
      </main>
    </div>
  );
}
