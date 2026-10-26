/**
 * The income agent, run in SHADOW: it makes the decision alongside the rules
 * and is written down, and never shown to the applicant.
 *
 * The reader (lib/income-extraction.ts) is one call that fills in a form, and
 * plain code decides from it. That code is strict where a person would not be:
 * a payslip printing the Singpass name plus a Chinese name is refused as
 * someone else's. Here the model makes the decision, with the rules as one of
 * its tools. What it can and cannot do:
 *
 *   - It reads the documents and calls `check_rules` with its report. The rules
 *     answer; the model never states a figure of its own, so it cannot
 *     invent income.
 *   - It judges the rules' answer - is this refusal right, what is the whole
 *     reason - and calls `final_decision`.
 *   - It runs for a bounded number of turns (AGENT_MAX_TURNS), never throws, and
 *     every run is a record, so the two decisions can be compared before the
 *     agent is given any say.
 */

import Anthropic from "@anthropic-ai/sdk";

import {
  decide,
  MODEL_ID,
  REPORT_INCOME_TOOL,
  SYSTEM,
  type DecideOptions,
  type IncomeDocument,
  type Reported,
} from "./income-extraction";
import { versionOf } from "./prompt-version";

/** Reading, checking, deciding - with room for one second look. */
export const AGENT_MAX_TURNS = 5;

/** Per model call, so a stuck call cannot hold the run open. */
const CALL_TIMEOUT_MS = 90_000;

export const AGENT_OUTCOMES = ["accept", "accept_with_staff_check", "ask_customer", "hand_to_staff"] as const;
export const AGENT_REASON_CODES = [
  "wrong_person",
  "name_not_found",
  "stale_period",
  "missing_months",
  "not_income_document",
  "unrecognised_bank",
  "weekly_not_monthly",
  "unreadable",
  "repeated_refusals",
  "other",
] as const;

export type AgentOutcome = (typeof AGENT_OUTCOMES)[number];
export type AgentReasonCode = (typeof AGENT_REASON_CODES)[number];

export type AgentDecision = {
  outcome: AgentOutcome;
  reasonCodes: AgentReasonCode[];
  customerMessage: string;
  evidence: string;
};

export type AgentRun = {
  /** Null when the agent never decided - see `stopReason` and `error`. */
  decision: AgentDecision | null;
  /** True when it and the rules would send the applicant the same way; null with no decision. */
  agrees: boolean | null;
  turns: number;
  toolCalls: string[];
  /**
   * The report the agent last sent to check_rules: its own reading of the
   * documents. Kept so that a disagreement with the rules can be traced to
   * the two readings differing, or to the two judgements. Null if it never ran the rules.
   */
  report: Reported | null;
  /** The last stop reason, or "max_turns". */
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
  modelId: string;
  promptVersion: string;
  error: string | null;
};

/** One time the applicant was refused, as they were told. */
export type PastAttempt = { at: string; kind: string; reason: string | null };

/**
 * What the applicant has actually failed, from their recorded model calls:
 * refusals only. A usable result is not a failure, and neither is our own
 * second go at a call that made no report - that one the applicant never saw.
 */
export function failedAttempts(
  calls: Array<{ created_at: string; outcome_kind: string; outcome_reason: string | null }>,
): PastAttempt[] {
  return calls
    .filter((c) => c.outcome_kind !== "usable")
    .filter((c) => !(c.outcome_reason ?? "").includes("asked again"))
    .map((c) => ({ at: c.created_at, kind: c.outcome_kind, reason: c.outcome_reason }));
}

type Context = {
  /** Earlier refusals of this applicant, oldest first - see failedAttempts. */
  attempts?: PastAttempt[];
  applicant: { name: string; aliases?: string[] };
  employmentType?: string;
  today: Date;
  cpf?: DecideOptions["cpf"];
};

