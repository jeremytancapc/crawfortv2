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

export type ResidencyTag = "sg-pr" | "foreigner";
export type EmploymentTag = "employed" | "self-employed";
export type IncomeDocTag = "cpf" | "noa" | "payslip" | "bank-statement";
/** Extra supporting docs only collected for foreign-national leads. */
export type ForeignerDocTag = "por" | "wp-over-3m";

export type OutstandingTag =
  | { kind: "none" }
  | { kind: "amount"; label: string };

export type EligibilityTag =
  | "ascend-approved"
  | "ascend-pending-docs"
  | "h5-approved-with-appt"
  | "h5-approved-without-appt"
  | "h5-system-rejected"
  | "h5-customer-reject"
  | "h5-customer-never-completed";

/** Submitted to Ascend or H5 (excludes never-completed). */
export const SUBMITTED_ELIGIBILITY_TAGS: readonly EligibilityTag[] = [
  "ascend-approved",
  "ascend-pending-docs",
  "h5-approved-with-appt",
  "h5-approved-without-appt",
  "h5-system-rejected",
  "h5-customer-reject",
];

export function isAscendH5Submitted(eligibility: EligibilityTag | null): boolean {
  return eligibility !== null && (SUBMITTED_ELIGIBILITY_TAGS as readonly string[]).includes(eligibility);
}

export interface LeadTags {
  residency: ResidencyTag | null;
  employment: EmploymentTag | null;
  incomeDocs: IncomeDocTag[];
  /** Only meaningful when residency is "foreigner". */
  foreignerDocs: ForeignerDocTag[];
  outstanding: OutstandingTag | null;
  /** Free-typed monthly income, e.g. "4,500". */
  monthlyIncome: string | null;
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
  tags: LeadTags;
  eligibility: EligibilityTag | null;
  /** Only set when status is "qualifying" - why the lead is stalled there. */
  qualifyingReason: QualifyingReason | null;
  /** What's currently blocking the deal, shown as the live talking point for the agent. */
  painPoint: string | null;
  /** AI-drafted reply addressing the pain point, ready to copy or send as-is. */
  aiSuggestedReply: string | null;
  /** Why the lead was closed out as not-eligible - set via the "close reason" menu. */
  closeReason: CloseReason | null;
}

export type ViewMode = "queue" | "pipeline" | "table";

/** Primary queue chips for today's work. */
export type QueueTypeFilter = "all" | "assigned" | "qualifying" | "submitted";

/** Why a "qualifying" lead hasn't converted yet - drill-down chips under the Qualifying filter. */
export type QualifyingReason = "no-reply" | "interest-rate-fees" | "bad-timing" | "didnt-book";

export type QualifyingReasonFilter = "all" | QualifyingReason;

export const QUALIFYING_REASON_LABELS: Record<QualifyingReason, string> = {
  "no-reply": "No Reply",
  "interest-rate-fees": "Interest Rate / Fees",
  "bad-timing": "Bad Timing",
  "didnt-book": "Didn't Book",
};

/** Why a lead is closed out for good - sets status to "not-eligible" when chosen. */
export type CloseReason =
  | "blacklisted-invalid-number"
  | "blacklisted-do-not-call"
  | "blacklisted-bankrupt"
  | "blacklisted-existing-customer"
  | "blacklisted-foreigner-not-eligible"
  | "blacklisted-others"
  | "give-up-already-got-loan"
  | "give-up-high-outstanding-loan"
  | "give-up-income-too-low"
  | "give-up-not-interested"
  | "give-up-not-keen-with-ml"
  | "give-up-no-income-proof"
  | "give-up-trouble-maker"
  | "give-up-underage"
  | "give-up-unemployed"
  | "give-up-others";

export const CLOSE_REASON_ORDER: CloseReason[] = [
  "blacklisted-invalid-number",
  "blacklisted-do-not-call",
  "blacklisted-bankrupt",
  "blacklisted-existing-customer",
  "blacklisted-foreigner-not-eligible",
  "blacklisted-others",
  "give-up-already-got-loan",
  "give-up-high-outstanding-loan",
  "give-up-income-too-low",
  "give-up-not-interested",
  "give-up-not-keen-with-ml",
  "give-up-no-income-proof",
  "give-up-trouble-maker",
  "give-up-underage",
  "give-up-unemployed",
  "give-up-others",
];

export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  "blacklisted-invalid-number": "Blacklisted - Did Not Apply / Wrong Number",
  "blacklisted-do-not-call": "Blacklisted - Do Not Call",
  "blacklisted-bankrupt": "Blacklisted - DRS / Bankrupt",
  "blacklisted-existing-customer": "Blacklisted - Existing Customer",
  "blacklisted-foreigner-not-eligible": "Blacklisted - Foreigner - Not Eligible",
  "blacklisted-others": "Blacklisted - Others",
  "give-up-already-got-loan": "Give Up - Already Got Loan",
  "give-up-high-outstanding-loan": "Give Up - High Outstanding Loan",
  "give-up-income-too-low": "Give Up - Income Too Low",
  "give-up-not-interested": "Give Up - Not Interested",
  "give-up-not-keen-with-ml": "Give Up - Not Keen with ML",
  "give-up-no-income-proof": "Give Up - No Income Proof",
  "give-up-trouble-maker": "Give Up - Trouble Maker",
  "give-up-underage": "Give Up - Underage",
  "give-up-unemployed": "Give Up - Unemployed",
  "give-up-others": "Give Up - Others",
};

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
