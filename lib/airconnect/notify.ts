/**
 * Pushes leads and appointments to AirConnect.
 *
 * Two moments, two endpoints, confirmed contract (2026-09-22):
 *  - New lead, once Ascend opens an order for the applicant (or, on the AXS
 *    path with no Ascend order, once the engine decides). Does not wait for
 *    a booking that may never happen.
 *      POST {AIRCONNECT_LEADS_URL}        (their /api/ascend/leads/manualverify)
 *  - Appointment booked (apply/axs/aip `book` routes).
 *      POST {AIRCONNECT_APPOINTMENTS_URL} (their /api/appointments/ascend)
 *
 * Both take the same auth (x-api-key: AIRCONNECT_API_KEY) and the same
 * shape of body: no cfh5Id/leadId/loanAmount - those were this app's own
 * invention before the contract was confirmed and AirConnect's endpoints
 * don't take them. `app` exists purely so AirConnect can tell requests from
 * different client apps apart in their own logs; it is not "ascend" because
 * these endpoints, despite the name, live under AirConnect's own pipeline.
 *
 * No-op if unconfigured (missing URL or key), and never throws: a flaky or
 * not-yet-configured AirConnect must not fail an applicant's submit or
 * booking.
 */

import { logExternalApi } from "@/lib/external-api-logger";

/** Distinct from "ascend" so AirConnect can trace these requests separately - see contract note above. */
const APP_NAME = "dashboard";

async function postToAirConnect(input: {
  url: string;
  body: Record<string, unknown>;
  applicantId: string;
  tag: string;
}): Promise<boolean> {
  const apiKey = process.env.AIRCONNECT_API_KEY;
  if (!apiKey) {
    console.warn(`${input.tag} AIRCONNECT_API_KEY not configured - skipping`);
    return false;
  }

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
  };

  try {
    const started = Date.now();
    const res = await fetch(input.url, {
      method: "POST",
      headers,
      body: JSON.stringify(input.body),
      signal: AbortSignal.timeout(25_000),
    });

    const ms = Date.now() - started;
    const responseBody = !res.ok ? await res.text() : undefined;

    logExternalApi({
      tag: input.tag,
      url: input.url,
      method: "POST",
      headers,
      body: input.body,
      status: res.status,
      ok: res.ok,
      ms,
      responseBody,
      leadId: input.applicantId,
    });

    if (!res.ok) {
      console.error(`${input.tag} AirConnect call failed`, {
        status: res.status,
        ms,
        body: responseBody?.slice(0, 500),
      });
    }

    return res.ok;
  } catch (err) {
    console.error(`${input.tag} AirConnect call error`, err);
    return false;
  }
}

export interface NewLeadPayload {
  /** Not sent to AirConnect - only for our own api_logs filtering. */
  applicantId: string;
  customerName: string;
  phoneNumber: string;
  idNumber?: string;
}

/**
 * Must be awaited before the caller returns its HTTP response, or serverless
 * can freeze right after `return res` and the fetch never completes.
 *
 * Returns whether the push succeeded, so the caller can decide whether to
 * record it as done or leave it for the next resubmit to retry.
 */
export async function pushNewLeadToAirConnect(
  payload: NewLeadPayload,
  tag = "[airconnect/notify-lead]",
): Promise<boolean> {
  const url = process.env.AIRCONNECT_LEADS_URL;
  if (!url) {
    console.warn(`${tag} AIRCONNECT_LEADS_URL not configured - skipping lead push`);
    return false;
  }

  const body = {
    app: APP_NAME,
    customerName: payload.customerName,
    phoneNumber: payload.phoneNumber,
    ...(payload.idNumber ? { idNumber: payload.idNumber } : {}),
  };

  return postToAirConnect({ url, body, applicantId: payload.applicantId, tag });
}

export interface AppointmentPayload {
  /** Not sent to AirConnect - only for our own api_logs filtering. */
  applicantId: string;
  customerName: string;
  phoneNumber: string;
  appointmentDate: string;
  timeSlot: string;
  idNumber?: string;
}

/** Same awaited-before-return and no-throw rules as pushNewLeadToAirConnect. */
export async function pushAppointmentToAirConnect(
  payload: AppointmentPayload,
  tag = "[airconnect/notify-appointment]",
): Promise<boolean> {
  const url = process.env.AIRCONNECT_APPOINTMENTS_URL;
  if (!url) {
    console.warn(`${tag} AIRCONNECT_APPOINTMENTS_URL not configured - skipping notification`);
    return false;
  }

  const body = {
    app: APP_NAME,
    customerName: payload.customerName,
    phoneNumber: payload.phoneNumber,
    appointmentDate: payload.appointmentDate,
    timeSlot: payload.timeSlot,
    ...(payload.idNumber ? { idNumber: payload.idNumber } : {}),
  };

  return postToAirConnect({ url, body, applicantId: payload.applicantId, tag });
}
