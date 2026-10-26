import { describe, expect, it, vi } from "vitest";

import type { AgentRun } from "./income-agent";
import { earlierRefusals, runShadow, shadowEnabled } from "./income-agent-shadow";
import type { IncomeDocument } from "./income-extraction";

const DOC: IncomeDocument = { fileName: "s.pdf", mediaType: "application/pdf", bytes: Buffer.from("x") };
const RUN = { decision: null, agrees: null, turns: 1 } as unknown as AgentRun;
const INPUT = {
  applicantId: "a-1",
  documentIds: ["d-1"],
  documents: [DOC],
  context: { applicant: { name: "TAN MEI" }, employmentType: "EMPLOYED", today: new Date("2026-10-24") },
  rules: { kind: "needs_review", reason: "r" },
};

describe("shadowEnabled", () => {
  it("is off unless switched on", () => {
    expect(shadowEnabled({} as never)).toBe(false);
    expect(shadowEnabled({ INCOME_AGENT_SHADOW: "false" } as never)).toBe(false);
    expect(shadowEnabled({ INCOME_AGENT_SHADOW: "true", ANTHROPIC_API_KEY: "k" } as never)).toBe(true);
  });

  it("is never on without a key to call the model with", () => {
    expect(shadowEnabled({ INCOME_AGENT_SHADOW: "true", ANTHROPIC_API_KEY: "" } as never)).toBe(false);
  });
});

describe("runShadow", () => {
  it("runs the agent and keeps the run next to what the rules decided", async () => {
    const run = vi.fn().mockResolvedValue(RUN);
    const record = vi.fn().mockResolvedValue(undefined);

    await runShadow(INPUT, { run, record });

    expect(run).toHaveBeenCalledWith(INPUT.documents, INPUT.context, INPUT.rules);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ applicantId: "a-1", documentIds: ["d-1"], rules: INPUT.rules, run: RUN, employmentType: "EMPLOYED" }),
    );
  });

  it("never throws, whatever goes wrong", async () => {
    const boom = vi.fn().mockRejectedValue(new Error("x"));

    await expect(runShadow(INPUT, { run: boom, record: boom })).resolves.toBeUndefined();
    await expect(runShadow(INPUT, { run: vi.fn().mockResolvedValue(RUN), record: boom })).resolves.toBeUndefined();
  });
});

describe("earlierRefusals", () => {
  const call = (outcome_kind: string, outcome_reason: string | null, created_at: unknown) => ({ created_at, outcome_kind, outcome_reason });

  it("lists what the applicant has already failed, with dates as text", async () => {
    const list = vi.fn().mockResolvedValue([
      call("needs_review", "Please add June.", new Date("2026-10-24T09:00:00Z")),
      call("usable", null, new Date("2026-10-24T09:10:00Z")),
    ]);

    expect(await earlierRefusals("a-1", list as never)).toEqual([
      { at: "2026-10-24T09:00:00.000Z", kind: "needs_review", reason: "Please add June." },
    ]);
    expect(list).toHaveBeenCalledWith("a-1");
  });

  it("gives none rather than failing when the history cannot be read", async () => {
    expect(await earlierRefusals("a-1", vi.fn().mockRejectedValue(new Error("db")) as never)).toEqual([]);
  });
});
