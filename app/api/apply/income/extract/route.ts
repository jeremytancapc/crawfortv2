/**
 * POST /api/apply/income/extract
 *
 * Reads the applicant's stored payslips, bank statements or earnings
 * statements - named by id, as stored by /api/apply/income/documents - and
 * answers with the monthly figures. Nothing is sent to Ascend here - this is
 * the step that turns documents into numbers a person can check before
 * anything is submitted.
 *
 * What was read is recorded as a reading, tied to exactly those documents.
 * Submit works from that record, not from anything the browser says back.
 */

import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, decodeSession } from "@/lib/apply-session";
import { getApplicant } from "@/lib/db/applicants";
import { getMyinfoProfile } from "@/lib/db/myinfo-profiles";
import {
  getIncomeDocument,
  insertIncomeReading,
  logIncomeDocumentEvent,
  type IncomeDocument as StoredIncomeDocument,
} from "@/lib/db/income-documents";
import { isDatabaseConfigured } from "@/lib/db/sql";
import { getDocumentBytes } from "@/lib/documents/store";
import type { CpfProfile } from "@/lib/income-cpf";
import { extractIncome, type IncomeDocument } from "@/lib/income-extraction";
import { MAX_INCOME_FILES } from "@/lib/income-add-more";
import { applicantIdFromRequest } from "@/lib/income-session";
import { looksLikeLeadUuid } from "@/lib/lead-id";

export const runtime = "nodejs";

const MAX_FILES = MAX_INCOME_FILES;

/**
 * The name the documents must carry: the one on the application Ascend is
 * scoring, as Singpass gave it, or the signed session's copy where the
 * database has none.
 */
async function applicantName(request: NextRequest): Promise<string | null> {
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value ?? "") ?? {};
  const leadId = (session as { leadId?: string }).leadId ?? "";

  if (isDatabaseConfigured() && looksLikeLeadUuid(leadId)) {
    try {
      const stored = (await getApplicant(leadId))?.full_name?.trim();
      if (stored) return stored;
    } catch (err) {
      console.error("[apply/income/extract] applicant lookup failed", err);
    }
  }
  return session.fullName?.trim() || null;
}

