/** Append leadId for approval/pending when the session cookie may not persist (large Singpass sessions). */
export function postSubmitUrl(path: string, leadId: string | null | undefined): string {
  if (!leadId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}leadId=${encodeURIComponent(leadId)}`;
}

/**
 * Where the applicant goes once submit has answered.
 *
 * The destination is decided on the server and carried in the response.
 * It used to be derived here from an `isEligible` boolean, which could only
 * ever name two pages - and there are four: approval, verify-income, and the
 * pending page reached either by a decline or by Ascend not answering.
 *
 * A response naming no destination falls back to the pending page rather than
 * approval. Pending is the credit review queue, so a wrong turn there is
 * recoverable; showing an offer nobody decided is not.
 */
export function nextPathAfterSubmit(result: {
  destination?: string;
  leadId: string | null | undefined;
}): string {
  return postSubmitUrl(result.destination ?? "/apply/pending", result.leadId);
}
