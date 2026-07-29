/**
 * Seeded mock data for the Retail CRM.
 * Everything resets on page refresh - no persistence.
 */

import type {
  RetailCustomer,
  Station,
  RetailLoan,
  AppointmentType,
  RetailApplication,
  ApplicationStatus,
  BorrowerType,
  ApprovedLoanOffer,
  RepaymentScheduleEntry,
} from "./types";

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
    "Reloan - existing customer",
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
    "Cash payment - bring receipt",
    "",
  ],
  "cash-disbursement": [
    "Loan disbursement pickup",
    "Approved loan cash release",
    "Disbursement - ID required",
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

  // Assign 1-3 customers per slot, mixed types
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
      assignedStaffId: null,
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
    nextPaymentDate: "-",
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
    nextPaymentDate: "-",
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

// ─── Applications (Applications tab) ───────────────────────────────────────────
// Customers self-register via the Crawfort website/app; this data simulates
// what gets synced back to the retail outlet for staff to review.

const APPLICANT_NAMES = [
  "Rafidah Binti Rashid", "Surendran S/O Subramaniam", "Shobenraj Selvarajah",
  "Jaya Ganesh S/O Krishnan", "Nurul Syahidah Rahman", "Junaidah Binte Rosli",
  "Salia Binti Samat", "Nur Hidayah Siew", "Mohammad Nor Bin Yusof",
  "Tan Chee Keong", "Lai Wen Cheng", "Mohd Hafidz Hidayat",
  "Soh Chiow Hin", "Bavanesh Raj S/O Muniandy", "Ling Joo Chin",
  "Ahmad Bin Sukandar", "Muhammed Khaidir Bin Zainal", "Toh Xiu Fang",
  "Liew Yew Lian", "Isaiah Huang Yanwei", "Kamalambigai D/O Ramasamy",
  "Farah Waheeda Binte Hamzah", "Lee Zhi Hao", "Vijayakumar S/O Muthu",
  "Nabilah Binte Yaacob", "Goh Poh Choo", "Sharifah Nurhaliza",
  "Karthik S/O Balasubramaniam", "Wong Li Ting", "Amirul Haziq Bin Zulkifli",
  "Cheong Wai Keat", "Devendran S/O Palani", "Aishah Binte Salleh",
  "Ong Hui Min", "Rosnah Binte Awang", "Sivakumar S/O Rajendran",
  "Teo Beng Hock", "Nur Amirah Binte Rosman", "Chua Kok Wai",
  "Priyanka D/O Suresh",
];

const AGENCIES = ["-", "-", "-", "-", "-", "-", "Straits Financial Partners", "ABC Credit Marketing", "Golden Bridge Agency"];

const PRODUCTS = ["Personal Loan", "Renovation Loan", "Debt Consolidation Loan", "Medical Loan", "Business Loan"];
const INCOME_DOC_TYPES = ["CPF", "Payslip", "Bank Statement", "Income Tax Assessment (NOA)"];
const OCCUPATIONS = ["Retail Associate", "Delivery Rider", "Admin Executive", "F&B Crew", "Technician", "Sales Executive", "Warehouse Assistant", "Security Officer", "Freelancer", "Customer Service Officer"];
const EMPLOYERS = ["FairPrice", "Grab", "SIA Engineering", "ST Engineering", "SATS Ltd", "NTUC Foodfare", "Shopee", "Self-Employed", "ComfortDelGro", "Prudential Assurance"];
const RESIDENTIAL_STATUSES = ["HDB Owner", "HDB Tenant", "Private Property Owner", "Living with Family", "Condo Tenant"];
const NATIONALITIES = ["Singaporean", "Singaporean", "Singaporean", "Singapore PR", "Malaysian"];
const RACES = ["Chinese", "Malay", "Indian", "Others"];
const LENDER_NAMES = ["Licensed Moneylender - Crawfort", "Licensed Moneylender - CashMax", "Bank Personal Loan", "Credit Card Revolving Balance", "Licensed Moneylender - QuickCash"];

const STATUS_CYCLE: ApplicationStatus[] = [
  "CREATE", "CREATE", "ELIGIBILITY", "ELIGIBILITY", "VERIFIED", "CREATE",
  "ELIGIBILITY", "E_SIGN", "CREATE", "ELIGIBILITY", "VERIFIED", "REJECTED",
];

/** Deterministic pseudo-random in [0, 1), seeded so mock data is stable across renders. */
function seededRand(seed: number): number {
  const x = Math.sin(seed * 999.123) * 10000;
  return x - Math.floor(x);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.floor(seededRand(seed) * arr.length) % arr.length];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateLabel(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatDateTimeLabel(d: Date): string {
  return `${formatDateLabel(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function makeApplicationId(index: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  let seed = index * 31 + 7;
  for (let i = 0; i < 8; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    out += chars[seed % chars.length];
  }
  return out;
}

function makeMaskedNric(seed: number): string {
  const prefix = pick(["S", "T", "F", "G"], seed);
  const digits = String(100 + Math.floor(seededRand(seed + 0.5) * 900)).padStart(3, "0");
  const suffix = pick(["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P"], seed + 0.7);
  return `${prefix}****${digits}${suffix}`;
}

function makeMaskedMobile(seed: number): string {
  const digits = String(1000 + Math.floor(seededRand(seed + 1.3) * 9000)).padStart(4, "0");
  return `****${digits}`;
}

/** Build a realistic, deterministic mock list of self-registered loan applications. */
export function buildInitialApplications(count: number = 132): RetailApplication[] {
  const applications: RetailApplication[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const seed = i + 1;
    const name = pick(APPLICANT_NAMES, seed).toUpperCase();
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
    const borrowerType: BorrowerType = seededRand(seed + 2.1) > 0.42 ? "BORROWER" : "APPLICANT";

    // Spread creation dates across the last ~14 days, most recent first.
    const daysAgo = Math.floor(i / 10);
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(9 + Math.floor(seededRand(seed) * 9), Math.floor(seededRand(seed + 3) * 60), Math.floor(seededRand(seed + 4) * 60), 0);
    const updatedAt = new Date(createdAt.getTime() + Math.floor(seededRand(seed + 5) * 5) * 1000 + 2000);

    const expectedAmount = Math.round((300 + seededRand(seed + 6) * 35700) / 100) * 100;

    const isRejected = status === "REJECTED";
    const hasFinalTerms = status === "E_SIGN";

    const monthlyIncomes = [1, 2, 3].map((n) => Math.round(800 + seededRand(seed + 10 + n) * 3500));
    const averageMonthlyIncome = Math.round((monthlyIncomes[0] + monthlyIncomes[1] + monthlyIncomes[2]) / 3 * 100) / 100;
    const annualIncome = Math.round(averageMonthlyIncome * 12 * 100) / 100;

    const docCount = 2 + Math.floor(seededRand(seed + 20) * 3);
    const baseDocNames = ["NRIC Front.jpg", "NRIC Back.jpg", "CPF Statement.pdf", "Latest Payslip.pdf", "Bank Statement.pdf", "Proof of Address.pdf"];
    const documents = Array.from({ length: docCount }, (_, di) => ({
      id: `doc-${seed}-${di}`,
      name: baseDocNames[di % baseDocNames.length],
      sizeLabel: `${(120 + Math.floor(seededRand(seed + 30 + di) * 900))} KB`,
      uploadedAt: formatDateTimeLabel(createdAt),
      uploadedBy: "Customer (Online)",
    }));

    const hasComment = seededRand(seed + 40) > 0.55;
    const comments = hasComment
      ? [{
          id: `comment-${seed}-0`,
          author: pick(["Staff: Aminah", "Staff: Rachel Ong", "Staff: Kumar", "Staff: Wei Ting"], seed + 41),
          timestamp: formatDateTimeLabel(new Date(updatedAt.getTime() + 3600_000)),
          text: pick([
            "Verified NRIC details against SingPass - matches records.",
            "Called customer to confirm income documents; awaiting resubmission.",
            "Employment letter looks outdated, requested a newer copy.",
            "Customer confirmed loan purpose is for renovation.",
          ], seed + 42),
        }]
      : [];

    const rejectedHistoryCount = isRejected ? 1 : (seededRand(seed + 50) > 0.85 ? 1 : 0);
    const rejectedHistory = Array.from({ length: rejectedHistoryCount }, (_, ri) => {
      const rejDate = new Date(createdAt.getTime() - (ri + 1) * 20 * 86_400_000);
      return {
        date: formatDateLabel(rejDate),
        applicationId: isRejected && ri === 0 ? makeApplicationId(i) : makeApplicationId(i + 500 + ri),
        reason: pick([
          "Insufficient income documentation",
          "Debt-to-income ratio exceeds policy threshold",
          "Unable to verify employment",
          "Existing overdue loan with another lender",
          "Customer withdrew application",
        ], seed + 51 + ri),
        reviewedBy: pick(["Aminah", "Rachel Ong", "Kumar", "Wei Ting"], seed + 52 + ri),
      };
    });

    const activeLoansCount = Math.floor(seededRand(seed + 60) * 3);
    const lenders: RetailApplication["mlcb"]["lenders"] = Array.from({ length: activeLoansCount + 1 }, (_, li) => ({
      lender: LENDER_NAMES[li % LENDER_NAMES.length],
      loanType: li === 0 ? "Personal Loan" : pick(["Renovation Loan", "Credit Line", "Term Loan"], seed + 61 + li),
      outstanding: Math.round(seededRand(seed + 62 + li) * 8000),
      status: seededRand(seed + 63 + li) > 0.85 ? "arrears" : (seededRand(seed + 64 + li) > 0.5 ? "current" : "closed"),
    }));

    applications.push({
      id: makeApplicationId(i),
      customerName: name,
      agency: pick(AGENCIES, seed + 70),
      borrowerType,
      idNumberMasked: makeMaskedNric(seed),
      mobileMasked: makeMaskedMobile(seed),
      createdAtLabel: formatDateLabel(createdAt),
      createdAtISO: createdAt.toISOString(),
      updatedAtLabel: formatDateLabel(updatedAt),
      expectedAmount,
      status,
      isInvalid: isRejected,

      createdAtTimeLabel: formatDateTimeLabel(createdAt),
      updatedAtTimeLabel: formatDateTimeLabel(updatedAt),
      registeredMobile: `9${String(1000000 + Math.floor(seededRand(seed + 80) * 8999999)).slice(0, 7)}`,
      secondaryMobile: seededRand(seed + 81) > 0.75 ? `8${String(1000000 + Math.floor(seededRand(seed + 82) * 8999999)).slice(0, 7)}` : null,
      riskLevel: status === "CREATE" ? null : pick(["Low", "Medium", "High"], seed + 83),
      creditLimit: status === "CREATE" ? null : Math.round(500 + seededRand(seed + 84) * 15000),

      loanExpectation: {
        amount: hasFinalTerms ? Math.round(expectedAmount * (0.8 + seededRand(seed + 90) * 0.2)) : null,
        product: hasFinalTerms ? pick(PRODUCTS, seed + 91) : null,
        installment: hasFinalTerms ? pick([6, 9, 12, 18, 24], seed + 92) : null,
        interestRate: hasFinalTerms ? pick(["4% flat/month", "3.5% flat/month", "1% reducing/month"], seed + 93) : null,
        processingFee: hasFinalTerms ? pick(["10%", "5%", "S$50 flat"], seed + 94) : null,
      },

      incomeInfo: {
        documentType: pick(INCOME_DOC_TYPES, seed + 100),
        monthlyIncomes,
        averageMonthlyIncome,
        annualIncome,
      },

      documents,
      comments,

      borrowerInfo: {
        fullName: name,
        nric: makeMaskedNric(seed),
        dateOfBirth: formatDateLabel(new Date(now.getFullYear() - 21 - Math.floor(seededRand(seed + 110) * 40), Math.floor(seededRand(seed + 111) * 12), 1 + Math.floor(seededRand(seed + 112) * 27))),
        gender: seededRand(seed + 113) > 0.5 ? "Male" : "Female",
        nationality: pick(NATIONALITIES, seed + 114),
        race: pick(RACES, seed + 115),
        maritalStatus: pick(["Single", "Married", "Divorced"], seed + 116),
        email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        address: `Blk ${10 + Math.floor(seededRand(seed + 117) * 500)} ${pick(["Ang Mo Kio Ave", "Tampines St", "Woodlands Dr", "Bedok North Rd", "Jurong West St", "Yishun Ring Rd"], seed + 118)} ${1 + Math.floor(seededRand(seed + 119) * 90)}, #${String(1 + Math.floor(seededRand(seed + 120) * 15)).padStart(2, "0")}-${String(1 + Math.floor(seededRand(seed + 121) * 500)).padStart(3, "0")}`,
        postalCode: String(460000 + Math.floor(seededRand(seed + 122) * 240000)),
        residentialStatus: pick(RESIDENTIAL_STATUSES, seed + 123),
        employmentStatus: pick(["Full-Time", "Part-Time", "Self-Employed", "Contract"], seed + 124),
        employerName: pick(EMPLOYERS, seed + 125),
        occupation: pick(OCCUPATIONS, seed + 126),
        employmentLength: pick(["<1 year", "1-2 years", "2-5 years", "5-10 years", ">10 years"], seed + 127),
        monthlyHouseholdIncome: Math.round(averageMonthlyIncome * (1.2 + seededRand(seed + 128) * 0.6)),
      },

      mlcb: {
        score: Math.round(300 + seededRand(seed + 130) * 550),
        reportDate: formatDateLabel(new Date(createdAt.getTime() - 86_400_000)),
        activeLoans: activeLoansCount,
        totalOutstanding: lenders.filter((l) => l.status !== "closed").reduce((sum, l) => sum + l.outstanding, 0),
        enquiriesLast6Months: Math.floor(seededRand(seed + 131) * 6),
        lenders,
      },

      rejectedHistory,
    });
  }

  return applications;
}