/** What is known of the applicant's CPF, or undefined when MyInfo is not on file. */
async function cpfProfileOf(applicantId: string): Promise<CpfProfile | undefined> {
  if (!isDatabaseConfigured()) return undefined;
  try {
    const profile = await getMyinfoProfile(applicantId);
    const dob = (profile?.processed_payload as { dob?: string } | undefined)?.dob ?? "";
    if (!profile || !dob) return undefined;
    return { dob, paysCpf: ["singaporean", "pr", "C", "P"].includes(profile.residential_status ?? "") };
  } catch (err) {
    console.error("[apply/income/extract] CPF profile lookup failed", err);
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    // Distinct from "we could not read them": nothing was attempted. `error`
    // is the code for our logs and `message` is the half an applicant sees,
    // so the two must not be swapped - a screen showing "not_configured"
    // tells them nothing and looks broken.
    return NextResponse.json(
      {
        error: "not_configured",
        // The applicant did nothing wrong and can do nothing about it, so
        // this says what they can do - try later - while `error` tells us
        // what actually needs fixing.
        message: "We cannot read documents right now. Please try again shortly.",
      },
      { status: 503 },
    );
  }

  // No name, no reading: a payslip cannot be checked as theirs against nobody.
  const name = await applicantName(request);
  if (!name) {
    return NextResponse.json(
      {
        error: "no_applicant",
        message: "We could not find your application. Please start again from Singpass.",
      },
      { status: 400 },
    );
  }

  const applicantId = applicantIdFromRequest(request);
  if (!applicantId) {
    return NextResponse.json({ error: "No application in progress." }, { status: 400 });
  }

  let ids: string[] = [];
  try {
    const body = (await request.json()) as { documentIds?: unknown };
    ids = Array.isArray(body.documentIds)
      ? [...new Set(body.documentIds.filter((id): id is string => typeof id === "string"))]
      : [];
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (ids.length === 0) {
    return NextResponse.json({ error: "No documents were attached." }, { status: 400 });
  }
  if (ids.length > MAX_FILES) {
    return NextResponse.json({ error: `At most ${MAX_FILES} documents.` }, { status: 400 });
  }

  // Every id must be this applicant's, and still in play. A removed or
  // submitted document cannot be part of a new reading.
  const stored: StoredIncomeDocument[] = [];
  for (const id of ids) {
    const doc = /^[0-9a-f-]{36}$/i.test(id) ? await getIncomeDocument(applicantId, id) : null;
    if (!doc || (doc.status !== "uploaded" && doc.status !== "read")) {
      return NextResponse.json(
        { error: "One of those documents is no longer available. Please add it again." },
        { status: 409 },
      );
    }
    stored.push(doc);
  }

  const documents: IncomeDocument[] = [];
  for (const doc of stored) {
    const bytes = await getDocumentBytes(doc.object_key);
    if (!bytes) {
      await logIncomeDocumentEvent({
        applicantId,
        documentId: doc.id,
        event: "read_failed",
        detail: { reason: "object missing from storage", objectKey: doc.object_key },
      });
      return NextResponse.json(
        { error: `We could not find ${doc.file_name}. Please add it again.` },
        { status: 409 },
      );
    }
    documents.push({ fileName: doc.file_name, mediaType: doc.content_type, bytes });
  }

  try {
    const outcome = await extractIncome(documents, { applicant: { name }, cpf: await cpfProfileOf(applicantId) });

    if (outcome.kind === "usable") {
      const kindOf = (fileType: string) =>
        fileType === "BANK_STATEMENT_OTHER_INCOME" ? "bank_statement" : outcome.source;
      const ignored = new Set(outcome.ignoredIndices);
      const ignoredNames = stored.filter((_, i) => ignored.has(i)).map((doc) => doc.file_name);
      // Said to the applicant, because a file they added that we did not use
      // would otherwise look like it had been counted.
      const advice =
        ignoredNames.length > 0
          ? [
              outcome.advice,
              `We did not use ${ignoredNames.join(" or ")} - ${ignoredNames.length === 1 ? "it is" : "they are"} outside the months we need, and ${ignoredNames.length === 1 ? "it" : "they"} will not be sent.`,
            ]
              .filter(Boolean)
              .join(" ")
          : outcome.advice;
      const reading = await insertIncomeReading({
        applicantId,
        incomeType: outcome.incomeType,
        months: outcome.months,
        average: outcome.months.reduce((sum, m) => sum + m.amount, 0) / outcome.months.length,
        m1: outcome.m1,
        m2: outcome.m2,
        m3: outcome.m3,
        advice,
        nameNotShown: outcome.nameNotShown,
        usedDocumentIds: stored.filter((_, i) => !ignored.has(i)).map((doc) => doc.id),
        documents: stored.map((doc, i) => ({
          id: doc.id,
          kind: kindOf(outcome.fileTypes[i] ?? outcome.incomeType),
          fileType: outcome.fileTypes[i] ?? outcome.incomeType,
        })),
      });
      return NextResponse.json({
        status: "usable",
        readingId: reading.id,
        missing: outcome.missing,
        months: outcome.months,
        m1: outcome.m1,
        m2: outcome.m2,
        m3: outcome.m3,
        // What Ascend is told the figures came from, and what each file is -
        // a payslip is PANEL only when a bank statement shows its pay arriving.
        incomeType: outcome.incomeType,
        fileTypes: outcome.fileTypes,
        // Which months would confirm the figure, when fewer than three were
        // read, and any file not used. Shown, never blocking.
        advice,
      });
    }

    await logIncomeDocumentEvent({
      applicantId,
      event: "read_not_usable",
      detail: { outcome: outcome.kind, reason: outcome.reason, documentIds: ids },
    });

    // Both "unreadable" and "needs_review" come back the same way: figures
    // exist or they do not, and a human decides. The reason is written to be
    // shown to the applicant - when the documents were readable it names the
    // payslip that would finish the application, so the screen can print it
    // as-is rather than repeating "upload 3 payslips".
    return NextResponse.json({
      status: outcome.kind,
      reason: outcome.reason,
      months: outcome.months,
      // What is already covered, so the screen can show progress instead of
      // only what is wrong.
      covered: outcome.assembly.months.map((m) => m.month),
      incomplete: outcome.assembly.incomplete,
    });
  } catch (err) {
    console.error("[apply/income/extract] extraction failed", err);
    await logIncomeDocumentEvent({
      applicantId,
      event: "read_failed",
      detail: { error: String(err), documentIds: ids },
    });
    return NextResponse.json(
      {
        error: "extraction_failed",
        message: "We could not read those documents just now. Please try again.",
      },
      { status: 502 },
    );
  }
}
