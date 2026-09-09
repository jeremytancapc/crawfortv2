import { isSgPublicHoliday } from "@/lib/sg-public-holidays";

/**
 * Appointment slot rules shared by the booking UIs. Pure functions only so
 * they can be unit-tested and rendered on the server.
 */

/** 30-min slots from 10:30 to 19:00 (last appointment at 19:00, ends 19:30). */
export const TIME_SLOTS = [
  "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00",
  "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00",
  "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00",
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

/** Same-day bookings need this much notice. */
export const SAME_DAY_NOTICE_MINUTES = 120;

/** How many days ahead (inclusive of today) a visit can be booked. */
export const BOOKING_WINDOW_DAYS = 7;

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: string): Date {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

/** Seeded PRNG (LCG) - deterministic stream from a date string seed. */
function makePrng(seed: string) {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (Math.imul(31, state) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) | 0;
    return (state >>> 0) / 0x100000000;
  };
}

/** One slot per day is fully booked - deterministic but varies each day. */
export function fullyBookedIndex(date: string): number {
  const rand = makePrng(date + "booked");
  return Math.floor(rand() * TIME_SLOTS.length);
}

/** 3-5 scattered "limited spots" indices per day, never the fully-booked slot. */
export function limitedSlotIndices(date: string, bookedIdx: number): Set<number> {
  const rand = makePrng(date + "limited");
  const count = 3 + Math.floor(rand() * 3); // 3, 4 or 5
  const indices = new Set<number>();
  let guard = 0;
  while (indices.size < count && guard++ < 60) {
    const idx = Math.floor(rand() * TIME_SLOTS.length);
    if (idx !== bookedIdx) indices.add(idx);
  }
  return indices;
}

/** Sundays and gazetted public holidays cannot be booked. */
export function isDisabledDate(date: Date): boolean {
  if (date.getDay() === 0) return true;
  return isSgPublicHoliday(toISODate(date));
}

/** Slot is in the past (or inside the same-day notice window) for `date`. */
export function isSlotTooSoon(
  slot: string,
  dateIso: string,
  now: Date = new Date(),
): boolean {
  if (dateIso !== toISODate(now)) return false;
  const [h, m] = slot.split(":").map(Number);
  const slotMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slotMinutes < nowMinutes + SAME_DAY_NOTICE_MINUTES;
}

/** Bookable dates in the window starting today, skipping closed days. */
export function bookableDates(from: Date = new Date(), windowDays = BOOKING_WINDOW_DAYS): Date[] {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const dates: Date[] = [];
  for (let offset = 0; offset <= windowDays; offset++) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    if (!isDisabledDate(day)) dates.push(day);
  }
  return dates;
}

export function formatDisplayDate(date: Date): string {
  return `${DAY_LABELS[date.getDay()]}, ${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDisplayTime(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const period = h < 12 ? "am" : "pm";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")}${period}`;
}
