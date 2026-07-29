/**
 * Seeded mock data for the Retail CRM.
 * Everything resets on page refresh — no persistence.
 */

import type { RetailCustomer, Station, RetailLoan, AppointmentType } from "./types";

// ─── Time slots (matches booking component convention) ────────────────────────

export const TIME_SLOTS = [
  "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00",
  "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00",
  "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00",
];

// ─── Stations ─────────────────────────────────────────────────────────────────

export function buildInitialStations(): Station[] {
  const stations: Station[] = [];

  for (let i = 1; i <= 10; i++) {
    stations.push({
      id: `kiosk-${i}`,
      type: "kiosk",
      label: `Kiosk ${i}`,
      status: "free",
      servingCustomerId: null,
      queuedCustomerIds: [],
    });
  }

  for (let i = 1; i <= 6; i++) {
    stations.push({
      id: `room-${i}`,
      type: "room",
      label: `Room ${i}`,
      status: "free",
      servingCustomerId: null,
      queuedCustomerIds: [],
    });
  }

  stations.push({
    id: "cashier-1",
    type: "cashier",
    label: "Cashier",
    status: "free",
    servingCustomerId: null,
    queuedCustomerIds: [],
  });

  return stations;
}

// ─── Customers ────────────────────────────────────────────────────────────────

const SG_NAMES = [
  "Tan Wei Liang", "Lim Hui Ling", "Ahmad Bin Rashid", "Priya Devi",
  "Chen Jian Xin", "Sarah Lim", "David Ong", "Siti Noor Binte Hassan",
  "Rajesh Kumar", "Ng Boon Kiat", "Fatimah Binte Ali", "Wong Kah Meng",
  "Mohamad Faris", "Jessica Teo", "Kevin Chua", "Aisha Begum",
  "Eric Tan", "Michelle Lee", "Suresh Ananthan", "Lydia Ho",
  "Marcus Wong", "Nurul Ain", "Benjamin Yeo", "Vandana Pillai",
];

const NOTES_BY_TYPE: Record<AppointmentType, string[]> = {
  "loan-application": [
    "New loan enquiry, first-time borrower",
    "Reloan — existing customer",
    "SingPass verified, docs ready",
    "Referred by friend, needs assessment",
    "",
  ],
  "customer-care": [
    "Enquiry about early repayment",
    "Dispute on interest charges",
    "Change of contact details",
    "General account enquiry",
    "",
  ],
  "cash-repayment": [
    "Monthly instalment payment",
    "Partial settlement",
    "Cash payment — bring receipt",
    "",
  ],
  "cash-disbursement": [
    "Loan disbursement pickup",
    "Approved loan cash release",
    "Disbursement — ID required",
    "",
  ],
};

function pickNotes(type: AppointmentType, idx: number): string {
  const arr = NOTES_BY_TYPE[type];
  return arr[idx % arr.length];
}

function queuePrefix(type: AppointmentType): string {
  switch (type) {
    case "loan-application":  return "L";
    case "customer-care":     return "C";
    case "cash-repayment":    return "P";
    case "cash-disbursement": return "D";
  }
}

