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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_LABELS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDisplayDate(isoDate: string): string {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  return `${DAY_LABELS[date.getDay()]}, ${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

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

type BringItem = { title: string; titleSuffix?: string; sub?: string; subItems?: string[] };

type BringGroup = {
  mustHave: BringItem[];
  goodToHave?: BringItem[];
};

/** Previous 3 full calendar months, e.g. "Apr, May & Jun". */
function lastThreeMonthsLabel(): string {
  const now = new Date();
  const months: string[] = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(MONTH_LABELS[d.getMonth()]);
  }
  return `${months[0]}, ${months[1]} & ${months[2]}`;
}

function getWhatToBring(): { sg_pr: BringGroup; foreigner: BringGroup } {
  const months = lastThreeMonthsLabel();
  return {
    sg_pr: {
      mustHave: [
        { title: "NRIC", sub: "Physical card or digital Singpass" },
        { title: "Singpass app", sub: "Installed on your phone" },
      ],
      goodToHave: [
        {
          title: "Last 3 months of income proof",
          titleSuffix: `(${months})`,
          subItems: [
            "Payslips",
            "PHV platform / gig worker statements",
            "Bank statements",
          ],
        },
      ],
    },
    foreigner: {
      mustHave: [
        { title: "Work Pass", sub: "WP / SP / EP / LTVP, 3+ months validity" },
        { title: "Singpass app", sub: "Installed on your phone" },
        { title: `Payslips (${months})`, sub: "Latest 3 months" },
        { title: "Proof of SG address", sub: "Bank / utility / mobile bill, dated within 30 days" },
      ],
    },
  };
}

function formatItemForShare(item: BringItem): string[] {
  const fullTitle = item.titleSuffix ? `${item.title} ${item.titleSuffix}` : item.title;
  if (item.subItems?.length) {
    return [fullTitle, ...item.subItems.map((s) => `  • ${s}`)];
  }
  return [`• ${fullTitle}${item.sub ? ` - ${item.sub}` : ""}`];
}

function formatThingsToBringForShare(idType: "sg_pr" | "foreigner"): string {
  const group = getWhatToBring()[idType];
  const lines: string[] = ["Must have:"];
  for (const item of group.mustHave) {
    lines.push(...formatItemForShare(item));
  }
  if (group.goodToHave?.length) {
    lines.push("", "Good to have (can help increase your loan amount):");
    for (const item of group.goodToHave) {
      lines.push(...formatItemForShare(item));
    }
  }
  return lines.join("\n");
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

  const idType = booking.idType === "foreigner" ? "foreigner" : "sg_pr";

  const thingsToBringLines = formatThingsToBringForShare(idType);

  const appointmentMessage = [
    "[ CF Money Appointment ]",
    "",
    `Application Ref: ${booking.cfh5Id}`,
    "",
    `Date: ${formatDisplayDate(booking.date)}`,
    `Time: ${formatDisplayTime(booking.time)}`,
    "",
    "-- Location --",
    "1 North Bridge Road, High Street Centre",
    "#01-35, Singapore 179094",
    "City Hall MRT (Exit B) or Clarke Quay MRT (Exit E)",
    "https://maps.app.goo.gl/Cs9Av94qW3NHh7wY6",
    "",
    "-- Things to bring --",
    thingsToBringLines,
  ].join("\n");

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ text: appointmentMessage }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(appointmentMessage)}`, "_blank");
    }
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

        <div className="flex items-start gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
          <ClockCountdown size={16} weight="regular" className="mt-px shrink-0 text-[var(--text-tertiary)]" />
          <p className="text-[13px] leading-[1.4] text-[var(--text-secondary)]">
            Kindly arrive on time so we can serve you promptly.
          </p>
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

      {/* WhatsApp ---------------------------------------------------------- */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-5 py-5">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "oklch(0.72 0.17 145 / 0.16)" }}
          >
            <WhatsappLogo size={22} weight="fill" style={{ color: "oklch(0.58 0.16 148)" }} />
          </span>
          <p className="text-[16px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">
            Details are on the way
          </p>
        </div>
        <p className="mt-3 text-[14px] leading-[1.45] text-[var(--text-secondary)]">
          We&apos;ll WhatsApp your appointment time, our office address and the
          documents to bring to the number on your application.
        </p>
        <button
          type="button"
          onClick={handleShare}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-[var(--border-medium)] bg-[var(--surface-elevated)] px-4 text-[15px] font-semibold text-[var(--text-primary)] transition-all duration-200 hover:bg-[var(--surface-secondary)] active:scale-[0.98]"
        >
          <WhatsappLogo size={18} weight="fill" />
          Save details on WhatsApp
        </button>
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
        <p className="mt-3.5 text-[12px] font-semibold text-[var(--text-tertiary)]">
          Also used for
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {["Loan contract", "Payments", "Loan details"].map((label) => (
            <span
              key={label}
              className="rounded-full bg-[var(--surface-secondary)] px-2.5 py-1 text-[12px] font-semibold text-[var(--text-secondary)]"
            >
              {label}
            </span>
          ))}
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