// ─── Approved loan offers (Loan Management tab) ────────────────────────────────

const LOAN_PRODUCT_NAMES = [
  "Personal Loan",
  "Renovation Loan",
  "Medical Loan",
  "Debt Consolidation Loan",
  "Education Loan",
];

/**
 * Generate one deterministic ApprovedLoanOffer per customer-care customer.
 * All other appointment types are ignored.
 */
export function buildApprovedLoanOffers(customers: RetailCustomer[]): Record<string, ApprovedLoanOffer> {
  const offers: Record<string, ApprovedLoanOffer> = {};
  let offerIdx = 0;

  customers.forEach((c) => {
    if (c.appointmentType !== "customer-care") return;

    const seed = offerIdx + 1;
    // Randomise max amount between $1,000 and $20,000 (rounded to nearest $100)
    const rawMax = 1000 + Math.floor(seededRand(seed * 7.3) * 19000);
    const maxAmount = Math.round(rawMax / 100) * 100;
    const minFraction = 0.30 + seededRand(seed * 3.1) * 0.10; // 30-40 %
    const minAmount = Math.round((maxAmount * minFraction) / 100) * 100;

    offers[c.id] = {
      customerId: c.id,
      productName: pick(LOAN_PRODUCT_NAMES, seed * 2.7),
      maxAmount,
      minAmount,
      defaultTenureMonths: 6,
      maxTenureMonths: 16,
      defaultInterestRate: 47,
      altInterestRate: 12,
      defaultProcessingFee: 10,
      minProcessingFee: 1,
    };

    offerIdx++;
  });

  return offers;
}

