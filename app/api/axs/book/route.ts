/**
 * POST /api/axs/book
 *
 * Books an appointment for an AXS customer.
 * Validates the signed token, then saves the appointment + notifies AirConnect.
 *
 * Body: { date: "YYYY-MM-DD", time: "HH:MM", token: "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { getApplicant, setApplicantStatus } from "@/lib/db/applicants";
import { insertAppointment } from "@/lib/db/appointments";
import { verifyAxsToken } from "@/lib/axs-token";
import { pushAppointmentToAirConnect } from "@/lib/airconnect/notify";

export const runtime = "nodejs";

const LOG = "[axs/book]";

type Body = { date: string; time: string; token: string };

function cfh5ApplicationRef(leadId: string): string {
  return `CFH5-${leadId.replace(/-/g, "").slice(-8).toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<Body>;
  const { date, time, token } = body;

  if (!date || !time || !token) {
    return NextResponse.json({ error: "date, time, and token are required" }, { status: 400 });
  }

  // Validate token
  const payload = verifyAxsToken(token);
  if (!payload) {
    console.warn(`${LOG} reject: invalid or expired token`);
    return NextResponse.json({ error: "Invalid or expired booking link" }, { status: 401 });
  }

  const { leadId, axsRef, approvedAmount } = payload;
  const cfh5Id = cfh5ApplicationRef(leadId);

  console.info(`${LOG} POST`, { leadId, axsRef, cfh5Id, date, time });

  const lead = await getApplicant(leadId);

  if (!lead) {
    console.error(`${LOG} lead not found`, { leadId });
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

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

  await setApplicantStatus(leadId, "appointed");

  console.info(`${LOG} appointment saved`, { appointmentId: appointment.id, cfh5Id, date, time });

  // Notify AirConnect
  await pushAppointmentToAirConnect(
    {
      applicantId: leadId,
      customerName: lead.full_name ?? "",
      phoneNumber: lead.mobile ?? "",
      appointmentDate: date,
      timeSlot: time,
      idNumber: lead.nric ?? undefined,
    },
    LOG,
  );

  return NextResponse.json({
    ok: true,
    appointmentId: appointment.id as string,
    cfh5Id,
    loanAmount: approvedAmount,
    date,
    time,
  });
}
