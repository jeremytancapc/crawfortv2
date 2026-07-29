/**
 * Domain types for the Retail CRM - queue, floor plan, and loans.
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

export type RetailTab = "queue" | "applications" | "loans";

/** Ascend status - only used for loan-application appointments */
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
  /**
   * Officer allocated to attend this customer at a room/cashier.
   * Null for kiosk (self-service) or when not yet called.
   */
  assignedStaffId: string | null;
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

/**
 * Staff call-to-station alert. Created when a customer is assigned to a free
 * station (status → calling) so the allocated officer knows where to go.
 */
export interface StaffAlert {
  id: string;
  customerId: string;
  stationId: string;
  /** Mock staff id - currently always the logged-in officer */
  staffId: string;
  createdAt: string;
}

/** Layout position hint for the floor plan renderer */
export interface StationLayoutMeta {
  id: string;
  gridArea?: string;
  row: number;
  col: number;
}

// ─── Loan Management - approved offer & plan override ─────────────────────────

/**
 * Pre-approved loan offer generated for each customer-care appointment.
 * Represents the loan terms the underwriter has already cleared; staff can
 * adjust within policy limits (or with a staff override code).
 */
export interface ApprovedLoanOffer {
  customerId: string;
  productName: string;
  /** Randomised per customer - hard ceiling on amount; cannot go higher even with override. */
  maxAmount: number;
  /** Minimum permissible disbursement (≈ 30-40 % of max). */
  minAmount: number;
  /** Default tenure in months (6). Staff can shorten freely; lengthening requires override. */
  defaultTenureMonths: number;
  /** Hard ceiling for tenure (16). */
  maxTenureMonths: number;
  /** Default annual flat interest rate (47). Changing to alt requires override. */
  defaultInterestRate: number;
  /** Alternative (lower) interest rate available only with override (12). */
  altInterestRate: number;
  /** Default processing fee as % of principal (10). Any lower value requires override. */
  defaultProcessingFee: number;
  /** Minimum selectable processing fee (1). */
  minProcessingFee: number;
}

/** Staff's final loan-plan selection for a customer, saved after confirmation. */
export interface ConfirmedLoanPlan {
  customerId: string;
  amount: number;
  tenureMonths: number;
  interestRate: number;
  processingFee: number;
  confirmedAt: string; // ISO timestamp
}

/** One row in a flat-rate repayment schedule. */
export interface RepaymentScheduleEntry {
  month: number;
  /** Human label, e.g. "Aug 2026" */
  dueLabel: string;
  installment: number;
  principalPortion: number;
  interestPortion: number;
  balance: number;
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

/**
 * Applications tab - customers self-register via the Crawfort website/app.
 * This data is read-only from the retail outlet's perspective (synced from
 * the online origination system); staff can only review it and flag entries
 * invalid, add comments, or attach supporting documents.
 */
export type ApplicationStatus = "CREATE" | "VERIFIED" | "ELIGIBILITY" | "E_SIGN" | "REJECTED";
export type BorrowerType = "BORROWER" | "APPLICANT";

export interface ApplicationDocument {
  id: string;
  name: string;
  sizeLabel: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ApplicationComment {
  id: string;
  author: string;
  timestamp: string;
  text: string;
}

export interface RejectedHistoryEntry {
  date: string;
  applicationId: string;
  reason: string;
  reviewedBy: string;
}

export interface MlcbLenderRecord {
  lender: string;
  loanType: string;
  outstanding: number;
  status: "current" | "arrears" | "closed";
}

export interface RetailApplication {
  id: string; // e.g. "3BRZBCAP"
  customerName: string;
  agency: string;
  borrowerType: BorrowerType;
  idNumberMasked: string; // e.g. "S****717B"
  mobileMasked: string; // e.g. "****7681"
  createdAtLabel: string; // e.g. "29/07/2026"
  createdAtISO: string;
  updatedAtLabel: string;
  expectedAmount: number;
  status: ApplicationStatus;
  isInvalid: boolean;

  createdAtTimeLabel: string; // e.g. "29/07/2026 11:04:30"
  updatedAtTimeLabel: string;
  registeredMobile: string;
  secondaryMobile: string | null;
  riskLevel: string | null;
  creditLimit: number | null;

  loanExpectation: {
    amount: number | null;
    product: string | null;
    installment: number | null;
    interestRate: string | null;
    processingFee: string | null;
  };

  incomeInfo: {
    documentType: string;
    monthlyIncomes: number[];
    averageMonthlyIncome: number;
    annualIncome: number;
  };

  documents: ApplicationDocument[];
  comments: ApplicationComment[];

  borrowerInfo: {
    fullName: string;
    nric: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    race: string;
    maritalStatus: string;
    email: string;
    address: string;
    postalCode: string;
    residentialStatus: string;
    employmentStatus: string;
    employerName: string;
    occupation: string;
    employmentLength: string;
    monthlyHouseholdIncome: number;
  };

  mlcb: {
    score: number;
    reportDate: string;
    activeLoans: number;
    totalOutstanding: number;
    enquiriesLast6Months: number;
    lenders: MlcbLenderRecord[];
  };

  rejectedHistory: RejectedHistoryEntry[];
}