/**
 * Mutate the initial customers + stations arrays so that 3 of the customer-care
 * customers already appear "arrived" on page load (for a realistic demo).
 *
 * Chosen customers (by their deterministic schedule order):
 *   cust-2  → serving  @ room-1  (station occupied)
 *   cust-5  → called   @ room-2  (station calling)
 *   cust-9  → done     (station freed, so they still appear in the arrived list
 *                        but room column shows "-")
 */
export function seedArrivedCustomerCare(
  customers: RetailCustomer[],
  stations: Station[],
): void {
  // ── cust-2: serving at room-1 ────────────────────────────────────────────
  const c2 = customers.find((c) => c.id === "cust-2");
  const room1 = stations.find((s) => s.id === "room-1");
  if (c2 && room1) {
    c2.status = "serving";
    c2.assignedStationId = "room-1";
    c2.assignedStaffId = "staff-marcus-tan"; // present & serving
    c2.queuePosition = 0;
    room1.status = "occupied";
    room1.servingCustomerId = "cust-2";
  }

  // ── cust-5: called at room-2 ─────────────────────────────────────────────
  const c5 = customers.find((c) => c.id === "cust-5");
  const room2 = stations.find((s) => s.id === "room-2");
  if (c5 && room2) {
    c5.status = "called";
    c5.assignedStationId = "room-2";
    c5.assignedStaffId = "staff-rachel-ong"; // summoned, not checked in
    c5.queuePosition = 0;
    room2.status = "calling";
    room2.servingCustomerId = "cust-5";
  }

  // ── cust-9: done (station already freed) ────────────────────────────────
  const c9 = customers.find((c) => c.id === "cust-9");
  if (c9) {
    c9.status = "done";
    c9.assignedStaffId = "staff-priya-nair";
    c9.assignedStationId = null;
    c9.queuePosition = null;
  }
}

