"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CheckCircle,
  ClockCountdown,
  WhatsappLogo,
  ArrowUpRight,
  Copy,
  Check,
} from "@phosphor-icons/react";
import type { StoredBookingConfirmation } from "@/lib/booking-confirmation";

const MOBILE_APP_URL = "https://crawfort.com/mobileapp";

const FULL_DAY_LABELS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Split parts for the calendar chip + headline in the ticket card. */
function getDateParts(isoDate: string) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  return {
    month: MONTH_LABELS[date.getMonth()].toUpperCase(),
    day: String(date.getDate()),
    weekday: FULL_DAY_LABELS[date.getDay()],
    full: `${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`,
  };
}

function formatDisplayTime(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const period = h < 12 ? "am" : "pm";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")}${period}`;
}

interface BookingConfirmedViewProps {
  booking: StoredBookingConfirmation;
}

export function BookingConfirmedView({ booking }: BookingConfirmedViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyRef = () => {
    navigator.clipboard.writeText(booking.cfh5Id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const { month, day, weekday, full } = getDateParts(booking.date);

  return (
    <div className="animate-fade-up flex flex-col gap-3.5 text-left">
      {/* Appointment ticket ------------------------------------------------ */}
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-brand-teal/12 px-5 py-2.5">
          <CheckCircle size={17} weight="fill" className="shrink-0 text-[oklch(0.55_0.13_178)]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            Appointment confirmed
          </span>
        </div>

        <div className="flex items-center gap-4 px-5 py-5">
          <div
            className="flex h-[62px] w-[58px] shrink-0 flex-col items-center justify-center rounded-[14px] text-white"
            style={{ background: "var(--brand-blue-hex)" }}
            aria-hidden="true"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">
              {month}
            </span>
            <span className="text-[26px] font-bold leading-none">{day}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--text-secondary)]">
              {weekday}, {full}
            </p>
            <p className="mt-0.5 text-[28px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
              {formatDisplayTime(booking.time)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-[var(--border-subtle)] px-5 py-3">
          <div className="flex items-start gap-2">
            <ClockCountdown
              size={16}
              weight="fill"
              className="mt-px shrink-0 text-brand-blue"
            />
            <p className="text-[13px] leading-[1.4] text-[var(--text-secondary)]">
              Kindly arrive on time so we can serve you promptly.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <WhatsappLogo
              size={16}
              weight="fill"
              className="mt-px shrink-0"
              style={{ color: "oklch(0.58 0.16 148)" }}
            />
            <p className="text-[13px] leading-[1.4] text-[var(--text-secondary)]">
              We will send you the appointment details via WhatsApp soon.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-dashed border-white/25 bg-black px-5 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">
              Application reference
            </p>
            <p className="mt-0.5 truncate text-[15px] font-bold tracking-tight text-white">
              {booking.cfh5Id}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyRef}
            aria-label="Copy reference number"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity duration-150 hover:opacity-60 active:scale-95"
          >
            {copied
              ? <Check size={19} weight="bold" />
              : <Copy size={19} weight="regular" />
            }
          </button>
        </div>
      </section>

      {/* Crawfort app ------------------------------------------------------ */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-5 py-5">
        <div className="flex items-center gap-3">
          <Image
            src="/images/crawfort-app-logo.png"
            alt="Crawfort app"
            width={1000}
            height={1000}
            className="h-10 w-10 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-blue">
              Before your appointment
            </p>
            <p className="text-[16px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">
              Download the Crawfort app
            </p>
          </div>
        </div>
        <p className="mt-3 text-[14px] leading-[1.45] text-[var(--text-secondary)]">
          Set it up before you come in so we can serve you faster on the day.
          You&apos;ll keep using it after your loan starts.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <a
            href={MOBILE_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-opacity duration-150 hover:opacity-80 active:scale-[0.98]"
          >
            {/* Official Apple badge — do not restyle the artwork. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/download-on-app-store.svg"
              alt="Download on the App Store"
              width={120}
              height={40}
              className="h-10 w-auto"
            />
          </a>
          <a
            href={MOBILE_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="-ml-1 transition-opacity duration-150 hover:opacity-80 active:scale-[0.98]"
          >
            {/* Official Google badge — extra PNG padding, sized to match Apple. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/get-it-on-google-play.png"
              alt="Get it on Google Play"
              width={155}
              height={58}
              className="h-[58px] w-auto"
            />
          </a>
        </div>
        <a
          href={MOBILE_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full px-4 text-[15px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          style={{ background: "var(--brand-blue-hex)" }}
        >
          Get the app
          <ArrowUpRight size={17} weight="bold" />
        </a>
      </section>
    </div>
  );
}
