/**
 * The record of every shadow run of the income agent. See migration 0017.
 */

import type { AgentRun } from "../income-agent";
import { sql } from "./sql";

/**
 * Writes one row. Never throws: the run is a record made after the applicant
 * was answered, and nothing it does may reach them.
 */
export async function recordIncomeAgentRun(input: {
  applicantId: string;
  documentIds: string[];
  rules: { kind: string; reason?: string | null };
  run: AgentRun;
  readToday: Date;
  employmentType: string | undefined;
}): Promise<void> {
  const { run } = input;
  try {
    await sql`
      insert into income_agent_runs
        (applicant_id, document_ids, rule_kind, rule_reason, decision, agrees, agent_report, turns, tool_calls,
         stop_reason, usage, latency_ms, error, model_id, prompt_version, read_today, employment_type)
      values
        (${input.applicantId}, ${input.documentIds}::uuid[], ${input.rules.kind}, ${input.rules.reason ?? null},
         ${run.decision ? JSON.stringify(run.decision) : null}::jsonb, ${run.agrees},
         ${run.report ? JSON.stringify(run.report) : null}::jsonb, ${run.turns},
         ${run.toolCalls}::text[], ${run.stopReason}, ${JSON.stringify(run.usage)}::jsonb, ${run.latencyMs},
         ${run.error}, ${run.modelId}, ${run.promptVersion},
         ${input.readToday.toISOString().slice(0, 10)}::date, ${input.employmentType ?? null})`;
  } catch (err) {
    console.error("[income-agent-runs] could not record a run", err);
  }
}
