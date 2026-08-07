import { redirect } from "next/navigation";
import Image from "next/image";
import { SealCheck } from "@phosphor-icons/react/dist/ssr";
import { getBookingConfirmation } from "@/lib/booking-confirmation";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { BookingConfirmedView } from "@/app/booking-confirmed-view";
import { MobileHeader } from "@/app/mobile-header";
import { MobileLegalFooter } from "@/app/mobile-legal-footer";

export const dynamic = "force-dynamic";

export default async function BookedPage() {
  await enforceApplyFunnel("/apply/booked");

  const booking = await getBookingConfirmation();
  if (!booking) redirect("/");

  return (
    <div className="theme-fresh flex flex-col lg:flex-row min-h-dvh bg-[var(--surface-primary)]">
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
            You&apos;re all set
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[var(--text-on-brand)] opacity-75 max-w-[380px]">
            Your appointment reference and visit time are below.
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
              <div className="relative mx-auto flex w-full max-w-[520px] flex-col items-center gap-2.5 px-5 pt-6 pb-16 text-center sm:px-8">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "rgba(255,255,255,0.16)" }}
                  aria-hidden="true"
                >
                  <SealCheck size={28} weight="fill" className="text-white" />
                </span>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
                  You&apos;re all set
                </h1>
                <p className="text-sm leading-relaxed text-white/75 max-w-[300px]">
                  Your appointment reference and visit time are below.
                </p>
              </div>
            </div>

            <div className="relative z-10 mx-auto -mt-10 flex w-full max-w-[520px] flex-1 flex-col px-5 sm:px-8 lg:mt-0 lg:px-0">
              <div className="rounded-[28px] bg-[var(--surface-elevated)] p-5 sm:p-7 lg:rounded-none lg:bg-transparent lg:p-0 shadow-[0_20px_40px_-24px_rgba(20,30,70,0.25),0_2px_10px_-2px_rgba(20,30,70,0.08)] lg:shadow-none">
                <BookingConfirmedView booking={booking} />
              </div>
            </div>
          </div>
        </div>

        <MobileLegalFooter />
      </main>
    </div>
  );
}
