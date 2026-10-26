import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import fx from "./income-cases/chinese-name-stale-statement.json";
import { AGENT_MAX_TURNS, runIncomeAgent } from "./income-agent";
import type { IncomeDocument } from "./income-extraction";

const DOC: IncomeDocument = { fileName: "statement.pdf", mediaType: "application/pdf", bytes: Buffer.from("x") };
const CONTEXT = {
  applicant: fx.applicant,
  employmentType: fx.employmentType,
  today: new Date(fx.today),
};
const RULES_REFUSED = { kind: "needs_review", reason: "statement.pdf appears to belong to someone else." };
const RULES_USABLE = { kind: "usable" };

const use = (name: string, input: unknown, id = name) => ({ type: "tool_use", id, name, input });
const turn = (content: unknown[], stop = "tool_use") => ({
  content,
  stop_reason: stop,
  usage: { input_tokens: 1000, output_tokens: 200 },
});

const FINAL = (over: Record<string, unknown> = {}) =>
  use("final_decision", {
    outcome: "ask_customer",
    reason_codes: ["wrong_person", "stale_period"],
    customer_message: "Two things.",
    evidence: "name differs; statement is for 2025",
    ...over,
  });

/** Every tool result the agent was sent, in order (the messages array is shared, so read it once, after). */
function toolResults(create: ReturnType<typeof vi.fn>): string[] {
  const messages = create.mock.calls.at(-1)![0].messages as Array<{ role: string; content: unknown }>;
  return messages
    .filter((m) => m.role === "user" && Array.isArray(m.content))
    .flatMap((m) => (m.content as Array<{ type: string; content?: string }>).filter((b) => b.type === "tool_result"))
    .map((b) => b.content as string);
}

function fakeClient(turns: unknown[]) {
  const create = vi.fn();
  for (const t of turns) create.mockResolvedValueOnce(t);
  return { client: { messages: { create } } as unknown as Anthropic, create };
}

describe("runIncomeAgent", () => {
  it("lets the agent run the rules as a tool and reads its final decision", async () => {
    const { client, create } = fakeClient([
      turn([use("applicant_profile", {})]),
      turn([use("check_rules", fx.report)]),
      turn([FINAL()]),
    ]);

    const run = await runIncomeAgent([DOC], CONTEXT, RULES_REFUSED, { client });

    expect(run.decision).toMatchObject({ outcome: "ask_customer", reasonCodes: ["wrong_person", "stale_period"] });
    expect(run.toolCalls).toEqual(["applicant_profile", "check_rules", "final_decision"]);
    expect(run.turns).toBe(3);
    expect(run.usage).toEqual({ inputTokens: 3000, outputTokens: 600 });

    // What the rules said came back to the agent as the tool's result.
    expect(toolResults(create)[1]).toContain("someone else");
  });

  it("tells the agent who the applicant is, from the application", async () => {
    const { client, create } = fakeClient([turn([use("applicant_profile", {})]), turn([FINAL()])]);

    await runIncomeAgent([DOC], CONTEXT, RULES_REFUSED, { client });

    const result = toolResults(create)[0];
    expect(result).toContain(fx.applicant.name);
    expect(result).toContain("SELF EMPLOYED");
  });

  it("the agent cannot make a figure: check_rules answers from the rules, not from the agent", async () => {
    const forged = { ...fx.report, periods: [{ start: "2026-08-01", end: "2026-08-31", gross: 99999, net: 99999, employer: "x", document: 1 }] };
    const { client, create } = fakeClient([turn([use("check_rules", forged)]), turn([FINAL({ outcome: "hand_to_staff" })])]);

    await runIncomeAgent([DOC], CONTEXT, RULES_REFUSED, { client });

    const result = JSON.parse(toolResults(create)[0]);
    // The name still does not match, so the rules still refuse, whatever the agent reported.
    expect(result.kind).toBe("needs_review");
  });

  it("stops after the turn limit when the agent never decides", async () => {
    const { client, create } = fakeClient(Array.from({ length: 10 }, () => turn([use("applicant_profile", {})])));

    const run = await runIncomeAgent([DOC], CONTEXT, RULES_REFUSED, { client });

    expect(create).toHaveBeenCalledTimes(AGENT_MAX_TURNS);
    expect(run.decision).toBeNull();
    expect(run.stopReason).toBe("max_turns");
  });

  it("records no decision when the agent answers in words and never calls final_decision", async () => {
    const { client } = fakeClient([turn([{ type: "text", text: "I think it is fine." }], "end_turn")]);

    const run = await runIncomeAgent([DOC], CONTEXT, RULES_REFUSED, { client });

    expect(run.decision).toBeNull();
    expect(run.stopReason).toBe("end_turn");
  });

  it("records no decision for a final_decision that does not fit its form", async () => {
    const { client } = fakeClient([turn([FINAL({ outcome: "approve_the_loan" })])]);

    const run = await runIncomeAgent([DOC], CONTEXT, RULES_REFUSED, { client });

    expect(run.decision).toBeNull();
    expect(run.error).toMatch(/final_decision/);
  });

  it("never throws: a failed call is a record, not an error for the applicant", async () => {
    const create = vi.fn().mockRejectedValue(new Error("overloaded"));
    const client = { messages: { create } } as unknown as Anthropic;

    const run = await runIncomeAgent([DOC], CONTEXT, RULES_REFUSED, { client });

    expect(run.decision).toBeNull();
    expect(run.error).toContain("overloaded");
  });

  describe("agreement with the rules", () => {
    const agreement = async (rules: { kind: string }, outcome: string) => {
      const { client } = fakeClient([turn([FINAL({ outcome })])]);
      return (await runIncomeAgent([DOC], CONTEXT, rules, { client })).agrees;
    };

    it("agrees when both refuse, or both accept", async () => {
      expect(await agreement(RULES_REFUSED, "ask_customer")).toBe(true);
      expect(await agreement(RULES_REFUSED, "hand_to_staff")).toBe(true);
      expect(await agreement(RULES_USABLE, "accept")).toBe(true);
    });

    it("disagrees when the agent would accept what the rules refuse, even with a staff check", async () => {
      expect(await agreement(RULES_REFUSED, "accept")).toBe(false);
      expect(await agreement(RULES_REFUSED, "accept_with_staff_check")).toBe(false);
    });

    it("disagrees when the agent would refuse what the rules accept", async () => {
      expect(await agreement(RULES_USABLE, "ask_customer")).toBe(false);
    });

    it("has no verdict when there is no decision", async () => {
      const { client } = fakeClient([turn([{ type: "text", text: "?" }], "end_turn")]);
      expect((await runIncomeAgent([DOC], CONTEXT, RULES_USABLE, { client })).agrees).toBeNull();
    });
  });
});
