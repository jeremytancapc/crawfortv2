/**
 * Runs the document-reader evals against the real model.
 *
 *   npx tsx --env-file=.env.local evals/run.mts --n 5
 *   npx tsx --env-file=.env.local evals/run.mts --case payslip-empno-3months --n 12
 *   npx tsx --env-file=.env.local evals/run.mts --lib /path/to/older/checkout --n 12
 *
 * Costs real money: every run is a model call on the documents. The summary
 * ends with what the run cost. `--lib` runs the same cases against another
 * checkout's reader, which is how the harness is shown to fail on a known bug.
 *
 * Each run is graded twice (see grade.ts): what the model reported, and what
 * our code decided from it. One line per run, with the raw reply, goes to
 * evals/results/ - git-ignored, because the replies carry names and amounts.
 */

import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { gradePipeline, gradeReader, percentile, type ExpectedPipeline, type ExpectedReader } from "./grade";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

/** List price per million tokens for claude-opus-5. Output includes thinking. Check the pricing page. */
const PRICE = { inputPerM: 5, outputPerM: 25 };

type Case = {
  id: string;
  description: string;
  tags: string[];
  today: string;
  env?: Record<string, string>;
  applicant: { name: string };
  employmentType: string;
  documents: Array<{ file: string; mediaType: string }>;
  expect: { reader?: ExpectedReader; pipeline: ExpectedPipeline };
};

type RunResult = {
  caseId: string;
  run: number;
  pass: boolean;
  critical: string[];
  warnings: string[];
  readerCritical: number;
  pipelineCritical: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  stopReason: string | null;
  outcome: unknown;
  reply: unknown;
  error?: string;
};

// ── Arguments ─────────────────────────────────────────────────────────────

function arg(name: string, fallback?: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : fallback;
}
const N = Number(arg("n", "5"));
const CONCURRENCY = Number(arg("concurrency", "4"));
const ONLY = arg("case")?.split(",");
const LIB = path.resolve(arg("lib", ROOT)!);
const LABEL = arg("label", path.basename(LIB));

// ── Cases ─────────────────────────────────────────────────────────────────

