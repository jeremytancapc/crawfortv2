/**
 * Persisting MyInfo against an applicant.
 *
 * The verbatim payload is deliberately not written here. It lives in
 * myinfo_retrievals and expires; this table keeps the mapped fields and the
 * processed CPF/NOA the income engine re-reads. The previous version wrote
 * cpf_raw, noa_raw and myinfo_raw - unminimised personal data with no expiry
 * and a comment calling it a "full audit copy" - and those columns are gone.
 */

import { upsertMyinfoProfile } from "@/lib/db/myinfo-profiles";
import { getMyinfoProfile } from "@/lib/db/myinfo-profiles";
import { getMyinfoRetrieval } from "@/lib/db/myinfo-retrievals";
import { buildMyInfoPatch } from "@/lib/myinfo";
import type { CpfContribution, LoanFormData, NoaRecord } from "@/lib/loan-form";

export type MyinfoProcessedPayload = {
  cpfContributions: CpfContribution[];
  noaHistory: NoaRecord[];
  dob: string;
};

function noaMonthlyFromHistory(noaHistory: NoaRecord[]): number | null {
  if (noaHistory.length === 0) return null;
  return noaHistory[0].employmentIncome / 12;
}

/** Persist MyInfo at activate so the session cookie can stay slim. */
export async function upsertMyinfoProfileForApplicant(
  applicantId: string,
  form: Partial<LoanFormData>,
): Promise<void> {
  const cpfContributions = form.cpfContributions ?? [];
  const noaHistory = form.noaHistory ?? [];

  await upsertMyinfoProfile(applicantId, {
    nric: form.nric || null,
    fullName: form.fullName || null,
    email: form.email || null,
    mobile: form.mobile || null,
    address: form.address || null,
    postalCode: form.postalCode || null,
    residentialStatus: form.idType || null,
    monthlyIncomeNoa: noaMonthlyFromHistory(noaHistory),
    processedPayload: {
      cpfContributions,
      noaHistory,
      dob: form.dob ?? "",
    },
  });
}

export async function loadMyinfoProcessedPayload(
  applicantId: string,
): Promise<MyinfoProcessedPayload | null> {
  const profile = await getMyinfoProfile(applicantId);
  if (!profile?.processed_payload) return null;

  const raw = profile.processed_payload as {
    cpfContributions?: CpfContribution[];
    noaHistory?: NoaRecord[];
    dob?: string;
  };

  return {
    cpfContributions: raw.cpfContributions ?? [],
    noaHistory: raw.noaHistory ?? [],
    dob: raw.dob ?? "",
  };
}

/**
 * Rebuilds the processed CPF/NOA from the stored retrieval when the profile
 * row is missing - a session that survived longer than the row it was written
 * alongside, or an applicant who reached submit without passing activate.
 *
 * Reads myinfo_retrievals rather than the old in-memory map, so it still
 * works when the request lands on a different instance than the callback did.
 */
export async function processedPayloadFromRetrieval(
  singpassRawKey: string,
): Promise<MyinfoProcessedPayload | null> {
  const payload = await getMyinfoRetrieval(singpassRawKey);
  if (!payload) return null;

  const patch = buildMyInfoPatch(payload);
  return {
    cpfContributions: patch.cpfContributions ?? [],
    noaHistory: patch.noaHistory ?? [],
    dob: patch.dob ?? "",
  };
}
