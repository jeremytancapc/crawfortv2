import { describe, expect, it } from "vitest";

import {
  BOOKING_WINDOW_DAYS,
  TIME_SLOTS,
  bookableDates,
  formatDisplayDate,
  formatDisplayTime,
  fromISODate,
  fullyBookedIndex,
  isDisabledDate,
  isSlotTooSoon,
  limitedSlotIndices,
  toISODate,
} from "./appointment-slots";

describe("appointment slots", () => {
  it("round-trips ISO dates in local time", () => {
    const date = new Date(2026, 8, 9); // 9 Sep 2026
    expect(toISODate(date)).toBe("2026-09-09");
    expect(fromISODate("2026-09-09").getTime()).toBe(date.getTime());
  });

  it("closes on Sundays and public holidays", () => {
    expect(isDisabledDate(new Date(2026, 8, 13))).toBe(true); // Sunday
    expect(isDisabledDate(new Date(2026, 11, 25))).toBe(true); // Christmas
    expect(isDisabledDate(new Date(2026, 8, 9))).toBe(false); // Wednesday
  });

  it("lists only open days inside the booking window", () => {
    const from = new Date(2026, 8, 9, 15, 30); // Wed
    const dates = bookableDates(from);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.length).toBeLessThanOrEqual(BOOKING_WINDOW_DAYS + 1);
    expect(dates[0].getTime()).toBe(new Date(2026, 8, 9).getTime());
    for (const date of dates) {
      expect(isDisabledDate(date)).toBe(false);
      expect(date.getHours()).toBe(0);
    }
    expect(dates.some((d) => toISODate(d) === "2026-09-13")).toBe(false);
  });

  it("requires two hours' notice on the same day only", () => {
    const now = new Date(2026, 8, 9, 12, 0);
    expect(isSlotTooSoon("13:30", "2026-09-09", now)).toBe(true);
    expect(isSlotTooSoon("14:00", "2026-09-09", now)).toBe(false);
    expect(isSlotTooSoon("10:30", "2026-09-10", now)).toBe(false);
  });

  it("derives deterministic availability from the date", () => {
    const booked = fullyBookedIndex("2026-09-10");
    expect(booked).toBeGreaterThanOrEqual(0);
    expect(booked).toBeLessThan(TIME_SLOTS.length);
    expect(fullyBookedIndex("2026-09-10")).toBe(booked);

    const limited = limitedSlotIndices("2026-09-10", booked);
    expect(limited.size).toBeGreaterThanOrEqual(3);
    expect(limited.size).toBeLessThanOrEqual(5);
    expect(limited.has(booked)).toBe(false);
  });

  it("formats dates and times for display", () => {
    expect(formatDisplayDate(new Date(2026, 8, 9))).toBe("Wed, 9 Sep 2026");
    expect(formatDisplayTime("10:30")).toBe("10:30am");
    expect(formatDisplayTime("12:00")).toBe("12:00pm");
    expect(formatDisplayTime("19:00")).toBe("7:00pm");
  });
});
