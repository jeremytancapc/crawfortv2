"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

import { Pill, Row, Rows } from "@/app/v2/ui/controls";
import { BookedIllustration } from "@/app/v2/ui/illustrations";
import { V2Body, V2Footer, V2Header, V2Illustration, V2Screen, V2Title } from "@/app/v2/ui/screen";
import { formatDisplayTime, fromISODate } from "@/lib/appointment-slots";
import { markApplyStepVisited } from "@/lib/apply-step-nav";
import type { StoredBookingConfirmation } from "@/lib/booking-confirmation";

const MOBILE_APP_URL = "https://crawfort.com/mobileapp";

function longDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function BookedScreen({ booking }: { booking: StoredBookingConfirmation }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    markApplyStepVisited("booked");
  }, []);

  const copyRef = () => {
    navigator.clipboard
      .writeText(booking.cfh5Id)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  const addToCalendar = () => {
    // Serves text/calendar inline so the OS opens its "Add to Calendar" sheet.
    window.location.href = `/api/apply/calendar?date=${booking.date}&time=${encodeURIComponent(booking.time)}`;
  };

  return (
    <V2Screen>
      <V2Header progress={{ stage: "book", fraction: 1 }} />
      <V2Body justify="between">
        <div className="flex flex-col gap-4">
          <V2Illustration>
            <BookedIllustration />
          </V2Illustration>
          <V2Title title="You're booked" subtitle="We'll WhatsApp the details shortly." />
        </div>

        <div className="v2-enter flex flex-col gap-1" style={{ ["--i" as string]: 1 }}>
          <span className="v2-label">{longDate(booking.date)}</span>
          <span className="v2-hero-num">{formatDisplayTime(booking.time)}</span>
        </div>

        <Rows className="v2-enter">
          <Row
            label="Reference"
            value={booking.cfh5Id}
            action={
              <button
                type="button"
                onClick={copyRef}
                aria-label="Copy reference number"
                className="v2-icon-button -mr-2 h-9 w-9 text-[var(--v2-ink-2)]"
              >
                {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
              </button>
            }
          />
          <Row label="Where" value="High Street Centre, #01-35" />
          <Row label="Bring" value="NRIC and Singpass" />
        </Rows>
      </V2Body>
      <V2Footer>
        <a
          href={MOBILE_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="v2-pill v2-pill-primary"
        >
          Get the app
        </a>
        <Pill variant="ghost" onClick={addToCalendar}>
          Add to calendar
        </Pill>
      </V2Footer>
    </V2Screen>
  );
}
