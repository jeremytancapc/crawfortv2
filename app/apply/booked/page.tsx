import { redirect } from "next/navigation";
import { getBookingConfirmation } from "@/lib/booking-confirmation";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { BookingConfirmedView } from "@/app/booking-confirmed-view";
import { ApplyIosShell } from "@/app/apply-gate/ios-ui";

export const dynamic = "force-dynamic";

export default async function BookedPage() {
  await enforceApplyFunnel("/apply/booked");

  const booking = await getBookingConfirmation();
  if (!booking) redirect("/");

  return (
    <ApplyIosShell
      sidebarTitle="You're all set"
      sidebarSubtitle="Your appointment reference and visit time are below."
    >
      <div className="shrink-0 px-5 pb-6 pt-7">
        <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.022em] text-[var(--text-primary)]">
          You&apos;re all set
        </h1>
        <p className="mt-1.5 text-[17px] leading-[1.4] text-[var(--text-secondary)]">
          Your appointment reference and visit time are below.
        </p>
      </div>
      <div className="flex-1 px-5 pb-8">
        <BookingConfirmedView booking={booking} />
      </div>
    </ApplyIosShell>
  );
}
