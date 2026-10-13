import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { decide, readAndDecide, readDocuments, type IncomeDocument } from "./income-extraction";

/**
 * The reader is two things: a call to the model that returns a report, and
 * plain code that decides from it. Kept apart, a decision can be made again
 * from the stored report - to see why it came out as it did, or to see who a
 * rule change would have affected - without paying for another call and
 * without the model answering differently the second time.
 */

const SEP = { start: "2026-09-01", end: "2026-09-30", gross: 5200, net: 4160, employer: "Kimseng Food", document: 1 };
const REPORT = {
  readable: true,
  note: "",
  documents: [{ index: 1, kind: "payslip", holderName: "TAN CAKEN", issuer: "Kimseng Food" }],
  periods: [SEP],
  statements: [],
  credits: [],
};

function fakeClient(input: unknown, extra: Record<string, unknown> = {}) {
  const create = vi.fn().mockResolvedValue({
    content: input === null ? [] : [{ type: "tool_use", id: "t", name: "report_income", input }],
    stop_reason: "tool_use",
    usage: { input_tokens: 1200, output_tokens: 340 },
    ...extra,
  });
  return { client: { messages: { create } } as unknown as Anthropic, create };
}

const DOC: IncomeDocument = { fileName: "slip.pdf", mediaType: "application/pdf", bytes: Buffer.from("x") };
const OPTIONS = { today: new Date("2026-10-02T00:00:00Z"), applicant: { name: "TAN CAKEN" }, employmentType: "EMPLOYED" };

