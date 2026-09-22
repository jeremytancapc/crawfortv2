/**
 * POST /api/aip/book
 *
 * Creates a lead + appointment for an AIP (pre-approved) customer.
 * These customers skip Singpass / manual review - they only supply their
 * mobile number then book directly.
 *
 * Body: { date: "YYYY-MM-DD", time: "HH:MM" }
 * Reads:  aip_session cookie  →  { mobile }
 * Writes: aip_booking_confirm cookie
 * Clears: aip_session cookie
 */
import { NextRequest, NextResponse } from "next/server";
import {
  decodeAipSession,
  AIP_SESSION_COOKIE,
  aipBookingConfirmCookieValue,
  clearAipSessionCookie,
} from "@/lib/aip-session";
import { insertApplicant } from "@/lib/db/applicants";
import { insertAppointment } from "@/lib/db/appointments";
import { pushAppointmentToAirConnect } from "@/lib/airconnect/notify";

export const runtime = "nodejs";

const LOG = "[aip/book]";

type Body = { date: string; time: string };

function cfh5ApplicationRef(leadId: string): string {
  return `CFH5-${leadId.slice(-8).toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  const rawSession = request.cookies.get(AIP_SESSION_COOKIE)?.value ?? "";
  const session = rawSession ? decodeAipSession(rawSession) : null;

  console.info(`${LOG} POST`, {
    hasSessionCookie: Boolean(rawSession),
    hasMobile: Boolean(session?.mobile),
  });

  if (!session?.mobile) {
    console.warn(`${LOG} reject: no aip_session cookie or stale`);
    return NextResponse.json(
      { error: "No active pre-approval session. Please start again." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Partial<Body>;
  const { date, time } = body;

  if (!date || !time) {
    console.warn(`${LOG} reject: missing date or time`, { hasDate: Boolean(date), hasTime: Boolean(time) });
    return NextResponse.json({ error: "date and time are required" }, { status: 400 });
  }

  // Create the applicant row - AIP applicants skip every form step, so most
  // fields are null.
  const e164Phone = `+65${session.mobile}`;

  let leadId: string;
  try {
    leadId = await insertApplicant({
      mobile: e164Phone,
      authMethod: "aip",
      // Pre-approved, booking directly: there is no desired amount or term
      // because AIP applicants never see the form that collects them.
      status: "appointed",
      desiredAmount: 0,
      loanTenure: 0,
      moneylenderNoLoans: false,
    });
  } catch (leadError) {
    console.error(`${LOG} insert applicant failed`, leadError);
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }

  const cfh5Id = cfh5ApplicationRef(leadId);

  console.info(`${LOG} lead created`, { leadId, cfh5Id });

  let appointment: { id: string };
  try {
    appointment = await insertAppointment({
      applicantId: leadId,
      date,
      time,
      status: "confirmed",
    });
  } catch (apptError) {
    console.error(`${LOG} insert appointment failed`, apptError);
    return NextResponse.json({ error: "Failed to book appointment" }, { status: 500 });
  }

  console.info(`${LOG} appointment saved`, { appointmentId: appointment.id, date, time, cfh5Id });

  // Notify AirConnect - await so serverless completes the outbound fetch before freeze.
  await pushAppointmentToAirConnect(
    {
      applicantId: leadId,
      customerName: "AIP Lead",
      phoneNumber: e164Phone,
      appointmentDate: date,
      timeSlot: time,
    },
    LOG,
  );

  const res = NextResponse.json({
    ok: true,
    appointmentId: appointment.id as string,
    cfh5Id,
    date,
    time,
  });

  res.cookies.set(clearAipSessionCookie());
  res.cookies.set(
    aipBookingConfirmCookieValue({
      appointmentId: appointment.id as string,
      cfh5Id,
      date,
      time,
    }),
  );

  console.info(`${LOG} success - aip_session cleared, aip_booking_confirm set`, {
    appointmentId: appointment.id,
    cfh5Id,
    date,
    time,
  });

  return res;
}
