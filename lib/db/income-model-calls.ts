/**
 * The record of every call to the document-reading model: its raw report, how
 * it was made, and what our code decided from it. See migration 0009 for why.
 */

import type { ExtractionOutcome, ModelRead } from "../income-extraction";
import { sql } from "./sql";

export type IncomeModelCallRow = {
  id: string;
  created_at: string;
  retain_until: string;
  applicant_id: string;
  reading_id: string | null;
  document_ids: string[];
  model_id: string;
  prompt_version: string;
  stop_reason: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  latency_ms: number | null;
  read_today: string;
  employment_type: string | null;
  report: Record<string, unknown> | null;
  outcome_kind: string;
  outcome_reason: string | null;
};

/**
 * Writes one row. Never throws: this is a record of a step, and it must not be
 * able to break that step - an applicant must not lose their reading because
 * the audit row could not be written. A lost row is logged, because it is the
 * one thing this table is for.
 */
export async function recordIncomeModelCall(input: {
  applicantId: string;
  documentIds: string[];
  readingId: string | null;
  /** Null when no model call was made. */
  read: ModelRead | null;
  /** The date the rules were run against. */
  readToday: Date;
  employmentType: string | undefined;
  outcome: Pick<ExtractionOutcome, "kind"> & { reason?: string };
}): Promise<void> {
  if (!input.read) return;
  try {
    await sql`
      insert into income_model_calls
        (applicant_id, reading_id, document_ids, model_id, prompt_version, stop_reason, usage,
         latency_ms, read_today, employment_type, report, outcome_kind, outcome_reason)
      values
        (${input.applicantId}, ${input.readingId}, ${input.documentIds}::uuid[], ${input.read.modelId},
         ${input.read.promptVersion}, ${input.read.stopReason},
         ${input.read.usage ? JSON.stringify(input.read.usage) : null}::jsonb,
         ${input.read.latencyMs}, ${input.readToday.toISOString().slice(0, 10)}::date,
         ${input.employmentType ?? null},
         ${input.read.reported ? JSON.stringify(input.read.reported) : null}::jsonb,
         ${input.outcome.kind}, ${input.outcome.reason ?? null})`;
  } catch (err) {
    console.error("[income-model-calls] could not record a model call", err);
  }
}

/** An applicant's recorded calls, oldest first. */
export function listIncomeModelCalls(applicantId: string): Promise<IncomeModelCallRow[]> {
  // read_today as text: pg turns a `date` into a Date at local midnight, which
  // reads back a day off in any timezone east of UTC.
  return sql<IncomeModelCallRow>`
    select id, created_at, retain_until, applicant_id, reading_id, document_ids, model_id,
           prompt_version, stop_reason, usage, latency_ms, read_today::text as read_today,
           employment_type, report, outcome_kind, outcome_reason
      from income_model_calls where applicant_id = ${applicantId} order by created_at`;
}
