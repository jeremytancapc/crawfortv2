import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs against a real Postgres: what is under test is the table - its types,
 * its defaults, and that an applicant's row can go without taking the record of
 * what the model said about them.
 *
 *   TEST_DATABASE_URL=$(bash scripts/db-test-server.sh start) npx vitest run lib/db/income-model-calls
 */
const TEST_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_URL)("income_model_calls", () => {
  let recordIncomeModelCall: typeof import("./income-model-calls").recordIncomeModelCall;
  let listIncomeModelCalls: typeof import("./income-model-calls").listIncomeModelCalls;
  let insertApplicant: typeof import("./applicants").insertApplicant;
  let sql: typeof import("./sql").sql;
  let applicantId: string;

  const REPORT = {
    readable: true,
    documents: [{ index: 1, kind: "payslip", holderName: "TAN CAKEN", issuer: "KIMSENG" }],
    periods: [{ start: "2026-09-01", end: "2026-09-30", gross: 5200, net: 4160, employer: "KIMSENG", document: 1 }],
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL;
    ({ recordIncomeModelCall, listIncomeModelCalls } = await import("./income-model-calls"));
    ({ insertApplicant } = await import("./applicants"));
    ({ sql } = await import("./sql"));
    applicantId = await insertApplicant({ desiredAmount: 5000, loanTenure: 6, authMethod: "singpass", status: "in_progress" });
  });

  afterAll(async () => {
    await sql`delete from income_model_calls where applicant_id = ${applicantId}`;
    await sql`delete from applicants where id = ${applicantId}`;
  });

  it("stores the raw report with how it was made, and gives it back unchanged", async () => {
    await recordIncomeModelCall({
      applicantId,
      documentIds: ["8ce37959-8955-4742-bdb9-ec3f1572a6cc"],
      readingId: null,
      read: {
        reported: REPORT as never,
        modelId: "claude-opus-5",
        promptVersion: "abc123def456",
        stopReason: "tool_use",
        usage: { inputTokens: 1200, outputTokens: 340 },
        latencyMs: 6100,
      },
      readToday: new Date("2026-10-13T05:00:00Z"),
      employmentType: "EMPLOYED",
      outcome: { kind: "usable" },
    });

    const [row] = await listIncomeModelCalls(applicantId);

    expect(row.report).toEqual(REPORT);
    expect(row).toMatchObject({
      model_id: "claude-opus-5",
      prompt_version: "abc123def456",
      stop_reason: "tool_use",
      usage: { inputTokens: 1200, outputTokens: 340 },
      latency_ms: 6100,
      employment_type: "EMPLOYED",
      outcome_kind: "usable",
      reading_id: null,
    });
    expect(row.read_today).toBe("2026-10-13");
  });

  it("marks a row for keeping at least five years", async () => {
    const [row] = await listIncomeModelCalls(applicantId);
    const years = (new Date(row.retain_until).getTime() - new Date(row.created_at).getTime()) / (365 * 24 * 3600 * 1000);

    expect(years).toBeGreaterThan(4.99);
  });

  it("keeps a refusal's report and the sentence the applicant was shown", async () => {
    await recordIncomeModelCall({
      applicantId,
      documentIds: ["8ce37959-8955-4742-bdb9-ec3f1572a6cc"],
      readingId: null,
      read: { reported: REPORT as never, modelId: "claude-opus-5", promptVersion: "abc123def456", stopReason: "tool_use", usage: null, latencyMs: 4000 },
      readToday: new Date("2026-10-13T05:00:00Z"),
      employmentType: undefined,
      outcome: { kind: "needs_review", reason: "doc.pdf appears to belong to someone else" },
    });

    const rows = await listIncomeModelCalls(applicantId);

    expect(rows.find((r) => r.outcome_kind === "needs_review")?.outcome_reason).toMatch(/someone else/);
  });

  it("stores a call that returned no report as null, with why it stopped", async () => {
    await recordIncomeModelCall({
      applicantId,
      documentIds: [],
      readingId: null,
      read: { reported: null, modelId: "claude-opus-5", promptVersion: "abc123def456", stopReason: "max_tokens", usage: null, latencyMs: 9000 },
      readToday: new Date("2026-10-13T05:00:00Z"),
      employmentType: undefined,
      outcome: { kind: "unreadable", reason: "The documents could not be read." },
    });

    const rows = await listIncomeModelCalls(applicantId);
    const cut = rows.find((r) => r.stop_reason === "max_tokens");

    expect(cut?.report).toBeNull();
  });

  it("outlives the applicant's own row", async () => {
    const other = await insertApplicant({ desiredAmount: 1000, loanTenure: 3, authMethod: "singpass", status: "in_progress" });
    await recordIncomeModelCall({
      applicantId: other,
      documentIds: [],
      readingId: null,
      read: { reported: REPORT as never, modelId: "claude-opus-5", promptVersion: "abc123def456", stopReason: "tool_use", usage: null, latencyMs: 1 },
      readToday: new Date("2026-10-13T05:00:00Z"),
      employmentType: undefined,
      outcome: { kind: "usable" },
    });

    await sql`delete from applicants where id = ${other}`;
    const remaining = await listIncomeModelCalls(other);
    await sql`delete from income_model_calls where applicant_id = ${other}`;

    expect(remaining).toHaveLength(1);
  });

  it("never lets a failed write break the step it describes", async () => {
    // A row that cannot be written - here, no document ids at all, which the
    // column forbids being null - must be swallowed and logged, not thrown.
    await expect(
      recordIncomeModelCall({
        applicantId,
        documentIds: undefined as never,
        readingId: null,
        read: null,
        readToday: new Date("2026-10-13T05:00:00Z"),
        employmentType: undefined,
        outcome: { kind: "usable" },
      }),
    ).resolves.toBeUndefined();
  });
});
