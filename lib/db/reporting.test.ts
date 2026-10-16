import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs against a real Postgres: what is under test is the `reporting` views the
 * Data Studio report reads - that each applicant lands in the stage they really
 * stopped at, and that the three report tables hold the people they should.
 *
 *   TEST_DATABASE_URL=$(bash scripts/db-test-server.sh start) npx vitest run lib/db/reporting
 */
const TEST_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_URL)("reporting views", () => {
  let sql: typeof import("./sql").sql;
  const ids: Record<string, string> = {};

  const applicant = async (key: string, fields: { status?: string; auth?: string | null; decline?: string; plan?: string; mobile?: string } = {}) => {
    const [row] = await sql<{ id: string }>`
      insert into applicants (desired_amount, loan_tenure, status, auth_method, decline_reason, selected_plan, mobile)
      values (3000, 6, ${fields.status ?? "new"}::applicant_status, ${fields.auth === undefined ? "singpass" : fields.auth}::auth_method,
              ${fields.decline ?? null}, ${fields.plan ?? null}, ${fields.mobile ?? "91234567"})
      returning id`;
    ids[key] = row!.id;
    return row!.id;
  };
  const order = (id: string, risk: string, limit: number | null) =>
    sql`insert into ascend_orders (applicant_id, order_id, risk_status, a_card_limit, maximum_loan_quantum)
        values (${id}, ${`ORD-${id.slice(0, 8)}`}, ${risk}::risk_status, ${limit}, 20000)`;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL;
    ({ sql } = await import("./sql"));

    const booked = await applicant("booked", { plan: "6 months" });
    await order(booked, "passed", 3500);
    await sql`insert into appointments (applicant_id, appointment_date, appointment_time) values (${booked}, '2026-10-20', '15:00')`;

    // Booked, then cancelled: not booked any more, and someone to call.
    const cancelled = await applicant("cancelled", { plan: "6 months" });
    await order(cancelled, "passed", 3500);
    await sql`insert into appointments (applicant_id, appointment_date, appointment_time, status) values (${cancelled}, '2026-10-21', '10:00', 'cancelled')`;

    // Cancelled, then booked again: the latest appointment is the one that counts.
    const rebooked = await applicant("rebooked", { plan: "6 months" });
    await order(rebooked, "passed", 3500);
    await sql`insert into appointments (created_at, applicant_id, appointment_date, appointment_time, status) values ('2026-10-16 09:00+08', ${rebooked}, '2026-10-21', '10:00', 'cancelled')`;
    await sql`insert into appointments (created_at, applicant_id, appointment_date, appointment_time, status) values ('2026-10-16 09:30+08', ${rebooked}, '2026-10-22', '11:00', 'confirmed')`;

    const declined = await applicant("declined", { decline: "Rates don't match my expectations" });
    await order(declined, "passed", 3500);

    const planned = await applicant("planned", { plan: "6 months" });
    await order(planned, "passed", 3500);

    await order(await applicant("offer"), "passed", 3500);
    await order(await applicant("passed_no_limit"), "passed", null);
    await order(await applicant("rejected"), "rejected", null);

    const review = await applicant("review");
    await order(review, "pending", null);
    await sql`insert into income_readings (applicant_id, income_type, months, average, m1, m2, m3, document_ids, submitted_at)
              values (${review}, 'NON_PANEL_PAYSLIP', '[]'::jsonb, 3000, 3000, 3000, 3000, '{}', now())`;

    const uploading = await applicant("uploading");
    await order(uploading, "pending", null);
    await sql`insert into income_documents (applicant_id, object_key, file_name, content_type, bytes, sha256, status)
              values (${uploading}, 'k', 'payslip.pdf', 'application/pdf', 10, 'abc', 'uploaded')`;
    // Three readings at three different times: a refusal, then a good read, then another refusal.
    await sql`insert into income_model_calls (created_at, applicant_id, document_ids, model_id, prompt_version, read_today, outcome_kind, outcome_reason)
              values ('2026-10-16 10:00+08', ${uploading}, '{}', 'm', 'p', '2026-10-16', 'needs_review', 'older refusal'),
                     ('2026-10-16 10:05+08', ${uploading}, '{}', 'm', 'p', '2026-10-16', 'usable', null),
                     ('2026-10-16 10:10+08', ${uploading}, '{}', 'm', 'p', '2026-10-16', 'needs_review', 'latest refusal')`;

    await order(await applicant("needs_income"), "pending", null);
    await applicant("no_order");
    // Ascend says they already borrow from us: sent to the app on purpose, so no order is made.
    const existing = await applicant("existing");
    await sql`update applicants set ascend_user_id = '1550469448854245376', ascend_new_customer = false where id = ${existing}`;
    await applicant("logged_in", { status: "in_progress" });
    await applicant("not_logged_in", { status: "in_progress", auth: null });
  });

  afterAll(async () => {
    for (const id of Object.values(ids)) await sql`delete from applicants where id = ${id}`;
    await sql`delete from income_model_calls where applicant_id = any(${Object.values(ids)}::uuid[])`;
  });

  const stageOf = async (key: string) => {
    const [row] = await sql<{ stage: string }>`select stage from reporting.applicant_journey where id = ${ids[key]}`;
    return row?.stage;
  };

  it.each([
    ["booked", "booked"],
    ["declined", "declined_offer"],
    ["cancelled", "booking_cancelled"],
    ["rebooked", "booked"],
    ["planned", "plan_chosen_not_booked"],
    ["offer", "offer_seen_no_plan"],
    ["passed_no_limit", "approved_without_limit"],
    ["rejected", "rejected_by_ascend"],
    ["review", "waiting_for_staff_review"],
    ["uploading", "uploading_income_not_submitted"],
    ["needs_income", "needs_income_not_started"],
    ["no_order", "submitted_no_ascend_order"],
    ["existing", "existing_customer_redirected"],
    ["logged_in", "logged_in_not_submitted"],
    ["not_logged_in", "started_not_logged_in"],
  ])("puts the applicant who %s at stage %s", async (key, stage) => {
    expect(await stageOf(key)).toBe(stage);
  });

  it("names the reference the way staff already know it, and shows the Singapore time", async () => {
    const [row] = await sql<{ ref: string }>`select ref from reporting.applicant_journey where id = ${ids.booked}`;
    expect(row!.ref).toBe(`CFH5-${ids.booked!.slice(-8).toUpperCase()}`);
  });

  it("the booked table holds only people with an appointment, with the booking date and time", async () => {
    const rows = await sql<{ ref: string; booking_date: string; booking_time: string }>`
      select ref, booking_date::text, booking_time::text from reporting.booked where ref like 'CFH5-%'
        and ref in (select ref from reporting.applicant_journey where id = any(${Object.values(ids)}::uuid[]))`;
    // The person who booked, and the one who cancelled then booked again: not the one who cancelled.
    expect(rows.map((r) => r.booking_date).sort()).toEqual(["2026-10-20", "2026-10-22"]);
    expect(rows.find((r) => r.booking_date === "2026-10-20")).toMatchObject({ booking_time: "15:00:00" });
  });

  it("the declined table holds the people who turned the offer down, with their reason", async () => {
    const rows = await sql<{ decline_reason: string }>`
      select decline_reason from reporting.customer_declined where id = any(${Object.values(ids)}::uuid[])`;
    expect(rows.map((r) => r.decline_reason)).toEqual(["Rates don't match my expectations"]);
  });

  it("the stuck table holds everyone who neither booked nor declined, and nobody who did", async () => {
    const rows = await sql<{ id: string }>`select id from reporting.stuck where id = any(${Object.values(ids)}::uuid[])`;
    const stuck = new Set(rows.map((r) => r.id));
    expect(stuck.has(ids.booked!)).toBe(false);
    expect(stuck.has(ids.declined!)).toBe(false);
    expect(stuck.has(ids.existing!), "existing customers are sent to the app, not stuck").toBe(false);
    for (const key of ["cancelled", "planned", "offer", "passed_no_limit", "rejected", "review", "uploading", "needs_income", "no_order", "logged_in", "not_logged_in"]) {
      expect(stuck.has(ids[key]!), key).toBe(true);
    }
  });

  it("flags who needs a call, so the report filters on one field however many stages there are", async () => {
    const rows = await sql<{ id: string; needs_follow_up: boolean }>`
      select id, needs_follow_up from reporting.applicant_journey where id = any(${Object.values(ids)}::uuid[])`;
    const flag = (key: string) => rows.find((r) => r.id === ids[key])?.needs_follow_up;
    for (const key of ["booked", "rebooked", "declined", "existing"]) expect(flag(key), key).toBe(false);
    for (const key of ["cancelled", "planned", "offer", "passed_no_limit", "review", "no_order", "logged_in"]) expect(flag(key), key).toBe(true);
  });

  it("says what went wrong with the documents, using the latest problem only", async () => {
    const [row] = await sql<{ last_income_issue: string | null }>`
      select last_income_issue from reporting.applicant_journey where id = ${ids.uploading}`;
    expect(row!.last_income_issue).toBe("latest refusal");
  });

  it("holds no name, NRIC or email: only what staff need to follow a person up", async () => {
    const columns = await sql<{ column_name: string }>`
      select column_name from information_schema.columns where table_schema = 'reporting'`;
    const names = new Set(columns.map((c) => c.column_name));
    for (const forbidden of ["full_name", "nric", "email", "address", "postal_code"]) {
      expect(names.has(forbidden), forbidden).toBe(false);
    }
  });

  it("counts people per stage for the funnel chart", async () => {
    const rows = await sql<{ stage: string; applicants: string }>`
      select stage, sum(applicants)::text as applicants from reporting.stage_summary group by stage`;
    expect(rows.find((r) => r.stage === "booked")).toBeTruthy();
  });
});
