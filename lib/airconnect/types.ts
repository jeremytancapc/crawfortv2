/**
 * Domain types for AirConnect - the call-centre agent CRM.
 * All data is in-memory (mock only); resets on page refresh.
 */

export type AgentId = "agent-a" | "agent-b" | "agent-c";

export interface Agent {
  id: AgentId;
  name: string;
  initials: string;
  colorHex: string;
}

export type LeadStatus =
  | "new"
  | "assigned"
  | "no-response"
  | "qualifying"
  | "pending-booking"
  | "booked"
  | "not-eligible"
  | "done";

export type LeadSource =
  | "SEO"
  | "1% Loan"
  | "MoneyRight"
  | "Lendela"
  | "Loanable"
  | "Referral";

export type CallOutcome = "no-answer" | "call-back" | "interested" | "not-eligible";

export type NoteKind = "note" | "call" | "message" | "booking" | "status" | "snooze";

export interface NoteEntry {
  id: string;
  kind: NoteKind;
  text: string;
  authorId: AgentId;
  createdAt: string; // ISO timestamp
}

export interface Appointment {
  id: string;
  dateISO: string; // ISO date, e.g. "2026-08-17"
  timeLabel: string; // e.g. "10:30 am"
  createdAt: string; // ISO timestamp
}

export interface Lead {
  id: string;
  name: string;
  phone: string; // full mock phone number, e.g. "+65 9123 5135"
  status: LeadStatus;
  agentId: AgentId;
  source: LeadSource;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  /** Next follow-up due time. Null once done / not-eligible, or has no pending action. */
  followUpAt: string | null;
  appointment: Appointment | null;
  notes: NoteEntry[];
  loanAmountLabel: string | null;
}

export type ViewMode = "queue" | "pipeline" | "table";

export interface ActivityCounts {
  calls: number;
  notes: number;
  messages: number;
  booked: number;
}

export interface Toast {
  id: string;
  message: string;
  kind: "snooze" | "done" | "info" | "booking" | "status";
  createdAt: number;
  /** Snapshot of the lead before the action, for one-click undo. Undefined = not undoable. */
  undoSnapshot?: Lead;
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  assigned: "Assigned",
  "no-response": "No Response",
  qualifying: "Qualifying",
  "pending-booking": "Pending Booking",
  booked: "Booked",
  "not-eligible": "Not Eligible",
  done: "Done",
};

export const STATUS_ORDER: LeadStatus[] = [
  "new",
  "assigned",
  "no-response",
  "qualifying",
  "pending-booking",
  "booked",
  "not-eligible",
  "done",
];

/** Statuses that keep a lead actively worked in the daily queue. */
export const ACTIVE_QUEUE_STATUSES: LeadStatus[] = [
  "new",
  "assigned",
  "no-response",
  "qualifying",
  "pending-booking",
  "booked",
];
