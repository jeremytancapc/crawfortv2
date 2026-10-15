/**
 * POST /api/apply/book
 *
 * Saves the chosen appointment slot to the in-memory store, clears apply cookies, and
 * notifies AirConnect via the external appointments API.
 * Body: { date: "YYYY-MM-DD", time: "HH:MM" }
 * Success JSON: { ok, appointmentId, cfh5Id, loanAmount, date, time }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  decodeSession,
  clearCookies,
  SESSION_COOKIE,
} from "@/lib/apply-session";
import {
  clearApprovalOfferCookie,
  decodeApprovalOffer,
  APPROVAL_OFFER_COOKIE,
} from "@/lib/approval-offer";
import { bookingConfirmCookieValue } from "@/lib/booking-confirmation";
import { getApplicant, setApplicantStatus } from "@/lib/db/applicants";
import { insertAppointment } from "@/lib/db/appointments";
import { pushAppointmentToAirConnect } from "@/lib/airconnect/notify";
import { toSgE164 } from "@/lib/phone";

export const runtime = "nodejs";

const LOG = "[apply/book]";

type Body = { date: string; time: string; idNumber?: string };

/** Same convention as the pending UI - last 8 chars of lead UUID, uppercased. */
function cfh5ApplicationRef(leadId: string): string {
  return `CFH5-${leadId.slice(-8).toUpperCase()}`;
}


export async function POST(request: NextRequest) {
  const rawSession = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const session = rawSession ? (decodeSession(rawSession) ?? {}) : {};

  const offerRaw = request.cookies.get(APPROVAL_OFFER_COOKIE)?.value;
  const offer = offerRaw ? decodeApprovalOffer(offerRaw) : null;

  const leadId =
    (typeof session.leadId === "string" && session.leadId.length > 0
      ? session.leadId
      : null) ?? offer?.leadId ?? null;
  console.info(`${LOG} POST`, {
    hasSessionCookie: Boolean(rawSession),
    sessionDecoded: Boolean(session && Object.keys(session).length > 0),
    hasLeadId: Boolean(leadId),
    cfh5Hint: leadId ? cfh5ApplicationRef(String(leadId)) : undefined,
  });

  if (!leadId) {
    console.warn(`${LOG} reject: no leadId in session (cookie missing or stale)`);
    return NextResponse.json({ error: "No active application found" }, { status: 400 });
  }

  const body = (await request.json()) as Partial<Body>;
  const { date, time, idNumber } = body;

  if (!date || !time) {
    console.warn(`${LOG} reject: missing date or time`, { hasDate: Boolean(date), hasTime: Boolean(time) });
    return NextResponse.json({ error: "date and time are required" }, { status: 400 });
  }

  console.info(`${LOG} booking slot`, { date, time, idNumber: idNumber ?? null, cfh5Hint: cfh5ApplicationRef(leadId) });

  let appointment: { id: string };
  try {
    appointment = await insertAppointment({
      applicantId: leadId,
      date,
      time,
      status: "confirmed",
    });
  } catch (err) {
    console.error(`${LOG} insert appointment failed`, err);
    return NextResponse.json({ error: "Failed to book appointment" }, { status: 500 });
  }

  if (!appointment?.id) {
    console.error(`${LOG} insert returned no appointment id`);
    return NextResponse.json({ error: "Failed to book appointment" }, { status: 500 });
  }

  console.info(`${LOG} appointment saved`, {
    appointmentId: appointment.id,
    date,
    time,
    cfh5Hint: cfh5ApplicationRef(leadId),
  });

  // Applicant details for the AirConnect notification.
  const lead = await getApplicant(leadId);

  try {
    await setApplicantStatus(leadId, "appointed");
    console.info(`${LOG} applicant status → appointed`, { cfh5Hint: cfh5ApplicationRef(leadId) });
  } catch (err) {
    // The appointment itself is already booked; a status that did not move is
    // a reporting problem, not a lost booking.
    console.error(`${LOG} applicant status update failed`, err);
  }

  const loanAmount = Number(lead?.desired_amount ?? 0) || 0;
  const cfh5Id = cfh5ApplicationRef(leadId);

  if (!lead) {
    console.warn(`${LOG} lead row missing for notify (AirConnect may get empty name/phone)`, {
      cfh5Id,
    });
  }

  // Notify AirConnect - await so serverless completes the outbound fetch before freeze.
  // Booking still succeeds in DB even if AirConnect fails (errors logged above).
  await pushAppointmentToAirConnect(
    {
      applicantId: leadId,
      customerName: lead?.full_name ?? "",
      // Same format as the lead push at submit (lib/phone.ts) - AirConnect
      // matches the two calls by phone number, so they must agree.
      phoneNumber: toSgE164(lead?.mobile),
      appointmentDate: date,
      timeSlot: time,
      ...(idNumber ? { idNumber } : {}),
    },
    LOG,
  );

  const res = NextResponse.json({
    ok: true,
    appointmentId: appointment.id as string,
    cfh5Id,
    loanAmount,
    date,
    time,
  });

  for (const c of clearCookies()) {
    res.cookies.set(c);
  }
  res.cookies.set(clearApprovalOfferCookie());

  res.cookies.set(
    bookingConfirmCookieValue({
      appointmentId: appointment.id as string,
      cfh5Id,
      loanAmount,
      date,
      time,
      idType: typeof session.idType === "string" ? session.idType : undefined,
    }),
  );

  console.info(`${LOG} success - apply cookies cleared, booking_confirm set`, {
    appointmentId: appointment.id,
    cfh5Id,
    date,
    time,
  });

  return res;
}