/** Generate a deterministic but realistic spread of appointments for today */
export function buildInitialCustomers(): RetailCustomer[] {
  const customers: RetailCustomer[] = [];
  const counters: Record<string, number> = { L: 0, C: 0, P: 0, D: 0 };

  // Assign 1–3 customers per slot, mixed types
  const schedule: Array<{ slot: string; type: AppointmentType; nameIdx: number }> = [
    { slot: "10:30", type: "loan-application",   nameIdx: 0  },
    { slot: "10:30", type: "customer-care",       nameIdx: 1  },
    { slot: "11:00", type: "loan-application",   nameIdx: 2  },
    { slot: "11:00", type: "cash-repayment",     nameIdx: 3  },
    { slot: "11:30", type: "customer-care",       nameIdx: 4  },
    { slot: "11:30", type: "loan-application",   nameIdx: 5  },
    { slot: "12:00", type: "cash-disbursement",  nameIdx: 6  },
    { slot: "12:30", type: "cash-repayment",     nameIdx: 7  },
    { slot: "12:30", type: "customer-care",       nameIdx: 8  },
    { slot: "13:00", type: "loan-application",   nameIdx: 9  },
    { slot: "13:30", type: "customer-care",       nameIdx: 10 },
    { slot: "13:30", type: "cash-disbursement",  nameIdx: 11 },
    { slot: "14:00", type: "cash-repayment",     nameIdx: 12 },
    { slot: "14:00", type: "loan-application",   nameIdx: 13 },
    { slot: "14:30", type: "customer-care",       nameIdx: 14 },
    { slot: "15:00", type: "loan-application",   nameIdx: 15 },
    { slot: "15:00", type: "cash-disbursement",  nameIdx: 16 },
    { slot: "15:30", type: "customer-care",       nameIdx: 17 },
    { slot: "16:00", type: "loan-application",   nameIdx: 18 },
    { slot: "16:30", type: "customer-care",       nameIdx: 19 },
    { slot: "17:00", type: "loan-application",   nameIdx: 20 },
    { slot: "17:00", type: "cash-repayment",     nameIdx: 21 },
    { slot: "17:30", type: "cash-disbursement",  nameIdx: 22 },
    { slot: "18:00", type: "loan-application",   nameIdx: 23 },
  ];

  schedule.forEach(({ slot, type, nameIdx }, i) => {
    const prefix = queuePrefix(type);
    counters[prefix]++;
    const num = String(counters[prefix]).padStart(3, "0");

    customers.push({
      id: `cust-${i + 1}`,
      name: SG_NAMES[nameIdx % SG_NAMES.length],
      mobile: `+65 9${String(8000 + i).padStart(3, "0")} ${String(1000 + i * 7).padStart(4, "0")}`,
      nricLast4: `${String.fromCharCode(65 + (i % 26))}${String(100 + i).slice(-3)}${String.fromCharCode(65 + ((i * 3) % 26))}`,
      appointmentType: type,
      slotTime: slot,
      status: "scheduled",
      assignedStationId: null,
      queuePosition: null,
      queueNumber: `${prefix}${num}`,
      notes: pickNotes(type, i),
      isWalkIn: false,
      // Alternate Ascend status for loan appointments; null for others
      ascendStatus:
        type === "loan-application"
          ? (counters[prefix] % 2 === 1 ? "eligible" : "create")
          : null,
    });
  });

  return customers;
}

// ─── Retail Loans ─────────────────────────────────────────────────────────────