const AGENT_ADDENDUM = `

HOW YOU WORK IN THIS TASK
Everything above says how to read the documents. In this task you also decide
whether they can be used as the applicant's income, and what to tell the
applicant if not. Call check_rules wherever the instructions above say to call
report_income. You have three tools:
- applicant_profile: who the applicant is according to Singpass, and what
  their employment status is.
- previous_attempts: the times this applicant has already been refused, and
  what they were told each time.
- check_rules: send your report, with the same fields as report_income. It
  returns what Crawfort's rules decide - the usable months, or the reason for
  refusing. The rules do the arithmetic and choose the months; you never state
  a figure of your own.
- final_decision: your decision. Call it once, last.
Call applicant_profile and previous_attempts first, then check_rules with your
report, then final_decision.

Judging the rules' answer:
- When the rules say usable, accept unless the documents plainly contradict it.
- When the rules refuse because the name differs, look at whether the printed
  name is plainly the same person: the Singpass name with a Chinese or other
  given name added, the same words in another order, an initial for a name. If
  so choose accept_with_staff_check and put the matching words in evidence. A
  different person's name is ask_customer with wrong_person.
- When more than one thing is wrong, name every one in the customer message, so
  the applicant fixes them in one go.
- Say the real reason in plain, gentle words. Never say or imply that the
  applicant's income is too low or that they are not eligible.
- Count what the applicant has failed, not your own turns: only refusals
  count, never a usable result. If they have been refused 3 or more times
  already and this attempt is refused as well, do not ask them to upload again.
  Choose hand_to_staff with repeated_refusals, and tell them gently that our
  team will help them from here.
- When you are not sure, choose hand_to_staff.`;

export const AGENT_SYSTEM = SYSTEM + AGENT_ADDENDUM;

const PROFILE_TOOL: Anthropic.Tool = {
  name: "applicant_profile",
  description: "Who the applicant is according to Singpass, and their employment status.",
  input_schema: { type: "object", additionalProperties: false, properties: {} },
};

const ATTEMPTS_TOOL: Anthropic.Tool = {
  name: "previous_attempts",
  description: "The times this applicant has already been refused, and what they were told each time.",
  input_schema: { type: "object", additionalProperties: false, properties: {} },
};

const CHECK_RULES_TOOL: Anthropic.Tool = {
  ...REPORT_INCOME_TOOL,
  name: "check_rules",
  description:
    "Run Crawfort's income rules on your report of the documents. Returns what the rules decide: " +
    "the usable months, or the reason for refusing.",
};

const FINAL_TOOL: Anthropic.Tool = {
  name: "final_decision",
  description: "Your decision about these documents. Call it once, last.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      outcome: {
        type: "string",
        enum: [...AGENT_OUTCOMES],
        description:
          "accept: usable as the rules say. accept_with_staff_check: the documents are the applicant's although " +
          "the rules refuse, so staff should confirm. ask_customer: the applicant must fix something. " +
          "hand_to_staff: a person should look.",
      },
      reason_codes: {
        type: "array",
        items: { type: "string", enum: [...AGENT_REASON_CODES] },
        description: "Every reason, for ask_customer and hand_to_staff. Empty for accept.",
      },
      customer_message: {
        type: "string",
        description: "What to tell the applicant, in plain gentle words, naming every reason. Empty for accept.",
      },
      evidence: {
        type: "string",
        description: "The words or facts in the documents your decision rests on.",
      },
    },
    required: ["outcome", "reason_codes", "customer_message", "evidence"],
  },
};

const TOOLS: Anthropic.Tool[] = [PROFILE_TOOL, ATTEMPTS_TOOL, CHECK_RULES_TOOL, FINAL_TOOL];

export const AGENT_PROMPT_VERSION = versionOf(AGENT_SYSTEM, TOOLS);

function parseDecision(input: unknown): AgentDecision | null {
  if (!input || typeof input !== "object") return null;
  const d = input as Record<string, unknown>;
  if (!AGENT_OUTCOMES.includes(d.outcome as AgentOutcome)) return null;
  const codes = Array.isArray(d.reason_codes) ? d.reason_codes : null;
  if (!codes || !codes.every((c) => AGENT_REASON_CODES.includes(c as AgentReasonCode))) return null;
  if (typeof d.customer_message !== "string" || typeof d.evidence !== "string") return null;
  return {
    outcome: d.outcome as AgentOutcome,
    reasonCodes: codes as AgentReasonCode[],
    customerMessage: d.customer_message,
    evidence: d.evidence,
  };
}

