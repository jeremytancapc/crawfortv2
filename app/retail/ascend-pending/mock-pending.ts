/**
 * Example data for the Ascend PENDING queue.
 * Mock only - resets on page refresh. Mirrors the shape of an
 * /openApi/apply/credit response joined onto the lead that produced it.
 */

export type PendingReason =
  | "income_unverified"
  | "mlcb_below_request"
  | "manual_review"
  | "document_required";

export interface AscendPendingApplication {
  /** Our lead id - shortened for display as CFH5-XXXXXXXX. */
  leadId: string;
  /** Ascend order id, returned by /openApi/apply/credit. */
  orderId: string;
  fullName: string;
  /** Last 4 of NRIC/FIN only - never the full identifier on an ops screen. */
  nricLast4: string;
  mobile: string;
  /** false when Ascend reports the applicant has borrowed before. */
  newCustomer: boolean;
  /** What the applicant asked for at the landing gate. */
  desiredAmount: number;
  /** Ascend creditScore.creditLimit - the A-Card Limit. */
  acardLimit: number;
  /** Ascend creditScore.mlcbMaxLoanAmount - the Maximum Loan Quantum. */
  mlcbMaxLoanAmount: number;
  /** Our own income engine's figure, kept for comparison. */
  underwrittenCap: number;
  /** Ascend risk.riskMsg, verbatim. */
  riskMsg: string;
  reason: PendingReason;
  /** ISO timestamp of the submit that produced this order. */
  submittedAt: string;
}

export const PENDING_REASON_LABELS: Record<PendingReason, string> = {
  income_unverified: "Income not verified",
  mlcb_below_request: "MLCB below request",
  manual_review: "Manual review",
  document_required: "Document required",
};

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

export const MOCK_PENDING: AscendPendingApplication[] = [
  {
    leadId: "3f9a1c22-0f11-4a63-9c02-7b8d5e14aa91",
    orderId: "1523633858296446976",
    fullName: "Tan W. H.",
    nricLast4: "567D",
    mobile: "+65 9123 4567",
    newCustomer: true,
    desiredAmount: 8000,
    acardLimit: 5200,
    mlcbMaxLoanAmount: 12000,
    underwrittenCap: 6400,
    riskMsg: "CPF contributions from platform operator; income requires manual verification.",
    reason: "income_unverified",
    submittedAt: hoursAgo(29),
  },
  {
    leadId: "a1b2c3d4-5e6f-4708-9a0b-1c2d3e4f5061",
    orderId: "1523633858296447012",
    fullName: "Lim S. M.",
    nricLast4: "412A",
    mobile: "+65 8234 5678",
    newCustomer: false,
    desiredAmount: 15000,
    acardLimit: 9000,
    mlcbMaxLoanAmount: 9000,
    underwrittenCap: 14200,
    riskMsg: "Requested amount exceeds MLCB maximum loan quantum across licensed moneylenders.",
    reason: "mlcb_below_request",
    submittedAt: hoursAgo(6),
  },
  {
    leadId: "7c8d9e0f-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
    orderId: "1523633858296447188",
    fullName: "Rahman N.",
    nricLast4: "889G",
    mobile: "+65 9345 6789",
    newCustomer: true,
    desiredAmount: 3000,
    acardLimit: 3000,
    mlcbMaxLoanAmount: 20000,
    underwrittenCap: 3000,
    riskMsg: "Latest NOA outside scoring window; supporting payslips required before approval.",
    reason: "document_required",
    submittedAt: hoursAgo(2),
  },
  {
    leadId: "b0c1d2e3-f4a5-4b67-8901-234567890abc",
    orderId: "1523633858296447240",
    fullName: "Chua K. L.",
    nricLast4: "203F",
    mobile: "+65 8456 7890",
    newCustomer: false,
    desiredAmount: 20000,
    acardLimit: 18000,
    mlcbMaxLoanAmount: 25000,
    underwrittenCap: 19500,
    riskMsg: "Exposure above automatic approval threshold; credit officer sign-off required.",
    reason: "manual_review",
    submittedAt: hoursAgo(1),
  },
];
