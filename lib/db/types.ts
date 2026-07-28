/**
 * Domain types for the in-memory data store (replaces Supabase schema types).
 */

export type IncomeSource = "cpf" | "noa" | "self_declared";

export type LeadStatus =
  | "in_progress"
  | "new"
  | "contacted"
  | "qualified"
  | "appointed"
  | "approved"
  | "rejected"
  | "withdrawn";

export type AuthMethod = "manual" | "singpass" | "aip" | "axs";
export type IdType = "singaporean" | "pr" | "foreigner";
export type BankruptcyDeclaration = "clear" | "discharged_lt5" | "active";
export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;

  loan_amount: number;
  loan_tenure: number;
  loan_purpose: string | null;
  urgency: string | null;

  auth_method: AuthMethod | null;
  id_type: IdType | null;
  full_name: string | null;
  nric: string | null;

  email: string | null;
  mobile: string | null;
  secondary_mobile: string | null;

  postal_code: string | null;
  address: string | null;
  mailing_address: string | null;

  employment_status: string | null;
  monthly_income: string | null;
  work_industry: string | null;
  position: string | null;
  employment_duration: string | null;
  office_phone: string | null;

  marital_status: string | null;
  bankruptcy_declaration: BankruptcyDeclaration | null;
  moneylender_no_loans: boolean;
  moneylender_loan_amount: string | null;
  moneylender_payment_history: string | null;

  status: LeadStatus;
  notes: string | null;
  assigned_to: string | null;

  decline_reason?: string | null;
  eligibility_status?: string | null;
  eligibility_notes?: string | null;
  eligibility_reloan_reason?: string | null;
}

export interface MyInfoProfile {
  id: string;
  created_at: string;
  lead_id: string;

  nric: string | null;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  address: string | null;
  postal_code: string | null;
  residential_status: string | null;
  monthly_income_noa: number | null;

  cpf_raw: Record<string, unknown> | null;
  noa_raw: Record<string, unknown> | null;
  myinfo_raw: Record<string, unknown> | null;
  raw_payload: Record<string, unknown>;
}

export interface Appointment {
  id: string;
  created_at: string;
  updated_at: string;
  lead_id: string;

  appointment_date: string;
  appointment_time: string;

  status: AppointmentStatus;
  notes: string | null;
  reminder_sent_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

export interface CreditAssessmentRow {
  id: string;
  created_at: string;
  lead_id: string;

  income_source: IncomeSource;
  verified_monthly_income: number;
  approved_loan_amount: number;
  max_eligible_loan: number;
  is_eligible: boolean;

  age_at_application: number | null;
  existing_loans: number;
  moneylender_loan_amount: number | null;
  moneylender_payment_history: string | null;
  explanation: string | null;
  raw_assessment: Record<string, unknown>;
  credit_rejection_reason?: string | null;
}

export type DbRow = Record<string, unknown>;
