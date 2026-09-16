"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CalendarBlank,
  CheckCircle,
  ClockCountdown,
  Copy,
  Check,
  DownloadSimple,
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

  const { weekday, full } = getDateParts(booking.date);

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

        <div className="flex items-center gap-4 px-5 pt-5 pb-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] text-white"
            style={{ background: "var(--brand-blue-hex)" }}
            aria-hidden="true"
          >
            <CalendarBlank size={24} weight="fill" />
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-[var(--text-secondary)]">
              {weekday}, {full}
            </p>
            <p className="mt-0.5 text-[32px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
              {formatDisplayTime(booking.time)}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 px-5 pb-4 text-[16px] leading-snug text-[var(--text-secondary)]">
          <ClockCountdown
            size={18}
            weight="fill"
            className="shrink-0 text-brand-blue"
          />
          Your slot will be reserved for 30 mins only
        </p>

        <div className="flex items-center justify-between gap-3 border-y border-dashed border-white/25 bg-black px-5 py-3">
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

        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <Image
              src="/images/crawfort-app-logo.png"
              alt="Crawfort app"
              width={1000}
              height={1000}
              className="h-12 w-12 shrink-0"
            />
            <p className="text-[20px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">
              What to do next
            </p>
          </div>
          <ol className="mt-4 flex flex-col gap-3">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-[13px] font-bold text-brand-blue">
                1
              </span>
              <p className="text-[17px] leading-[1.45] text-[var(--text-primary)]">
                Setup the Crawfort App from App store
              </p>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-[13px] font-bold text-brand-blue">
                2
              </span>
              <p className="text-[17px] leading-[1.45] text-[var(--text-primary)]">
                Sign in the app using Singpass to manage your queue, loan details and repayment
              </p>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-[13px] font-bold text-brand-blue">
                3
              </span>
              <p className="text-[17px] leading-[1.45] text-[var(--text-primary)]">
                Scan the QR code from our app when you arrive for the appointment
              </p>
            </li>
          </ol>
          <div className="mt-5 flex items-center gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] text-white"
              style={{ background: "var(--brand-blue-hex)" }}
              aria-hidden="true"
            >
              <DownloadSimple size={22} weight="bold" />
            </span>
            <p className="text-[20px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">
              Download here
            </p>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
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
              className="transition-opacity duration-150 hover:opacity-80 active:scale-[0.98]"
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
        </div>
      </section>
    </div>
  );
}
