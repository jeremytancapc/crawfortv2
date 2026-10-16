/**
 * Tells AirConnect which Ascend order a person should review.
 *
 * Our lead is pushed once, at submit, before income exists. When an applicant
 * then ends up waiting on a person - income taken and left pending, or a PASS
 * that never named a limit - the lead is sent again with the link staff open
 * ("Verify in Ascend" on the lead). AirConnect updates the lead it already
 * holds for that phone number, and shows the link only when it starts with
 * http. The same URL is what Ascend itself puts on its pending leads, so
 * nothing new reaches respond.io.
 */

import { getApplicant } from "@/lib/db/applicants";
import { ascendOrderReviewLink } from "@/lib/ascend/review-link";
import { toSgE164 } from "@/lib/phone";

import { pushNewLeadToAirConnect, type NewLeadPayload } from "./notify";

type Applicant = {
  full_name: string | null;
  mobile: string | null;
  nric: string | null;
  auth_method: string | null;
};

type Deps = {
  getApplicant: (id: string) => Promise<Applicant | null>;
  push: (payload: NewLeadPayload, tag: string) => Promise<boolean>;
  baseUrl?: string;
};

const TAG = "[airconnect/notify-review-link]";

/** Never throws, and does nothing it cannot do completely. */
export async function pushStaffReviewLink(
  input: { applicantId: string; orderId: string },
  deps?: Partial<Deps>,
): Promise<boolean> {
  try {
    const link = ascendOrderReviewLink(input.orderId, deps && "baseUrl" in deps ? deps.baseUrl : undefined);
    if (!link) return false;

    const applicant = await (deps?.getApplicant ?? (getApplicant as unknown as Deps["getApplicant"]))(input.applicantId);
    if (!applicant) return false;

    return await (deps?.push ?? pushNewLeadToAirConnect)(
      {
        applicantId: input.applicantId,
        customerName: applicant.full_name ?? "",
        phoneNumber: toSgE164(applicant.mobile),
        ...(applicant.auth_method === "singpass" && applicant.nric ? { idNumber: applicant.nric } : {}),
        customerHyperLink: link,
      },
      TAG,
    );
  } catch (err) {
    console.error(`${TAG} could not send the review link`, err);
    return false;
  }
}