export const RETAIL_LOANS: RetailLoan[] = [
  {
    loanId: "379GKMAK",
    customerName: "Tan Wei Liang",
    nric: "S••••345D",
    mobile: "+65 9123 4567",
    status: "active",
    principalAmount: 5000,
    outstandingBalance: 3312.80,
    monthlyPayment: 331.31,
    interestRate: 4,
    tenure: 18,
    startDate: "15 Oct 2023",
    nextPaymentDate: "15 Aug 2026",
    nextPaymentAmount: 331.31,
    paymentsCompleted: 10,
    totalPayments: 18,
    loanPurpose: "Personal",
    paymentSchedule: [
      { date: "15 Jun 2025", amount: 331.31, status: "paid" },
      { date: "15 Jul 2025", amount: 331.31, status: "paid" },
      { date: "15 Aug 2025", amount: 331.31, status: "paid" },
      { date: "15 Sep 2025", amount: 331.31, status: "paid" },
      { date: "15 Oct 2025", amount: 331.31, status: "paid" },
      { date: "15 Nov 2025", amount: 331.31, status: "paid" },
      { date: "15 Dec 2025", amount: 331.31, status: "paid" },
      { date: "15 Jan 2026", amount: 331.31, status: "paid" },
      { date: "15 Feb 2026", amount: 331.31, status: "paid" },
      { date: "15 Mar 2026", amount: 331.31, status: "paid" },
      { date: "15 Aug 2026", amount: 331.31, status: "upcoming" },
      { date: "15 Sep 2026", amount: 331.31, status: "upcoming" },
      { date: "15 Oct 2026", amount: 331.31, status: "upcoming" },
    ],
  },
  {
    loanId: "8008636E",
    customerName: "Lim Hui Ling",
    nric: "T••••892F",
    mobile: "+65 8234 5678",
    status: "active",
    principalAmount: 3000,
    outstandingBalance: 1800.00,
    monthlyPayment: 200.00,
    interestRate: 4,
    tenure: 18,
    startDate: "20 Jan 2025",
    nextPaymentDate: "20 Aug 2026",
    nextPaymentAmount: 200.00,
    paymentsCompleted: 9,
    totalPayments: 18,
    loanPurpose: "Business",
    paymentSchedule: [
      { date: "20 Jan 2025", amount: 200.00, status: "paid" },
      { date: "20 Feb 2025", amount: 200.00, status: "paid" },
      { date: "20 Mar 2025", amount: 200.00, status: "paid" },
      { date: "20 Apr 2025", amount: 200.00, status: "paid" },
      { date: "20 May 2025", amount: 200.00, status: "paid" },
      { date: "20 Jun 2025", amount: 200.00, status: "paid" },
      { date: "20 Jul 2025", amount: 200.00, status: "paid" },
      { date: "20 Aug 2025", amount: 200.00, status: "paid" },
      { date: "20 Sep 2025", amount: 200.00, status: "paid" },
      { date: "20 Aug 2026", amount: 200.00, status: "upcoming" },
      { date: "20 Sep 2026", amount: 200.00, status: "upcoming" },
    ],
  },
  {
    loanId: "4KX29WQR",
    customerName: "Ahmad Bin Rashid",
    nric: "S••••112G",
    mobile: "+65 9345 6789",
    status: "overdue",
    principalAmount: 2000,
    outstandingBalance: 650.00,
    monthlyPayment: 216.67,
    interestRate: 4,
    tenure: 12,
    startDate: "10 Jun 2025",
    nextPaymentDate: "10 Apr 2026",
    nextPaymentAmount: 650.00,
    paymentsCompleted: 9,
    totalPayments: 12,
    overdueAmount: 650.00,
    overdueDays: 35,
    loanPurpose: "Medical",
    paymentSchedule: [
      { date: "10 Jun 2025", amount: 216.67, status: "paid" },
      { date: "10 Jul 2025", amount: 216.67, status: "paid" },
      { date: "10 Aug 2025", amount: 216.67, status: "paid" },
      { date: "10 Sep 2025", amount: 216.67, status: "paid" },
      { date: "10 Oct 2025", amount: 216.67, status: "paid" },
      { date: "10 Nov 2025", amount: 216.67, status: "paid" },
      { date: "10 Dec 2025", amount: 216.67, status: "paid" },
      { date: "10 Jan 2026", amount: 216.67, status: "paid" },
      { date: "10 Feb 2026", amount: 216.67, status: "paid" },
      { date: "10 Mar 2026", amount: 216.67, status: "overdue" },
      { date: "10 Apr 2026", amount: 216.67, status: "overdue" },
      { date: "10 May 2026", amount: 216.67, status: "overdue" },
    ],
  },
  {
    loanId: "QR5529PX",
    customerName: "Priya Devi",
    nric: "S••••443H",
    mobile: "+65 9456 7890",
    status: "active",
    principalAmount: 4500,
    outstandingBalance: 2700.00,
    monthlyPayment: 300.00,
    interestRate: 4,
    tenure: 15,
    startDate: "5 Feb 2026",
    nextPaymentDate: "5 Aug 2026",
    nextPaymentAmount: 300.00,
    paymentsCompleted: 6,
    totalPayments: 15,
    loanPurpose: "Home Improvement",
    paymentSchedule: [
      { date: "5 Feb 2026", amount: 300.00, status: "paid" },
      { date: "5 Mar 2026", amount: 300.00, status: "paid" },
      { date: "5 Apr 2026", amount: 300.00, status: "paid" },
      { date: "5 May 2026", amount: 300.00, status: "paid" },
      { date: "5 Jun 2026", amount: 300.00, status: "paid" },
      { date: "5 Jul 2026", amount: 300.00, status: "paid" },
      { date: "5 Aug 2026", amount: 300.00, status: "upcoming" },
      { date: "5 Sep 2026", amount: 300.00, status: "upcoming" },
      { date: "5 Oct 2026", amount: 300.00, status: "upcoming" },
    ],
  },
  {
    loanId: "NX8812BJ",
    customerName: "Ng Boon Kiat",
    nric: "T••••771K",
    mobile: "+65 8123 4567",
    status: "active",
    principalAmount: 1500,
    outstandingBalance: 600.00,
    monthlyPayment: 125.00,
    interestRate: 4,
    tenure: 12,
    startDate: "1 Dec 2025",
    nextPaymentDate: "1 Aug 2026",
    nextPaymentAmount: 125.00,
    paymentsCompleted: 8,
    totalPayments: 12,
    loanPurpose: "Education",
    paymentSchedule: [
      { date: "1 Dec 2025", amount: 125.00, status: "paid" },
      { date: "1 Jan 2026", amount: 125.00, status: "paid" },
      { date: "1 Feb 2026", amount: 125.00, status: "paid" },
      { date: "1 Mar 2026", amount: 125.00, status: "paid" },
      { date: "1 Apr 2026", amount: 125.00, status: "paid" },
      { date: "1 May 2026", amount: 125.00, status: "paid" },
      { date: "1 Jun 2026", amount: 125.00, status: "paid" },
      { date: "1 Jul 2026", amount: 125.00, status: "paid" },
      { date: "1 Aug 2026", amount: 125.00, status: "upcoming" },
      { date: "1 Sep 2026", amount: 125.00, status: "upcoming" },
      { date: "1 Oct 2026", amount: 125.00, status: "upcoming" },
    ],
  },
  {
    loanId: "CMP7731X",
    customerName: "Wong Kah Meng",
    nric: "S••••229M",
    mobile: "+65 9234 5678",
    status: "completed",
    principalAmount: 1500,
    outstandingBalance: 0,
    monthlyPayment: 166.67,
    interestRate: 4,
    tenure: 12,
    startDate: "5 Mar 2023",
    nextPaymentDate: "—",
    nextPaymentAmount: 0,
    paymentsCompleted: 12,
    totalPayments: 12,
    loanPurpose: "Renovation",
    paymentSchedule: [],
  },
  {
    loanId: "CMP5509B",
    customerName: "Siti Noor Binte Hassan",
    nric: "T••••558N",
    mobile: "+65 8345 6789",
    status: "completed",
    principalAmount: 800,
    outstandingBalance: 0,
    monthlyPayment: 88.89,
    interestRate: 4,
    tenure: 10,
    startDate: "12 Jan 2022",
    nextPaymentDate: "—",
    nextPaymentAmount: 0,
    paymentsCompleted: 10,
    totalPayments: 10,
    loanPurpose: "Personal",
    paymentSchedule: [],
  },
  {
    loanId: "OVD3341W",
    customerName: "Mohamad Faris",
    nric: "S••••667P",
    mobile: "+65 9567 8901",
    status: "overdue",
    principalAmount: 3500,
    outstandingBalance: 1400.00,
    monthlyPayment: 233.33,
    interestRate: 4,
    tenure: 15,
    startDate: "15 Mar 2025",
    nextPaymentDate: "15 Mar 2026",
    nextPaymentAmount: 1400.00,
    paymentsCompleted: 9,
    totalPayments: 15,
    overdueAmount: 700.00,
    overdueDays: 18,
    loanPurpose: "Vehicle",
    paymentSchedule: [
      { date: "15 Mar 2025", amount: 233.33, status: "paid" },
      { date: "15 Apr 2025", amount: 233.33, status: "paid" },
      { date: "15 May 2025", amount: 233.33, status: "paid" },
      { date: "15 Jun 2025", amount: 233.33, status: "paid" },
      { date: "15 Jul 2025", amount: 233.33, status: "paid" },
      { date: "15 Aug 2025", amount: 233.33, status: "paid" },
      { date: "15 Sep 2025", amount: 233.33, status: "paid" },
      { date: "15 Oct 2025", amount: 233.33, status: "paid" },
      { date: "15 Nov 2025", amount: 233.33, status: "paid" },
      { date: "15 Mar 2026", amount: 233.33, status: "overdue" },
      { date: "15 Apr 2026", amount: 233.33, status: "overdue" },
      { date: "15 May 2026", amount: 233.33, status: "upcoming" },
      { date: "15 Jun 2026", amount: 233.33, status: "upcoming" },
    ],
  },
];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
  }).format(amount);
}
