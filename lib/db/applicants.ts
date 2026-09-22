/**
 * Applicants: read and write.
 *
 * Replaces the `.from("leads")` chains that ran against the in-memory store.
 * Every query is written out as SQL rather than assembled by a builder, so
 * what runs against Postgres is what you read here.
 *
 * Column names follow CONTEXT.md - `desired_amount`, not `loan_amount`. The
 * glossary is explicit that the four amounts must never collapse into one.
 */

import { sql, sqlOne } from "./sql";
import type { ApplicantStatus, AuthMethod, BankruptcyDeclaration, IdType } from "./types";

export type Applicant = {
  id: string;
  created_at: string;
  updated_at: string;

  desired_amount: string;
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

  status: ApplicantStatus;
  notes: string | null;
  assigned_to: string | null;
  decline_reason: string | null;

  eligibility_status: string | null;
  eligibility_notes: string | null;
  eligibility_reloan_reason: string | null;

  selected_plan: string | null;
  plan_monthly_rate: string | null;
  plan_monthly_instalment: string | null;

  ascend_user_id: string | null;
  ascend_new_customer: boolean | null;
  ascend_has_myinfo: boolean | null;

  airconnect_lead_pushed_at: string | null;
};

/** Everything an applicant row can be created with. */
export type NewApplicant = {
  desiredAmount: number;
  loanTenure: number;
  loanPurpose?: string | null;
  urgency?: string | null;
  authMethod?: AuthMethod | null;
  idType?: IdType | null;
  fullName?: string | null;
  nric?: string | null;
  email?: string | null;
  mobile?: string | null;
  secondaryMobile?: string | null;
  postalCode?: string | null;
  address?: string | null;
  mailingAddress?: string | null;
  employmentStatus?: string | null;
  monthlyIncome?: string | null;
  workIndustry?: string | null;
  position?: string | null;
  employmentDuration?: string | null;
  officePhone?: string | null;
  maritalStatus?: string | null;
  bankruptcyDeclaration?: BankruptcyDeclaration | null;
  moneylenderNoLoans?: boolean;
  moneylenderLoanAmount?: string | null;
  moneylenderPaymentHistory?: string | null;
  status?: ApplicantStatus;
  notes?: string | null;
};

/**
 * Creates an applicant and returns its id.
 *
 * Every column is listed rather than built from the object's keys: a
 * dynamically assembled column list is one typo away from writing to the
 * wrong column, and Postgres would not complain.
 */
export async function insertApplicant(input: NewApplicant): Promise<string> {
  const row = await sqlOne<{ id: string }>`
    insert into applicants (
      desired_amount, loan_tenure, loan_purpose, urgency,
      auth_method, id_type, full_name, nric,
      email, mobile, secondary_mobile,
      postal_code, address, mailing_address,
      employment_status, monthly_income, work_industry, position,
      employment_duration, office_phone,
      marital_status, bankruptcy_declaration,
      moneylender_no_loans, moneylender_loan_amount, moneylender_payment_history,
      status, notes
    ) values (
      ${input.desiredAmount}, ${input.loanTenure}, ${input.loanPurpose ?? null}, ${input.urgency ?? null},
      ${input.authMethod ?? null}, ${input.idType ?? null}, ${input.fullName ?? null}, ${input.nric ?? null},
      ${input.email ?? null}, ${input.mobile ?? null}, ${input.secondaryMobile ?? null},
      ${input.postalCode ?? null}, ${input.address ?? null}, ${input.mailingAddress ?? null},
      ${input.employmentStatus ?? null}, ${input.monthlyIncome ?? null}, ${input.workIndustry ?? null}, ${input.position ?? null},
      ${input.employmentDuration ?? null}, ${input.officePhone ?? null},
      ${input.maritalStatus ?? null}, ${input.bankruptcyDeclaration ?? null},
      ${input.moneylenderNoLoans ?? false}, ${input.moneylenderLoanAmount ?? null}, ${input.moneylenderPaymentHistory ?? null},
      ${input.status ?? "new"}, ${input.notes ?? null}
    )
    returning id`;

  if (!row) throw new Error("insertApplicant returned no row");
  return row.id;
}

