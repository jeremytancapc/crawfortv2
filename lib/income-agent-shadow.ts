/**
 * Runs the income agent on a submission that has already been answered, and
 * keeps what it would have done. Off unless INCOME_AGENT_SHADOW=true.
 */

import { runIncomeAgent, type AgentRun } from "./income-agent";
import { recordIncomeAgentRun } from "./db/income-agent-runs";
import type { IncomeDocument } from "./income-extraction";

export function shadowEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.INCOME_AGENT_SHADOW === "true" && Boolean(env.ANTHROPIC_API_KEY?.trim());
}

type Input = {
  applicantId: string;
  documentIds: string[];
  documents: IncomeDocument[];
  context: Parameters<typeof runIncomeAgent>[1];
  /** What the live rules decided on the same documents. */
  rules: { kind: string; reason?: string | null };
};

type Deps = {
  run: (documents: IncomeDocument[], context: Input["context"], rules: Input["rules"]) => Promise<AgentRun>;
  record: typeof recordIncomeAgentRun;
};

/**
 * Never throws. It runs after the applicant has their answer, so a failure
 * here has nobody to tell - it is logged and nothing else.
 */
export async function runShadow(input: Input, deps?: Partial<Deps>): Promise<void> {
  try {
    const run = await (deps?.run ?? runIncomeAgent)(input.documents, input.context, input.rules);
    await (deps?.record ?? recordIncomeAgentRun)({
      applicantId: input.applicantId,
      documentIds: input.documentIds,
      rules: input.rules,
      run,
      readToday: input.context.today,
      employmentType: input.context.employmentType,
    });
  } catch (err) {
    console.error("[income-agent-shadow] a shadow run failed", err);
  }
}
