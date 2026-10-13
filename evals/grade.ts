/**
 * Grading one run of the document reader.
 *
 * Pure code, no model calls - every field is checkable by code, so no model
 * grades a model. A run is graded twice, because the two failures look the
 * same from outside and are fixed in different places:
 *
 *   reader    the structured reply the model gave (what it read off the page)
 *   pipeline  what our code then decided from that reply
 *
 * "The model misread" and "our rule is wrong" are different bugs. Grading
 * only the outcome hides which one it was.
 *
 * `critical` failures fail the run. `warnings` are reported and never fail it:
 * a label that changes no total, a credit nobody counts, a stray extra.
 */

import { applicantSafeNote, creditsCountedFor } from "../lib/income-extraction";

export type Grade = { critical: string[]; warnings: string[] };

export type ExpectedReader = {
  readable?: boolean;
  documents?: Array<{ index: number; kind: string; holderName?: string; issuer?: string }>;
  periods?: Array<{ start: string; end: string; gross: number; net?: number }>;
  statements?: Array<{ start: string; end: string }>;
  credits?: Array<{ date: string; amount: number; category: string }>;
};

export type ExpectedPipeline = {
  /** One kind, or several when a refusal can arrive by more than one route. */
  kind: string | string[];
  incomeType?: string;
  m1?: number;
  m2?: number;
  m3?: number;
  /** A regular expression the refusal reason must match. */
  reasonMatches?: string;
};

type ReaderReply = {
  readable?: boolean;
  note?: string;
  documents?: Array<{ index: number; kind: string; holderName: string; issuer: string }>;
  periods?: Array<{ start: string; end: string; gross: number; net?: number }>;
  statements?: Array<{ start: string; end: string }>;
  credits?: Array<{ date: string; amount: number; category: string }>;
};

/** Within a cent: amounts are printed to two places. Compared in whole cents,
 *  because 5200.01 - 5200 is 0.0100000000002 in floating point. */
const close = (a: number, b: number) => Math.round(Math.abs(a - b) * 100) <= 1;
const norm = (text: string) => text.trim().replace(/\s+/g, " ").toUpperCase();