describe("readDocuments - only the model call, and how it was made", () => {
  it("returns the model's raw report with the model, the prompt version, why it stopped and what it used", async () => {
    const { client } = fakeClient(REPORT);

    const read = await readDocuments([DOC], { client });

    expect(read.reported).toEqual(REPORT);
    expect(read.modelId).toBe("claude-opus-5");
    expect(read.promptVersion).toMatch(/^[0-9a-f]{12}$/);
    expect(read.stopReason).toBe("tool_use");
    expect(read.usage).toEqual({ inputTokens: 1200, outputTokens: 340 });
    expect(read.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("gives the same prompt version every time, so two replies can be compared by it", async () => {
    const a = await readDocuments([DOC], { client: fakeClient(REPORT).client });
    const b = await readDocuments([DOC], { client: fakeClient(REPORT).client });

    expect(a.promptVersion).toBe(b.promptVersion);
  });

  it("returns no report when the model made no report_income call, and says why it stopped", async () => {
    const { client } = fakeClient(null, { stop_reason: "max_tokens" });

    const read = await readDocuments([DOC], { client });

    expect(read.reported).toBeNull();
    expect(read.stopReason).toBe("max_tokens");
  });
});

describe("decide - pure code, from a report", () => {
  it("reaches the same decision as reading and deciding in one go", async () => {
    const { client } = fakeClient(REPORT);

    const { outcome, read } = await readAndDecide([DOC], { ...OPTIONS, client });
    const replayed = decide([DOC], read!, OPTIONS);

    expect(replayed).toEqual(outcome);
    expect(outcome.kind).toBe("usable");
  });

  it("can be run again with a different rule input over the same stored report", async () => {
    // The point of keeping the report: change a rule, or the date, and see what
    // it would have decided, without another model call.
    const { client } = fakeClient(REPORT);
    const { read } = await readAndDecide([DOC], { ...OPTIONS, client });

    const inOctober = decide([DOC], read!, OPTIONS);
    const muchLater = decide([DOC], read!, { ...OPTIONS, today: new Date("2027-03-02T00:00:00Z") });

    expect(inOctober.kind).toBe("usable");
    expect(muchLater.kind).toBe("needs_review"); // September is no longer a month we take
  });

  it("refuses, in a sentence, when there was no report", () => {
    const outcome = decide([DOC], { reported: null }, OPTIONS);

    expect(outcome.kind).toBe("unreadable");
    if (outcome.kind === "unreadable") expect(outcome.reason).toMatch(/could not be read/);
  });
});

describe("readAndDecide", () => {
  it("makes no model call when there is nothing to read", async () => {
    const { client, create } = fakeClient(REPORT);

    const { outcome, read } = await readAndDecide([], { ...OPTIONS, client });

    expect(create).not.toHaveBeenCalled();
    expect(read).toBeNull();
    expect(outcome.kind).toBe("unreadable");
  });

  it("keeps a refusal's raw report too - the replies most worth replaying", async () => {
    const wrongName = { ...REPORT, documents: [{ index: 1, kind: "payslip", holderName: "LIM WEI JIE", issuer: "X" }] };
    const { client } = fakeClient(wrongName);

    const { outcome, read } = await readAndDecide([DOC], { ...OPTIONS, client });

    expect(outcome.kind).toBe("needs_review");
    expect(read?.reported).toEqual(wrongName);
  });
});

describe("when the model makes no report", () => {
  /** A client that answers with each of `replies` in turn. */
  function sequence(...replies: Array<{ input: unknown | null; stop: string }>) {
    const create = vi.fn();
    for (const r of replies) {
      create.mockResolvedValueOnce({
        content: r.input === null ? [{ type: "text", text: "..." }] : [{ type: "tool_use", id: "t", name: "report_income", input: r.input }],
        stop_reason: r.stop,
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    }
    return { client: { messages: { create } } as unknown as Anthropic, create };
  }

  it("asks once more when it ran out of room, and uses the second answer", async () => {
    const { client, create } = sequence({ input: null, stop: "max_tokens" }, { input: REPORT, stop: "tool_use" });

    const { outcome, read, earlier } = await readAndDecide([DOC], { ...OPTIONS, client });

    expect(create).toHaveBeenCalledTimes(2);
    expect(outcome.kind).toBe("usable");
    expect(read?.reported).toEqual(REPORT);
    // The first, failed call is kept too: it is how a run of failures shows up.
    expect(earlier.map((e) => e.stopReason)).toEqual(["max_tokens"]);
  });

  it("asks once more when it answered in words instead of making the report", async () => {
    const { client, create } = sequence({ input: null, stop: "end_turn" }, { input: REPORT, stop: "tool_use" });

    const { outcome } = await readAndDecide([DOC], { ...OPTIONS, client });

    expect(create).toHaveBeenCalledTimes(2);
    expect(outcome.kind).toBe("usable");
  });

  it("does not ask a third time", async () => {
    const { client, create } = sequence({ input: null, stop: "max_tokens" }, { input: null, stop: "max_tokens" });

    const { outcome, earlier } = await readAndDecide([DOC], { ...OPTIONS, client });

    expect(create).toHaveBeenCalledTimes(2);
    expect(outcome.kind).toBe("unreadable");
    expect(earlier).toHaveLength(1);
  });

  it("does not ask again after a refusal - asking a model to reconsider a refusal is not a retry", async () => {
    const { client, create } = sequence({ input: null, stop: "refusal" });

    const { outcome } = await readAndDecide([DOC], { ...OPTIONS, client });

    expect(create).toHaveBeenCalledTimes(1);
    expect(outcome.kind).toBe("unreadable");
  });

  it("does not ask again when the first answer was good", async () => {
    const { client, create } = sequence({ input: REPORT, stop: "tool_use" });

    const { earlier } = await readAndDecide([DOC], { ...OPTIONS, client });

    expect(create).toHaveBeenCalledTimes(1);
    expect(earlier).toEqual([]);
  });

  it("tells the applicant it was on our side when it ran out of room, not that their documents are unclear", () => {
    const cut = decide([DOC], { reported: null, stopReason: "max_tokens" }, OPTIONS);
    const refused = decide([DOC], { reported: null, stopReason: "refusal" }, OPTIONS);

    expect(cut.kind === "unreadable" && cut.reason).toMatch(/try again|fewer/i);
    expect(cut.kind === "unreadable" && cut.reason).not.toMatch(/clear/i);
    expect(refused.kind === "unreadable" && refused.reason).toMatch(/clear/i);
  });
});
