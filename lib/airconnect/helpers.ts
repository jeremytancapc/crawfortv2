/**
 * Pure date/formatting/business-rule helpers for AirConnect.
 * Kept side-effect free so they're safe to call during render.
 */

import type { CallOutcome, Lead, LeadStatus } from "./types";

export type DueBucket = "overdue" | "today" | "upcoming" | null;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getDueBucket(lead: Lead, now: Date): DueBucket {
  if (!lead.followUpAt) return null;
  const due = new Date(lead.followUpAt);
  if (due < now) return "overdue";
  if (due <= endOfDay(now)) return "today";
  return "upcoming";
}

const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "day", ms: 86_400_000 },
  { unit: "hour", ms: 3_600_000 },
  { unit: "minute", ms: 60_000 },
];

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** e.g. "13 minutes ago", "about 2 hours ago", "in 3 days" */
export function formatRelativeTime(iso: string, now: Date): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const absMs = Math.abs(diffMs);

  if (absMs < 60_000) return diffMs < 0 ? "just now" : "in a moment";

  for (const { unit, ms } of RELATIVE_UNITS) {
    if (absMs >= ms || unit === "minute") {
      const value = Math.round(diffMs / ms);
      return RTF.format(value, unit);
    }
  }
  return "";
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

export function formatDayLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const target = startOfDay(date);

  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
}

/** e.g. "Overdue - 2h ago", "Today, 3:30 pm", "Tomorrow, 9:00 am" */
export function formatDueLabel(iso: string, now: Date): string {
  const bucket = getDueBucket({ followUpAt: iso } as Lead, now);
  const clock = formatClockTime(iso);
  if (bucket === "overdue") return `Overdue - ${formatRelativeTime(iso, now)}`;
  return `${formatDayLabel(iso, now)}, ${clock}`;
}

/** Masks a phone number, keeping only the last 4 digits, e.g. "**** 5135" */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `**** ${digits.slice(-4)}`;
}

export interface SnoozePreset {
  id: string;
  label: string;
  until: string; // ISO
}

export function buildSnoozePresets(now: Date): SnoozePreset[] {
  const laterToday = new Date(now.getTime() + 3 * 3_600_000);
  const tomorrow9am = new Date(startOfDay(now).getTime() + 86_400_000 + 9 * 3_600_000);
  const in3Days9am = new Date(startOfDay(now).getTime() + 3 * 86_400_000 + 9 * 3_600_000);
  const nextWeek = new Date(startOfDay(now).getTime() + 7 * 86_400_000 + 9 * 3_600_000);

  return [
    { id: "later-today", label: "Later today (3h)", until: laterToday.toISOString() },
    { id: "tomorrow", label: "Tomorrow, 9:00 am", until: tomorrow9am.toISOString() },
    { id: "3-days", label: "In 3 days, 9:00 am", until: in3Days9am.toISOString() },
    { id: "next-week", label: "Next week, 9:00 am", until: nextWeek.toISOString() },
  ];
}

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  "no-answer": "No answer",
  "call-back": "Call back",
  interested: "Interested",
  "not-eligible": "Not eligible",
};

export interface CallOutcomeEffect {
  followUpAt: string | null;
  status?: LeadStatus;
  noteText: string;
}

/** Business rule: what happens to a lead's status / next follow-up after each call outcome. */
export function applyCallOutcome(outcome: CallOutcome, now: Date, currentStatus: LeadStatus): CallOutcomeEffect {
  switch (outcome) {
    case "no-answer":
      return {
        followUpAt: new Date(now.getTime() + 3 * 3_600_000).toISOString(),
        noteText: "Call outcome: No answer. Follow up in 3 hours.",
      };
    case "call-back":
      return {
        followUpAt: new Date(startOfDay(now).getTime() + 86_400_000 + 9 * 3_600_000).toISOString(),
        noteText: "Call outcome: Asked to call back tomorrow.",
      };
    case "interested":
      return {
        followUpAt: new Date(now.getTime() + 24 * 3_600_000).toISOString(),
        status: currentStatus === "new" || currentStatus === "assigned" || currentStatus === "no-response"
          ? "qualifying"
          : currentStatus,
        noteText: "Call outcome: Interested - moved to qualifying.",
      };
    case "not-eligible":
      return {
        followUpAt: null,
        status: "not-eligible",
        noteText: "Call outcome: Not eligible.",
      };
  }
}

export const MESSAGE_TEMPLATES: { id: string; label: string; text: string }[] = [
  { id: "intro", label: "Introduction", text: "Hi, this is Crawfort following up on your loan enquiry. When's a good time to chat?" },
  { id: "reminder", label: "Follow-up reminder", text: "Hi, just checking in - are you still interested in proceeding with your application?" },
  { id: "docs", label: "Request documents", text: "Hi, could you send over your latest payslip and NRIC to proceed with your application?" },
  { id: "booking", label: "Booking confirmation", text: "Your appointment has been confirmed. We look forward to seeing you!" },
];
