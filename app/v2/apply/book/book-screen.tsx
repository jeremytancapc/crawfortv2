"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { BookingConfirmation } from "@/app/appointment-booking";
import { useApplyPath } from "@/app/use-apply-path";
import { Chip, Pill } from "@/app/v2/ui/controls";
import { V2Body, V2Footer, V2Header, V2Screen, V2Title, cx } from "@/app/v2/ui/screen";
import {
  DAY_LABELS,
  MONTH_LABELS,
  TIME_SLOTS,
  bookableDates,
  formatDisplayTime,
  fullyBookedIndex,
  isSlotTooSoon,
  limitedSlotIndices,
  toISODate,
} from "@/lib/appointment-slots";
import { markApplyStepVisited } from "@/lib/apply-step-nav";
import type { LoanFormData } from "@/lib/loan-form";

const LOG = "[v2/apply/book:client]";

/**
 * Booking on one screen: a horizontal strip of open days, a grid of slots,
 * one CTA. Posts to `/api/apply/book` exactly like production and lands on
 * the booked screen.
 */
export function BookScreen({ formData }: { formData: LoanFormData }) {
  const router = useRouter();
  const applyHref = useApplyPath();
  const dates = useMemo(() => bookableDates(), []);
  const [dateIso, setDateIso] = useState<string | null>(() =>
    dates[0] ? toISODate(dates[0]) : null,
  );
  const [slot, setSlot] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    markApplyStepVisited("book");
  }, []);

  const bookedIdx = dateIso ? fullyBookedIndex(dateIso) : -1;
  const limited = useMemo(
    () => (dateIso ? limitedSlotIndices(dateIso, bookedIdx) : new Set<number>()),
    [dateIso, bookedIdx],
  );

  const selectedDate = dateIso ? dates.find((d) => toISODate(d) === dateIso) ?? null : null;
  const canConfirm = Boolean(dateIso && slot) && !isBooking;

  const confirm = async () => {
    if (!dateIso || !slot || isBooking) return;
    setIsBooking(true);
    setError(null);
    const payload: Record<string, string> = { date: dateIso, time: slot };
    if (formData.authMethod === "singpass" && formData.nric) payload.idNumber = formData.nric;

    try {
      const res = await fetch("/api/apply/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        console.error(`${LOG} book failed`, { status: res.status, error: body.error });
        setError("We couldn't confirm that slot. Try another time.");
        setIsBooking(false);
        return;
      }
      const json = (await res.json()) as BookingConfirmation;
      console.info(`${LOG} booked`, { appointmentId: json.appointmentId, cfh5Id: json.cfh5Id });
      router.replace(applyHref("/apply/booked"));
    } catch (err) {
      console.error(`${LOG} network error`, err);
      setError("We couldn't reach the server. Check your connection and try again.");
      setIsBooking(false);
    }
  };

  return (
    <V2Screen>
      <V2Header backHref={applyHref("/apply/accept")} progress={{ stage: "book", fraction: 0.4 }} />
      <V2Body className="gap-4">
        <V2Title
          title="Pick a time to visit"
          subtitle="High Street Centre, near City Hall MRT."
        />

        <div className="v2-strip v2-enter" role="radiogroup" aria-label="Date" style={{ ["--i" as string]: 1 }}>
          {dates.map((date) => {
            const iso = toISODate(date);
            const selected = iso === dateIso;
            return (
              <button
                key={iso}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setDateIso(iso);
                  setSlot(null);
                }}
                className={cx(
                  "flex h-[60px] w-[56px] flex-col items-center justify-center rounded-[16px] transition-colors",
                  selected
                    ? "bg-[var(--v2-ink)] text-[var(--v2-on-accent)]"
                    : "bg-[var(--v2-surface)] text-[var(--v2-ink)]",
                )}
              >
                <span className={cx("text-[11px] font-semibold uppercase", selected ? "opacity-70" : "text-[var(--v2-ink-3)]")}>
                  {DAY_LABELS[date.getDay()]}
                </span>
                <span className="text-[18px] font-bold leading-tight tabular-nums">{date.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className="v2-enter grid min-h-0 grid-cols-3 gap-2" role="radiogroup" aria-label="Time" style={{ ["--i" as string]: 2 }}>
          {TIME_SLOTS.map((time, index) => {
            const isFull = index === bookedIdx;
            const tooSoon = dateIso ? isSlotTooSoon(time, dateIso) : false;
            const disabled = isFull || tooSoon;
            const isLimited = limited.has(index) && !disabled;
            return (
              <Chip
                key={time}
                role="radio"
                aria-checked={slot === time}
                selected={slot === time}
                disabled={disabled}
                onClick={() => setSlot(time)}
                className="!min-h-[40px] !rounded-[12px] !px-2 text-[14px]"
                aria-label={`${formatDisplayTime(time)}${isFull ? ", fully booked" : isLimited ? ", limited spots" : ""}`}
              >
                {formatDisplayTime(time)}
                {isLimited ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[var(--v2-teal)]"
                    aria-hidden="true"
                  />
                ) : null}
              </Chip>
            );
          })}
        </div>
      </V2Body>
      <V2Footer
        note={
          error ??
          (selectedDate && slot
            ? `${DAY_LABELS[selectedDate.getDay()]} ${selectedDate.getDate()} ${MONTH_LABELS[selectedDate.getMonth()]} · ${formatDisplayTime(slot)} · bring your NRIC`
            : "About 30 minutes. Bring your NRIC. Teal dot = few spots left.")
        }
      >
        <Pill onClick={() => void confirm()} disabled={!canConfirm} loading={isBooking}>
          {isBooking ? "Booking" : "Confirm visit"}
        </Pill>
      </V2Footer>
    </V2Screen>
  );
}
