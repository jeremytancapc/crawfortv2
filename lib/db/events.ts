/**
 * Diagnostics: funnel events and outbound API calls.
 *
 * Both writes swallow their errors. A diagnostics table that can break the
 * funnel it exists to diagnose is worse than no diagnostics - and unlike the
 * applicant's own data, a lost row here costs nothing anyone can feel.
 */

import { sql } from "./sql";
import { isDatabaseConfigured } from "./sql";

export async function insertApplyFlowEvent(row: Record<string, unknown>): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await sql`
      insert into apply_flow_events (
        trace_id, event, environment, vercel_deployment_id, singpass_raw_key,
        apply_trace_id, mobile_last4, nric_last4, had_existing_session_cookie,
        had_activate_token, token_decode_ok, had_apply_gate_cookie,
        cookie_existing_bytes, cookie_token_bytes, cookie_merged_bytes,
        cookie_may_exceed_4kb, resume_would_pass, user_agent, referer,
        request_path, details
      ) values (
        ${row.trace_id}, ${row.event}, ${row.environment ?? null},
        ${row.vercel_deployment_id ?? null}, ${row.singpass_raw_key ?? null},
        ${row.apply_trace_id ?? null}, ${row.mobile_last4 ?? null},
        ${row.nric_last4 ?? null}, ${row.had_existing_session_cookie ?? false},
        ${row.had_activate_token ?? false}, ${row.token_decode_ok ?? null},
        ${row.had_apply_gate_cookie ?? null}, ${row.cookie_existing_bytes ?? null},
        ${row.cookie_token_bytes ?? null}, ${row.cookie_merged_bytes ?? null},
        ${row.cookie_may_exceed_4kb ?? null}, ${row.resume_would_pass ?? null},
        ${row.user_agent ?? null}, ${row.referer ?? null}, ${row.request_path ?? null},
        ${JSON.stringify(row.details ?? {})}::jsonb
      )`;
  } catch (err) {
    console.error("[apply-flow-log] insert failed", err);
  }
}

export async function insertApiLog(row: Record<string, unknown>): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await sql`
      insert into api_logs (
        tag, method, url, request_headers, request_body, response_status,
        response_ok, response_body, duration_ms, applicant_id, error
      ) values (
        ${row.tag}, ${row.method}, ${row.url},
        ${JSON.stringify(row.request_headers ?? {})}::jsonb,
        ${row.request_body == null ? null : JSON.stringify(row.request_body)}::jsonb,
        ${row.response_status ?? null}, ${row.response_ok ?? null},
        ${row.response_body ?? null}, ${row.duration_ms ?? null},
        ${row.applicant_id ?? null}, ${row.error ?? null}
      )`;
  } catch (err) {
    console.error("[api-log] insert failed", err);
  }
}
