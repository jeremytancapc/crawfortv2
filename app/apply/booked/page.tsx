import { redirect } from "next/navigation";
import { getBookingConfirmation } from "@/lib/booking-confirmation";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { BookingConfirmedView } from "@/app/booking-confirmed-view";
import { ApplyIosShell } from "@/app/apply-gate/ios-ui";
import { ApplyStepNavFooter } from "@/app/apply-gate/use-apply-step-nav";
import { APPLY_PROGRESS } from "@/lib/apply-progress";

export const dynamic = "force-dynamic";

export default async function BookedPage() {
  await enforceApplyFunnel("/apply/booked");

  const booking = await getBookingConfirmation();
  if (!booking) redirect("/");

  return (
    <ApplyIosShell
      sidebarTitle="Your funds are reserved"
      sidebarSubtitle="Your appointment reference and visit time are below."
      progressStep={APPLY_PROGRESS.booked}
    >
      <div className="shrink-0 px-5 pb-6 pt-7">
        <div className="flex items-center gap-3">
          <span
            className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center"
            role="status"
            aria-label="Funds reserved"
          >
            <span className="absolute inset-0 rounded-full bg-emerald-400/50 animate-staff-presence-ping-green" />
            <span className="relative h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_3px_rgba(16,185,129,0.55)] animate-staff-presence-glow-green" />
          </span>
          <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.022em] text-[var(--text-primary)]">
            Your funds are reserved
          </h1>
        </div>
        <p className="mt-1.5 text-[17px] leading-[1.4] text-[var(--text-secondary)]">
          Your appointment reference and visit time are below.
        </p>
      </div>
      <div className="flex-1 px-5 pb-8">
        <BookingConfirmedView booking={booking} />
      </div>
      <ApplyStepNavFooter id="booked" />
    </ApplyIosShell>
  );
}
