"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle,
  ClockCountdown,
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

  const { weekday, full } = getDateParts(booking.date);

  return (
    <div className="animate-fade-up flex flex-col gap-3.5 text-left">
      {/* Appointment ticket ------------------------------------------------ */}
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-brand-teal/12 px-5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle size={17} weight="fill" className="shrink-0 text-[oklch(0.55_0.13_178)]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              Appointment confirmed
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <p className="min-w-0 truncate text-[11px] font-bold tabular-nums tracking-tight text-[var(--text-secondary)]">
              {booking.cfh5Id}
            </p>
            <button
              type="button"
              onClick={handleCopyRef}
              aria-label="Copy reference number"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-opacity duration-150 hover:opacity-60 active:scale-95"
            >
              {copied
                ? <Check size={14} weight="bold" />
                : <Copy size={14} weight="regular" />
              }
            </button>
          </div>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-5 -bottom-10 top-auto"
          >
            <svg viewBox="0 0 256 256" className="block h-[11rem] w-[11rem]">
              <g className="deck-card-watermark-spin">
                <path
                  fill="color-mix(in srgb, var(--brand-blue-hex) 22%, white)"
                  opacity="0.28"
                  d="M240,128c0,10.44-7.51,18.27-14.14,25.18-3.77,3.94-7.67,8-9.14,11.57-1.36,3.27-1.44,8.69-1.52,13.94-.15,9.76-.31,20.82-8,28.51s-18.75,7.85-28.51,8c-5.25.08-10.67.16-13.94,1.52-3.57,1.47-7.63,5.37-11.57,9.14C146.27,232.49,138.44,240,128,240s-18.27-7.51-25.18-14.14c-3.94-3.77-8-7.67-11.57-9.14-3.27-1.36-8.69-1.44-13.94-1.52-9.76-.15-20.82-.31-28.51-8s-7.85-18.75-8-28.51c-.08-5.25-.16-10.67-1.52-13.94-1.47-3.57-5.37-7.63-9.14-11.57C23.51,146.27,16,138.44,16,128s7.51-18.27,14.14-25.18c3.77-3.94,7.67-8,9.14-11.57,1.36-3.27,1.44-8.69,1.52-13.94.15-9.76.31-20.82,8-28.51s18.75-7.85,28.51-8c5.25-.08,10.67-.16,13.94-1.52,3.57-1.47,7.63-5.37,11.57-9.14C109.73,23.51,117.56,16,128,16s18.27,7.51,25.18,14.14c3.94,3.77,8,7.67,11.57,9.14,3.27,1.36,8.69,1.44,13.94,1.52,9.76.15,20.82.31,28.51,8s7.85,18.75,8,28.51c.08,5.25.16,10.67,1.52,13.94,1.47,3.57,5.37,7.63,9.14,11.57C232.49,109.73,240,117.56,240,128Z"
                />
              </g>
              <path
                fill="var(--brand-teal-hex, #06dec0)"
                opacity="0.14"
                d="M173.66,109.66l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"
              />
            </svg>
          </div>
          <div className="px-5 pt-5 pb-3">
            <p className="text-[16px] font-semibold text-[var(--text-secondary)]">
              {weekday}, {full}
            </p>
            <p className="mt-0.5 text-[32px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
              {formatDisplayTime(booking.time)}
            </p>
          </div>
          <p className="flex items-center gap-1.5 px-5 pb-4 text-[16px] leading-snug text-[var(--text-secondary)]">
            <ClockCountdown
              size={18}
              weight="fill"
              className="shrink-0 text-brand-blue"
            />
            Your slot will be reserved for 30 mins
          </p>
          <div
            aria-hidden
            className="mx-auto mt-3 mb-0 h-px w-[68%] bg-gradient-to-r from-transparent via-[var(--border-medium)] to-transparent"
          />
        </div>

        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <Image
              src="/images/crawfort-app-logo.png"
              alt="Crawfort app"
              width={1000}
              height={1000}
              className="h-12 w-12 shrink-0 lg:h-8 lg:w-8"
            />
            <p className="text-[18px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">
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
          </ol>
        </div>

        <div className="flex items-center gap-2 border-y border-dashed border-white/25 bg-black px-5 py-2.5">
          <ArrowRight size={17} weight="bold" className="shrink-0 text-white" />
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white">
            Download the App
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 bg-[var(--surface-elevated)] px-5 py-2">
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
                className="h-12 w-auto"
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
                className="h-[70px] w-auto"
              />
            </a>
        </div>
      </section>
    </div>
  );
}