export function gradeReader(
  expected: ExpectedReader,
  reply: ReaderReply,
  context: { employmentType?: string } = {},
): Grade {
  const critical: string[] = [];
  const warnings: string[] = [];

  if (expected.readable !== undefined && reply.readable !== expected.readable) {
    critical.push(`readable: expected ${expected.readable}, got ${reply.readable}`);
  }

  // What the model writes for an applicant to read must be a sentence. Two
  // scanned payslips once came back with the model's own tool-call syntax here.
  // It only reaches an applicant when the document could not be read, so that is
  // when it is critical; beside a good reading it is thrown away, so only noted.
  const note = (reply.note ?? "").trim();
  if (note && applicantSafeNote(note) !== note) {
    const message = `note is not a plain sentence: ${JSON.stringify(note.slice(0, 80))}`;
    (reply.readable === false ? critical : warnings).push(message);
  }

  for (const want of expected.documents ?? []) {
    const got = reply.documents?.find((d) => d.index === want.index);
    if (!got) {
      critical.push(`document ${want.index}: not reported`);
      continue;
    }
    if (got.kind !== want.kind) critical.push(`document ${want.index} kind: expected ${want.kind}, got ${got.kind}`);
    if (want.issuer && !norm(got.issuer).includes(norm(want.issuer))) {
      critical.push(`document ${want.index} issuer: expected to contain ${want.issuer}, got ${JSON.stringify(got.issuer)}`);
    }
    if (want.holderName !== undefined) {
      // The property first: a number in the name is the failure that flaked one
      // run in four, and it deserves its own message.
      if (/\d/.test(got.holderName)) {
        critical.push(`document ${want.index} holderName contains a digit: ${JSON.stringify(got.holderName)}`);
      } else if (norm(got.holderName) !== norm(want.holderName)) {
        critical.push(`document ${want.index} holderName: expected ${want.holderName}, got ${JSON.stringify(got.holderName)}`);
      }
    }
  }

  for (const want of expected.periods ?? []) {
    const got = reply.periods?.find((p) => p.start === want.start);
    if (!got) {
      critical.push(`period ${want.start}: not reported`);
      continue;
    }
    if (got.end !== want.end) critical.push(`period ${want.start} end: expected ${want.end}, got ${got.end}`);
    if (!close(got.gross, want.gross)) critical.push(`period ${want.start} gross: expected ${want.gross}, got ${got.gross}`);
    if (want.net !== undefined && !close(got.net ?? 0, want.net)) {
      critical.push(`period ${want.start} net: expected ${want.net}, got ${got.net}`);
    }
  }
  const expectedStarts = new Set((expected.periods ?? []).map((p) => p.start));
  if (expected.periods) {
    for (const got of reply.periods ?? []) {
      if (!expectedStarts.has(got.start)) warnings.push(`period ${got.start}..${got.end} not expected`);
    }
  }

  if (expected.statements) {
    const key = (s: { start: string; end: string }) => `${s.start}..${s.end}`;
    const want = expected.statements.map(key).sort().join(" | ");
    const got = (reply.statements ?? []).map(key).sort().join(" | ");
    if (want !== got) critical.push(`statement periods: expected ${want}, got ${got || "none"}`);
  }

  if (expected.credits) {
    const unmatched = [...(reply.credits ?? [])];
    for (const want of expected.credits) {
      const at = unmatched.findIndex((c) => c.date === want.date && close(c.amount, want.amount));
      const counts = creditsCountedFor(context.employmentType).has(want.category as never);
      if (at === -1) {
        (counts ? critical : warnings).push(`credit ${want.date} ${want.amount}: not reported`);
        continue;
      }
      const [got] = unmatched.splice(at, 1);
      if (got.category !== want.category) {
        const countsAs = creditsCountedFor(context.employmentType).has(got.category as never);
        if (countsAs !== counts) {
          critical.push(
            `credit ${want.date} ${want.amount}: ${want.category} read as ${got.category}, which changes whether it is counted`,
          );
        } else {
          warnings.push(`credit ${want.date} ${want.amount}: category ${want.category} read as ${got.category} (same counted result)`);
        }
      }
    }
    for (const extra of unmatched) {
      warnings.push(`credit ${extra.date} ${extra.amount} (${extra.category}) not expected`);
    }
  }

  return { critical, warnings };
}

export function gradePipeline(
  expected: ExpectedPipeline,
  outcome: { kind: string; incomeType?: string; m1?: number; m2?: number; m3?: number; reason?: string },
): Grade {
  const critical: string[] = [];

  const kinds = Array.isArray(expected.kind) ? expected.kind : [expected.kind];
  if (!kinds.includes(outcome.kind)) critical.push(`kind: expected ${kinds.join(" or ")}, got ${outcome.kind}`);
  if (expected.incomeType !== undefined && outcome.incomeType !== expected.incomeType) {
    critical.push(`incomeType: expected ${expected.incomeType}, got ${outcome.incomeType}`);
  }
  for (const key of ["m1", "m2", "m3"] as const) {
    const want = expected[key];
    if (want !== undefined && !close(outcome[key] ?? Number.NaN, want)) {
      critical.push(`${key}: expected ${want}, got ${outcome[key]}`);
    }
  }
  if (expected.reasonMatches !== undefined && !new RegExp(expected.reasonMatches, "i").test(outcome.reason ?? "")) {
    critical.push(`reason: expected to match /${expected.reasonMatches}/, got ${JSON.stringify(outcome.reason ?? "")}`);
  }

  return { critical, warnings: [] };
}

/** Nearest-rank percentile. 0 for an empty list. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}