// ─── Repayment plan calculator ─────────────────────────────────────────────────

export interface RepaymentPlanResult {
  principal: number;
  totalInterest: number;
  totalRepayable: number;
  monthlyInstallment: number;
  processingFeeAmount: number;
  netDisbursement: number;
  schedule: RepaymentScheduleEntry[];
}

/**
 * Flat-rate amortisation used in the Repayment Plan Preview.
 *
 * @param principal     Loan amount in SGD
 * @param tenureMonths  Number of monthly instalments
 * @param annualRatePct Annual flat interest rate (e.g. 47 for 47%)
 * @param processingFeePct Processing fee as % of principal (e.g. 10 for 10%)
 */
export function computeRepaymentPlan(
  principal: number,
  tenureMonths: number,
  annualRatePct: number,
  processingFeePct: number,
): RepaymentPlanResult {
  const totalInterest = principal * (annualRatePct / 100) * (tenureMonths / 12);
  const totalRepayable = principal + totalInterest;
  const monthlyInstallment = totalRepayable / tenureMonths;

  const processingFeeAmount = principal * (processingFeePct / 100);
  const netDisbursement = principal - processingFeeAmount;

  // Equal principal + interest portions per instalment (flat rate)
  const principalPortion = principal / tenureMonths;
  const interestPortion = totalInterest / tenureMonths;

  // Build schedule starting the month after today
  const startDate = new Date();
  startDate.setDate(1); // align to 1st of month
  startDate.setMonth(startDate.getMonth() + 1);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const schedule: RepaymentScheduleEntry[] = [];

  for (let i = 0; i < tenureMonths; i++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i);
    const dueLabel = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const balance = Math.max(0, principal - principalPortion * (i + 1));

    schedule.push({
      month: i + 1,
      dueLabel,
      installment: monthlyInstallment,
      principalPortion,
      interestPortion,
      balance,
    });
  }

  return {
    principal,
    totalInterest,
    totalRepayable,
    monthlyInstallment,
    processingFeeAmount,
    netDisbursement,
    schedule,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
  }).format(amount);
}