/** Would the agent send the applicant the same way the rules did? */
function agreement(rules: { kind: string }, decision: AgentDecision | null): boolean | null {
  if (!decision) return null;
  const rulesAccept = rules.kind === "usable";
  // Accepting with a staff check is not what the rules did, even when both end
  // with the income being used: it is the disagreement worth reading.
  return decision.outcome === "accept" ? rulesAccept : !rulesAccept && decision.outcome !== "accept_with_staff_check";
}

function content(documents: IncomeDocument[]): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = documents.flatMap((doc, i) => [
    { type: "text" as const, text: `Document ${i + 1}:` },
    doc.mediaType === "application/pdf"
      ? {
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: doc.bytes.toString("base64") },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: doc.mediaType as "image/jpeg" | "image/png",
            data: doc.bytes.toString("base64"),
          },
        },
  ]);
  // The last block marks where the cached prefix ends, so each later turn
  // pays for the documents once rather than again.
  blocks.push({
    type: "text",
    text: `Read the ${documents.length} document(s) above, check them against the rules, and decide.`,
    cache_control: { type: "ephemeral" },
  });
  return blocks;
}

/**
 * Runs the agent over the documents. `rules` is what the live rules decided,
 * for the comparison only - the agent is not told it.
 */
export async function runIncomeAgent(
  documents: IncomeDocument[],
  context: Context,
  rules: { kind: string; reason?: string | null },
  options?: { client?: Anthropic },
): Promise<AgentRun> {
  const started = Date.now();
  const usage = { inputTokens: 0, outputTokens: 0 };
  const toolCalls: string[] = [];
  let decision: AgentDecision | null = null;
  let report: Reported | null = null;
  let stopReason: string | null = null;
  let error: string | null = null;
  let turns = 0;

  try {
    const client = options?.client ?? new Anthropic();
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: content(documents) }];
    const decideOptions: DecideOptions = {
      today: context.today,
      applicant: context.applicant,
      employmentType: context.employmentType,
      cpf: context.cpf,
    };

    for (turns = 1; turns <= AGENT_MAX_TURNS; ) {
      const response = await client.messages.create(
        {
          model: MODEL_ID,
          max_tokens: 16000,
          thinking: { type: "adaptive" },
          system: AGENT_SYSTEM,
          tools: TOOLS,
          messages,
        },
        { timeout: CALL_TIMEOUT_MS },
      );
      usage.inputTokens += response.usage?.input_tokens ?? 0;
      usage.outputTokens += response.usage?.output_tokens ?? 0;
      stopReason = response.stop_reason ?? null;
      messages.push({ role: "assistant", content: response.content });

      const calls = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (calls.length === 0) break;

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const call of calls) {
        toolCalls.push(call.name);
        if (call.name === "final_decision") {
          decision = parseDecision(call.input);
          if (!decision) error = "final_decision did not fit its form";
          break;
        }
        if (call.name === "check_rules") report = call.input as Reported;
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: answerTool(call, documents, context, decideOptions),
        });
      }
      if (decision || error) break;

      messages.push({ role: "user", content: results });
      if (turns === AGENT_MAX_TURNS) {
        stopReason = "max_turns";
        break;
      }
      turns += 1;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return {
    decision,
    agrees: agreement(rules, decision),
    report,
    turns,
    toolCalls,
    stopReason,
    usage,
    latencyMs: Date.now() - started,
    modelId: MODEL_ID,
    promptVersion: AGENT_PROMPT_VERSION,
    error,
  };
}

function answerTool(
  call: Anthropic.ToolUseBlock,
  documents: IncomeDocument[],
  context: Context,
  decideOptions: DecideOptions,
): string {
  if (call.name === "applicant_profile") {
    return JSON.stringify({
      singpassName: context.applicant.name,
      otherNamesOnFile: context.applicant.aliases ?? [],
      employmentStatus: context.employmentType ?? null,
    });
  }
  if (call.name === "previous_attempts") {
    const attempts = context.attempts ?? [];
    return JSON.stringify({ refusedBefore: attempts.length, attempts });
  }
  if (call.name === "check_rules") {
    const outcome = decide(documents, { reported: call.input as Reported }, decideOptions);
    return JSON.stringify({
      kind: outcome.kind,
      reason: outcome.kind === "usable" ? null : outcome.reason,
      months: outcome.months,
      advice: outcome.kind === "usable" ? outcome.advice : null,
    });
  }
  return JSON.stringify({ error: `unknown tool ${call.name}` });
}
