import { randomUUID } from "crypto";

import type { DbRow } from "./types";

/** Well-known demo lead for local UI checks (pending / approval). */
export const DEMO_LEAD_ID = "00000000-0000-4000-8000-000000000001";

export type TableName =
  | "leads"
  | "myinfo_profiles"
  | "appointments"
  | "credit_assessments"
  | "apply_flow_events"
  | "api_logs";

type Store = Record<TableName, DbRow[]>;

const globalForStore = globalThis as typeof globalThis & {
  __crawfortMemoryDb?: Store;
};

function nowIso() {
  return new Date().toISOString();
}

function seedStore(): Store {
  const created = nowIso();
  return {
    leads: [
      {
        id: DEMO_LEAD_ID,
        created_at: created,
        updated_at: created,
        loan_amount: 5000,
        loan_tenure: 6,
        loan_purpose: "Personal expenses",
        urgency: null,
        auth_method: "manual",
        id_type: "singaporean",
        full_name: "Alex Tan",
        nric: "S1234567A",
        email: "alex.tan@example.com",
        mobile: "+6591234567",
        secondary_mobile: null,
        postal_code: "018956",
        address: "1 Marina Boulevard",
        mailing_address: null,
        employment_status: "Employed",
        monthly_income: "4500",
        work_industry: null,
        position: null,
        employment_duration: null,
        office_phone: null,
        marital_status: null,
        bankruptcy_declaration: "clear",
        moneylender_no_loans: true,
        moneylender_loan_amount: null,
        moneylender_payment_history: null,
        status: "approved",
        notes: "Dummy seed lead for local development",
        assigned_to: null,
        decline_reason: null,
        eligibility_status: "ELIGIBLE",
        eligibility_notes: "Dummy eligible",
        eligibility_reloan_reason: null,
      },
    ],
    myinfo_profiles: [],
    appointments: [],
    credit_assessments: [
      {
        id: randomUUID(),
        created_at: created,
        lead_id: DEMO_LEAD_ID,
        income_source: "self_declared",
        verified_monthly_income: 4500,
        approved_loan_amount: 5000,
        max_eligible_loan: 8000,
        is_eligible: true,
        age_at_application: 32,
        existing_loans: 0,
        moneylender_loan_amount: null,
        moneylender_payment_history: null,
        explanation: "Dummy credit assessment for local development",
        raw_assessment: { dummy: true },
        credit_rejection_reason: null,
      },
    ],
    apply_flow_events: [],
    api_logs: [],
  };
}

export function getMemoryStore(): Store {
  if (!globalForStore.__crawfortMemoryDb) {
    globalForStore.__crawfortMemoryDb = seedStore();
  }
  return globalForStore.__crawfortMemoryDb;
}

export function newId() {
  return randomUUID();
}

export function timestampNow() {
  return nowIso();
}
