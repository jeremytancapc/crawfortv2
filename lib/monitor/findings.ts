/**
 * What a look at production means: urgent, worth a look, or just news.
 *
 * Pure rules over a snapshot of measurements (see scripts/prod-monitor.mjs, which
 * takes the snapshot). Kept apart so every rule can be tested - the point of the
 * monitor is that the faults it must catch are the ones that were not noticed:
 * on 16 Oct the first real customer was sent to "under review" because Ascend
 * was not configured, and nothing said so.
 */

export type Snapshot = {
  /** How far back the counts look. */
  windowMinutes: number;
  probes: {
    siteOk: boolean;
    /** The production Singpass Lambda redirects to Singpass. */
    lambdaOk: boolean;
    /** Ascend accepts our production credentials; null when not tried. */
    ascendCredentialsOk: boolean | null;
    /** Settings the live site says are wrong; null when it could not be asked. */
    healthProblems: string[] | null;
  };
  counts: {
    newApplicants: number;
    /** Submitted, not an existing customer, and no Ascend order was made. */
    submittedWithoutOrder: number;
    /** Times the app skipped Ascend because it was not configured. */
    ascendSkipped: number;
    ascendFailures: number;
    /** Leads or appointments that did not reach AirConnect. */
    airconnectFailures: number;
    /** A PASS arrived with no limit (the app asks again by itself). */
    passWithoutLimit: number;
    singpassRedirects: number;
    singpassCallbacks: number;
    /** Document reads that produced no report. */
    readerFailures: number;
    /** Applicants Ascend passed who have no limit stored. */
    approvedWithoutLimit: number;
  };
};

export type Finding = { level: "urgent" | "warn" | "info"; code: string; message: string };

export function findingsFrom(s: Snapshot): Finding[] {
  const found: Finding[] = [];
  const add = (level: Finding["level"], code: string, message: string) => found.push({ level, code, message });
  const minutes = `${s.windowMinutes} minutes`;

  // ── Urgent: a customer is being hurt, or about to be ────────────────────
  if (!s.probes.siteOk) add("urgent", "site_down", "get.crawfort.com is not answering.");
  if (!s.probes.lambdaOk) add("urgent", "singpass_lambda_down", "The production Singpass Lambda is not redirecting to Singpass: nobody can log in.");
  if (s.probes.ascendCredentialsOk === false) add("urgent", "ascend_credentials", "Ascend is refusing our production credentials.");
  if (s.probes.healthProblems && s.probes.healthProblems.length > 0) {
    add("urgent", "config_problems", `The live site reports wrong or missing settings: ${s.probes.healthProblems.join(", ")}.`);
  }
  if (s.counts.ascendSkipped > 0) {
    add("urgent", "ascend_skipped", `${s.counts.ascendSkipped} submit(s) in the last ${minutes} skipped Ascend because it is not configured: those applicants got no credit check.`);
  }
  if (s.counts.submittedWithoutOrder > 0) {
    add("urgent", "applicants_without_order", `${s.counts.submittedWithoutOrder} applicant(s) submitted in the last ${minutes} and Ascend never made them an order.`);
  }
  if (s.counts.ascendFailures > 0) {
    add("urgent", "ascend_errors", `${s.counts.ascendFailures} Ascend call(s) failed in the last ${minutes}.`);
  }
  if (s.counts.airconnectFailures > 0) {
    add("urgent", "airconnect_failures", `${s.counts.airconnectFailures} lead(s) or appointment(s) did not reach AirConnect in the last ${minutes}: staff will not see them.`);
  }
  if (s.counts.approvedWithoutLimit > 0) {
    add("urgent", "approved_without_limit", `${s.counts.approvedWithoutLimit} applicant(s) Ascend passed have no credit limit stored: they are being shown "under review".`);
  }
  if (s.counts.singpassRedirects >= 3 && s.counts.singpassCallbacks === 0) {
    add("urgent", "singpass_not_completing", `${s.counts.singpassRedirects} people went to Singpass in the last ${minutes} and none came back.`);
  }

  // ── Worth a look ────────────────────────────────────────────────────────
  if (s.probes.healthProblems === null) {
    add("warn", "health_unavailable", "Could not ask the live site which settings it has (its health check did not answer).");
  }
  if (s.counts.singpassRedirects >= 5 && s.counts.singpassCallbacks > 0 && s.counts.singpassCallbacks / s.counts.singpassRedirects < 0.4) {
    add("warn", "singpass_dropping", `Only ${s.counts.singpassCallbacks} of ${s.counts.singpassRedirects} Singpass attempts in the last ${minutes} came back.`);
  }
  if (s.counts.passWithoutLimit > 0) {
    add("warn", "pass_without_limit", `${s.counts.passWithoutLimit} Ascend PASS(es) arrived without a limit in the last ${minutes} (the app asks again by itself).`);
  }
  if (s.counts.readerFailures >= 3) {
    add("warn", "reader_failures", `The document reader produced no report ${s.counts.readerFailures} times in the last ${minutes}.`);
  }

  // ── News ────────────────────────────────────────────────────────────────
  if (s.counts.newApplicants > 0) {
    add("info", "new_applicants", `${s.counts.newApplicants} new applicant(s) in the last ${minutes}.`);
  }

  const rank = { urgent: 0, warn: 1, info: 2 } as const;
  return found.sort((a, b) => rank[a.level] - rank[b.level]);
}
