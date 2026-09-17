/**
 * What we retained from a MyInfo retrieval, after mapping.
 *
 * No verbatim copy lives here. The unminimised payload is in
 * myinfo_retrievals and expires; this table holds the mapped fields plus the
 * CPF/NOA the income engine re-reads when scoring.
 */

import { sql, sqlOne } from "./sql";
import type { MyinfoProfile } from "./types";

export type MyinfoProfileInput = {
  nric?: string | null;
  fullName?: string | null;
  email?: string | null;
  mobile?: string | null;
  address?: string | null;
  postalCode?: string | null;
  residentialStatus?: string | null;
  monthlyIncomeNoa?: number | null;
  /** Mapped CPF contributions, NOA history and date of birth. */
  processedPayload: Record<string, unknown>;
};

/** One profile per applicant, so re-submitting replaces rather than duplicates. */
export async function upsertMyinfoProfile(
  applicantId: string,
  input: MyinfoProfileInput,
): Promise<void> {
  await sql`
    insert into myinfo_profiles (
      applicant_id, nric, full_name, email, mobile, address, postal_code,
      residential_status, monthly_income_noa, processed_payload
    ) values (
      ${applicantId}, ${input.nric ?? null}, ${input.fullName ?? null},
      ${input.email ?? null}, ${input.mobile ?? null}, ${input.address ?? null},
      ${input.postalCode ?? null}, ${input.residentialStatus ?? null},
      ${input.monthlyIncomeNoa ?? null}, ${JSON.stringify(input.processedPayload)}::jsonb
    )
    on conflict (applicant_id) do update set
      nric = excluded.nric,
      full_name = excluded.full_name,
      email = excluded.email,
      mobile = excluded.mobile,
      address = excluded.address,
      postal_code = excluded.postal_code,
      residential_status = excluded.residential_status,
      monthly_income_noa = excluded.monthly_income_noa,
      processed_payload = excluded.processed_payload`;
}

export function getMyinfoProfile(applicantId: string): Promise<MyinfoProfile | null> {
  return sqlOne<MyinfoProfile>`
    select * from myinfo_profiles where applicant_id = ${applicantId}`;
}
