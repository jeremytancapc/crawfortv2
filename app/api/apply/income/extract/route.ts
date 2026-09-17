/**
 * POST /api/apply/income/extract
 *
 * Reads the applicant's uploaded payslips and answers with the monthly
 * figures. Nothing is sent to Ascend here - this is the step that turns
 * documents into numbers a person can check before anything is submitted.
 *
 * The files are held in memory for the length of the request and never
 * written to disk. They are payslips: someone's salary, employer and name.
 */

import { NextRequest, NextResponse } from "next/server";

import { extractIncome, type IncomeDocument } from "@/lib/income-extraction";

export const runtime = "nodejs";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 6;

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    // Distinct from "we could not read them": nothing was attempted. The
    // caller falls back to asking the applicant to type the figures.
    return NextResponse.json(
      { error: "not_configured", message: "Income reading is not switched on." },
      { status: 503 },
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
    const outcome = await extractIncome(documents);

    if (outcome.kind === "usable") {
      return NextResponse.json({
        status: "usable",
        months: outcome.months,
        m1: outcome.m1,
        m2: outcome.m2,
        m3: outcome.m3,
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
      { error: "We could not read those documents just now. Please try again." },
      { status: 502 },
    );
  }
}
