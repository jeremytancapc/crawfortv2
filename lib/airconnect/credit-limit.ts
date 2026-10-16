/**
 * Tells AirConnect the credit limit Ascend gave an applicant.
 *
 * AirConnect keeps every limit it is told about - with the system that sent it
 * and when it arrived - and shows the latest on the lead. This app is the
 * second H5, so its limits are labelled cf_h5_v2; the first H5 sends cf_h5_v1.
 *
 * The lead itself is pushed at submit. When the limit only exists later (income
 * accepted and Ascend approved), the lead is sent again with the limit, and
 * AirConnect updates the lead it already holds for that phone number.
 */

import { getApplicant } from "@/lib/db/applicants";
import { toSgE164 } from "@/lib/phone";

import { pushNewLeadToAirConnect, type NewLeadPayload } from "./notify";

export const CREDIT_LIMIT_SOURCE = "cf_h5_v2";
const CREDIT_LIMIT_PROVIDER = "ascend";
const TAG = "[airconnect/notify-credit-limit]";

type Applicant = {
  full_name: string | null;
  mobile: string | null;
  nric: string | null;
  auth_method: string | null;
};

type Deps = {
  getApplicant: (id: string) => Promise<Applicant | null>;
  push: (payload: NewLeadPayload, tag: string) => Promise<boolean>;
};

/** The limit as AirConnect is told it; shared with the push made at submit. */
export function creditLimitForAirConnect(amount: number, orderId: string | null | undefined): NewLeadPayload["creditLimit"] | undefined {
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return { amount, source: CREDIT_LIMIT_SOURCE, provider: CREDIT_LIMIT_PROVIDER, reference: orderId ?? null };
}

/** Never throws, and does nothing it cannot do completely. */
export async function pushCreditLimit(
  input: { applicantId: string; orderId: string; amount: number },
  deps?: Partial<Deps>,
): Promise<boolean> {
  try {
    const creditLimit = creditLimitForAirConnect(input.amount, input.orderId);
    if (!creditLimit) return false;

    const applicant = await (deps?.getApplicant ?? (getApplicant as unknown as Deps["getApplicant"]))(input.applicantId);
    if (!applicant) return false;

    return await (deps?.push ?? pushNewLeadToAirConnect)(
      {
        applicantId: input.applicantId,
        customerName: applicant.full_name ?? "",
        phoneNumber: toSgE164(applicant.mobile),
        ...(applicant.auth_method === "singpass" && applicant.nric ? { idNumber: applicant.nric } : {}),
        creditLimit,
      },
      TAG,
    );
  } catch (err) {
    console.error(`${TAG} could not send the credit limit`, err);
    return false;
  }
}