const casesDir = path.join(HERE, "cases");
const cases: Case[] = readdirSync(casesDir)
  .filter((f) => f.endsWith(".case.json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(path.join(casesDir, f), "utf8")) as Case)
  .filter((c) => !ONLY || ONLY.includes(c.id));

if (cases.length === 0) {
  console.error("No cases matched.");
  process.exit(2);
}

// Cases name a fictional bank the reader would otherwise refuse. The setting is
// process-wide, so cases must agree on it.
for (const c of cases) {
  for (const [key, value] of Object.entries(c.env ?? {})) {
    if (process.env[key] && process.env[key] !== value) {
      console.error(`Cases disagree on ${key}: ${process.env[key]} vs ${value}`);
      process.exit(2);
    }
    process.env[key] = value;
  }
}

// ── One run ───────────────────────────────────────────────────────────────

const real = new Anthropic();
const { extractIncome } = (await import(pathToFileURL(path.join(LIB, "lib/income-extraction.ts")).href)) as {
  extractIncome: (documents: unknown[], options: unknown) => Promise<{ kind: string; reason?: string }>;
};

async function runOnce(c: Case, run: number): Promise<RunResult> {
  let reply: unknown = null;
  let usage = { input: 0, output: 0 };
  let stopReason: string | null = null;
  let latencyMs = 0;

  // The reader's one model call goes through here so its reply, tokens and
  // time can be recorded without the reader knowing.
  const recording = {
    messages: {
      create: async (request: Anthropic.MessageCreateParamsNonStreaming) => {
        const started = Date.now();
        const response = await real.messages.create(request);
        latencyMs = Date.now() - started;
        usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };
        stopReason = response.stop_reason;
        reply = response.content.find((block) => block.type === "tool_use" && block.name === "report_income");
        return response;
      },
    },
  };

  const documents = c.documents.map((d) => ({
    fileName: path.basename(d.file),
    mediaType: d.mediaType,
    bytes: readFileSync(path.join(HERE, d.file)),
  }));

  let outcome: { kind: string; reason?: string } | null = null;
  let error: string | undefined;
  try {
    outcome = await extractIncome(documents, {
      client: recording,
      today: new Date(`${c.today}T00:00:00Z`),
      applicant: { name: c.applicant.name },
      employmentType: c.employmentType,
    });
  } catch (err) {
    error = String(err);
  }

  const input = (reply as { input?: Record<string, unknown> } | null)?.input ?? null;
  const readerGrade = c.expect.reader && input
    ? gradeReader(c.expect.reader, input as never, { employmentType: c.employmentType })
    : { critical: c.expect.reader ? ["the model made no report_income call"] : [], warnings: [] };
  const pipelineGrade = outcome ? gradePipeline(c.expect.pipeline, outcome as never) : { critical: [`threw: ${error}`], warnings: [] };

  const critical = [...readerGrade.critical.map((m) => `reader: ${m}`), ...pipelineGrade.critical.map((m) => `pipeline: ${m}`)];
  return {
    caseId: c.id,
    run,
    pass: critical.length === 0,
    critical,
    warnings: readerGrade.warnings,
    readerCritical: readerGrade.critical.length,
    pipelineCritical: pipelineGrade.critical.length,
    latencyMs,
    inputTokens: usage.input,
    outputTokens: usage.output,
    costUsd: (usage.input * PRICE.inputPerM + usage.output * PRICE.outputPerM) / 1_000_000,
    stopReason,
    outcome,
    reply: input,
    error,
  };
}

// ── Run everything, a few at a time ───────────────────────────────────────

const jobs = cases.flatMap((c) => Array.from({ length: N }, (_, i) => ({ c, run: i + 1 })));
const results: RunResult[] = [];
let done = 0;

console.log(`${cases.length} cases x ${N} runs = ${jobs.length} model calls (reader from ${LIB})`);

async function worker() {
  while (jobs.length) {
    const job = jobs.shift()!;
    const result = await runOnce(job.c, job.run);
    results.push(result);
    done += 1;
    process.stdout.write(`\r${done}/${done + jobs.length} done`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
process.stdout.write("\n\n");

// ── Report ────────────────────────────────────────────────────────────────

mkdirSync(path.join(HERE, "results"), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = path.join(HERE, "results", `${LABEL}-${stamp}.jsonl`);
writeFileSync(out, results.map((r) => JSON.stringify(r)).join("\n") + "\n");

const pad = (text: string, width: number) => (text.length > width ? text.slice(0, width - 1) + "…" : text.padEnd(width));
console.log(`${pad("case", 34)} ${pad("pass", 7)} ${pad("reader", 7)} ${pad("rules", 6)} ${pad("p50 s", 6)} ${pad("p95 s", 6)} ${pad("$/run", 6)}`);
let allPassed = true;
for (const c of cases) {
  const mine = results.filter((r) => r.caseId === c.id);
  const passed = mine.filter((r) => r.pass).length;
  if (passed !== mine.length) allPassed = false;
  const latencies = mine.map((r) => r.latencyMs / 1000);
  console.log(
    `${pad(c.id, 34)} ${pad(`${passed}/${mine.length}`, 7)} ${pad(String(mine.filter((r) => r.readerCritical).length), 7)} ${pad(String(mine.filter((r) => r.pipelineCritical).length), 6)} ` +
      `${pad(percentile(latencies, 50).toFixed(1), 6)} ${pad(percentile(latencies, 95).toFixed(1), 6)} ${pad((mine.reduce((s, r) => s + r.costUsd, 0) / mine.length).toFixed(2), 6)}`,
  );
}

const failures = new Map<string, number>();
for (const r of results) for (const m of r.critical) failures.set(`${r.caseId}: ${m}`, (failures.get(`${r.caseId}: ${m}`) ?? 0) + 1);
if (failures.size) {
  console.log("\nWhat failed (count of runs):");
  for (const [message, count] of [...failures].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(count).padStart(3)}x ${message}`);
}

const total = results.reduce((s, r) => s + r.costUsd, 0);
const all = results.map((r) => r.latencyMs / 1000);
console.log(
  `\nruns: ${results.length}   passed: ${results.filter((r) => r.pass).length}   cases passing every run: ${cases.filter((c) => results.filter((r) => r.caseId === c.id).every((r) => r.pass)).length}/${cases.length}`,
);
console.log(`cost: $${total.toFixed(2)} at list price (avg $${(total / results.length).toFixed(3)}/run)   latency p50 ${percentile(all, 50).toFixed(1)}s  p95 ${percentile(all, 95).toFixed(1)}s`);
console.log(`results: ${path.relative(ROOT, out)}`);
process.exit(allPassed ? 0 : 1);
