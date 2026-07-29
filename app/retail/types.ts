/**
 * Domain types for the Retail CRM — queue, floor plan, and loans.
 * All data is in-memory (mock only); resets on page refresh.
 */

export type AppointmentType =
  | "loan-application"
  | "customer-care"
  | "cash-repayment"
  | "cash-disbursement";

/** Lifecycle of a customer visit */
export type CustomerStatus =
  | "scheduled"  // appointment set, not yet assigned to a station
  | "queued"     // assigned and waiting in a station queue
  | "called"     // station is calling (yellow dot), customer not yet seated
  | "serving"    // currently being served (red dot)
  | "done";      // service completed

export type StationStatus = "free" | "calling" | "occupied";
export type StationType = "kiosk" | "room" | "cashier";

export type RetailTab = "queue" | "registration" | "loans";

/** Ascend status — only used for loan-application appointments */
export type AscendStatus = "eligible" | "create";

export interface RetailCustomer {
  id: string;
  name: string;
  mobile: string;
  nricLast4: string;
  appointmentType: AppointmentType;
  /** "HH:MM" 24-hour string, e.g. "10:30" */
  slotTime: string;
  status: CustomerStatus;
  assignedStationId: string | null;
  /** Position in the station's waiting queue (0 = being called/served) */
  queuePosition: number | null;
  /** Unique queue ticket for today, e.g. "L001", "C002", "P001" */
  queueNumber: string;
  notes: string;
  isWalkIn: boolean;
  /** Set for loan appointments only */
  ascendStatus: AscendStatus | null;
}

export interface Station {
  /** "kiosk-1" … "kiosk-10", "room-1" … "room-6", "cashier-1" */
  id: string;
  type: StationType;
  /** Human label, e.g. "Kiosk 1" */
  label: string;
  status: StationStatus;
  /** ID of the customer currently being called or served */
  servingCustomerId: string | null;
  /** IDs of customers waiting to be called next at this station */
  queuedCustomerIds: string[];
}

/** Layout position hint for the floor plan renderer */
export interface StationLayoutMeta {
  id: string;
  gridArea?: string;
  row: number;
  col: number;
}

/** Retail loan record used in the Loan Management tab */
export interface RetailLoan {
  loanId: string;
  customerName: string;
  nric: string;
  mobile: string;
  status: "active" | "overdue" | "completed";
  principalAmount: number;
  outstandingBalance: number;
  monthlyPayment: number;
  interestRate: number;
  tenure: number;
  startDate: string;
  nextPaymentDate: string;
  nextPaymentAmount: number;
  paymentsCompleted: number;
  totalPayments: number;
  overdueAmount?: number;
  overdueDays?: number;
  loanPurpose: string;
  paymentSchedule: { date: string; amount: number; status: "paid" | "upcoming" | "overdue" }[];
}
