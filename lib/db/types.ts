/**
 * Domain types for the Postgres schema in db/migrations/.
 *
 * Names follow CONTEXT.md: Applicant, not Lead. Amounts arrive from `pg` as
 * strings, because a numeric column can hold values a JavaScript number
 * cannot represent exactly - so they are typed as strings here and parsed
 * deliberately at the point of use rather than silently on the way in.
 */

export type IncomeSource = "cpf" | "noa" | "self_declared";

/**
 * `in_progress` is a partial applicant, captured at the MyInfo activate step
 * or the review confirm, before final submit makes it `new`.
 */
export type ApplicantStatus =
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
/**
 * Ascend recognises six. Ours are slugs rather than their wording, so a
 * rephrased option on their side does not need a migration here.
 *
 * `discharged_lt5` is legacy: the form used to ask one question covering the
 * whole under-five-years span, and rows written then still read back. Nothing
 * writes it now.
 */
export type BankruptcyDeclaration =
  | "clear"
  | "discharged_gt5"
  | "discharged_4_5"
  | "discharged_1_3"
  | "discharged_lt1"
  | "active"
  | "discharged_lt5";
export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";

/**
 * Ascend's verdict, in the glossary's spelling. Ascend sends PASS / PENDING /
 * REJECT on the wire; `toRiskStatus` in lib/ascend/client.ts maps between the
 * two, so the uppercase form never reaches the database.
 */
export type RiskStatus = "passed" | "pending" | "rejected";

export type MyinfoProfile = {
  id: string;
  created_at: string;
  applicant_id: string;

  nric: string | null;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  address: string | null;
  postal_code: string | null;
  residential_status: string | null;
  monthly_income_noa: string | null;

  /** Mapped CPF/NOA/dob - what buildMyInfoPatch made of the payload. */
  processed_payload: Record<string, unknown>;
};

export type Appointment = {
  id: string;
  created_at: string;
  updated_at: string;
  applicant_id: string;

  appointment_date: string;
  appointment_time: string;

  status: AppointmentStatus;
  notes: string | null;
  reminder_sent_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type CreditAssessment = {
  id: string;
  created_at: string;
  applicant_id: string;

  income_source: IncomeSource;
  verified_monthly_income: string;

  /** The local engine's ceiling. Comparison only since ADR-0001. */
  underwritten_cap: string;
  /** The engine's own offer figure. NOT an approved amount. */
  engine_offer_amount: string;

  is_eligible: boolean;

  age_at_application: number | null;
  existing_loans: string;
  moneylender_loan_amount: string | null;
  moneylender_payment_history: string | null;

  explanation: string | null;
  credit_rejection_reason: string | null;
  raw_assessment: Record<string, unknown>;
};

export type AscendOrder = {
  id: string;
  created_at: string;
  updated_at: string;
  applicant_id: string;

  /** Ascend's Order. TEXT - the value exceeds Number.MAX_SAFE_INTEGER. */
  order_id: string;
  risk_status: RiskStatus | null;

  /** A-Card Limit: what Ascend will lend. May exceed the Desired Amount. */
  a_card_limit: string | null;
  /** Maximum Loan Quantum: the MLCB ceiling. */
  maximum_loan_quantum: string | null;
  new_customer: boolean | null;

  credit_level: string | null;
  credit_score: string | null;
};

export type DbRow = Record<string, unknown>;
