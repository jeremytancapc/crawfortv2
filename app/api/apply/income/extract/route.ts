/**
 * POST /api/apply/income/extract
 *
 * Reads the applicant's uploaded payslips, bank statements or earnings
 * statements and answers with the monthly
 * figures. Nothing is sent to Ascend here - this is the step that turns
 * documents into numbers a person can check before anything is submitted.
 *
 * The files are held in memory for the length of the request and never
 * written to disk. They are payslips: someone's salary, employer and name.
 */

import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, decodeSession } from "@/lib/apply-session";
import { getApplicant } from "@/lib/db/applicants";
import { isDatabaseConfigured } from "@/lib/db/sql";
import { extractIncome, type IncomeDocument } from "@/lib/income-extraction";
import { looksLikeLeadUuid } from "@/lib/lead-id";

export const runtime = "nodejs";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 6;

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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No documents were attached." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `At most ${MAX_FILES} documents.` }, { status: 400 });
  }
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `${file.name} is larger than 10 MB.` }, { status: 400 });
    }
    if (!ACCEPTED.includes(file.type)) {
      return NextResponse.json(
        { error: `${file.name} is not a PDF, JPG or PNG.` },
        { status: 400 },
      );
    }
  }

  const documents: IncomeDocument[] = await Promise.all(
    files.map(async (file) => ({
      fileName: file.name,
      mediaType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    })),
  );

  try {
    const outcome = await extractIncome(documents, { applicant: { name } });

    if (outcome.kind === "usable") {
      return NextResponse.json({
        status: "usable",
        months: outcome.months,
        m1: outcome.m1,
        m2: outcome.m2,
        m3: outcome.m3,
        // What Ascend is told the figures came from, and what each file is -
        // a payslip is PANEL only when a bank statement shows its pay arriving.
        incomeType: outcome.incomeType,
        fileTypes: outcome.fileTypes,
        // Which months would confirm the figure, when fewer than three were
        // read. Shown, never blocking.
        advice: outcome.advice,
      });
    }

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
    return NextResponse.json(
      {
        error: "extraction_failed",
        message: "We could not read those documents just now. Please try again.",
      },
      { status: 502 },
    );
  }
}