export function getApplicant(id: string): Promise<Applicant | null> {
  return sqlOne<Applicant>`select * from applicants where id = ${id}`;
}

/**
 * Overwrites the applicant's details with what the form now holds.
 *
 * Distinct from the narrow updates below on purpose: this is the submit-time
 * write of everything the applicant typed, where the narrow ones each move a
 * single piece of state and read as what they do at the call site.
 */
export async function updateApplicantDetails(id: string, input: NewApplicant): Promise<void> {
  await sql`
    update applicants set
      desired_amount = ${input.desiredAmount},
      loan_tenure = ${input.loanTenure},
      loan_purpose = ${input.loanPurpose ?? null},
      urgency = ${input.urgency ?? null},
      auth_method = ${input.authMethod ?? null},
      id_type = ${input.idType ?? null},
      full_name = ${input.fullName ?? null},
      nric = ${input.nric ?? null},
      email = ${input.email ?? null},
      mobile = ${input.mobile ?? null},
      secondary_mobile = ${input.secondaryMobile ?? null},
      postal_code = ${input.postalCode ?? null},
      address = ${input.address ?? null},
      mailing_address = ${input.mailingAddress ?? null},
      employment_status = ${input.employmentStatus ?? null},
      monthly_income = ${input.monthlyIncome ?? null},
      work_industry = ${input.workIndustry ?? null},
      position = ${input.position ?? null},
      employment_duration = ${input.employmentDuration ?? null},
      office_phone = ${input.officePhone ?? null},
      marital_status = ${input.maritalStatus ?? null},
      bankruptcy_declaration = ${input.bankruptcyDeclaration ?? null},
      moneylender_no_loans = ${input.moneylenderNoLoans ?? false},
      moneylender_loan_amount = ${input.moneylenderLoanAmount ?? null},
      moneylender_payment_history = ${input.moneylenderPaymentHistory ?? null},
      status = ${input.status ?? "new"},
      notes = ${input.notes ?? null}
    where id = ${id}`;
}

export async function setApplicantStatus(id: string, status: ApplicantStatus): Promise<void> {
  await sql`update applicants set status = ${status} where id = ${id}`;
}

export async function setDesiredAmount(id: string, amount: number): Promise<void> {
  await sql`update applicants set desired_amount = ${amount} where id = ${id}`;
}

export async function setDeclineReason(id: string, reason: string): Promise<void> {
  await sql`update applicants set decline_reason = ${reason} where id = ${id}`;
}

/**
 * Records the plan the applicant chose.
 *
 * `loan_tenure` moves with it: the plan IS a tenure, and leaving the two to
 * drift means the booking confirmation and the AirConnect notification quote
 * a different term than the applicant agreed to.
 */
export async function setSelectedPlan(
  id: string,
  input: {
    plan: string;
    tenure: number;
    monthlyRate: number | null;
    monthlyInstalment: number | null;
    notes?: string | null;
  },
): Promise<void> {
  await sql`
    update applicants set
      selected_plan = ${input.plan},
      loan_tenure = ${input.tenure},
      plan_monthly_rate = ${input.monthlyRate},
      plan_monthly_instalment = ${input.monthlyInstalment},
      notes = coalesce(${input.notes ?? null}, notes)
    where id = ${id}`;
}

/**
 * Records what Ascend knows about this person, from /openApi/users.
 *
 * ascendUserId is a string end to end: the ids exceed
 * Number.MAX_SAFE_INTEGER, so anything that treats one as a number corrupts
 * it silently.
 */
export async function markAirConnectLeadPushed(id: string): Promise<void> {
  await sql`update applicants set airconnect_lead_pushed_at = now() where id = ${id}`;
}

export async function setAscendIdentity(
  id: string,
  input: { ascendUserId: string; newCustomer: boolean; hasMyinfo: boolean },
): Promise<void> {
  await sql`
    update applicants set
      ascend_user_id = ${input.ascendUserId},
      ascend_new_customer = ${input.newCustomer},
      ascend_has_myinfo = ${input.hasMyinfo}
    where id = ${id}`;
}
