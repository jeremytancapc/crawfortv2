/** Branch appointments. */

import { sql, sqlOne } from "./sql";
import type { Appointment, AppointmentStatus } from "./types";

export async function insertAppointment(input: {
  applicantId: string;
  date: string;
  time: string;
  status?: AppointmentStatus;
  notes?: string | null;
}): Promise<Appointment> {
  const row = await sqlOne<Appointment>`
    insert into appointments (applicant_id, appointment_date, appointment_time, status, notes)
    values (${input.applicantId}, ${input.date}, ${input.time},
            ${input.status ?? "confirmed"}, ${input.notes ?? null})
    returning *`;

  if (!row) throw new Error("insertAppointment returned no row");
  return row;
}

/** The most recent booking, which is the one that counts after a rebooking. */
export function getLatestAppointment(applicantId: string): Promise<Appointment | null> {
  return sqlOne<Appointment>`
    select * from appointments
    where applicant_id = ${applicantId}
    order by created_at desc limit 1`;
}

export async function cancelAppointment(id: string, reason: string | null): Promise<void> {
  await sql`
    update appointments
    set status = 'cancelled', cancelled_at = now(), cancellation_reason = ${reason}
    where id = ${id}`;
}
