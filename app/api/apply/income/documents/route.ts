/**
 * GET /api/apply/income/documents
 *
 * What is stored for this applicant right now. The screen asks on load, so a
 * reload shows the documents that are really there - including ones from an
 * earlier visit, which count against the limit and were invisible before.
 *
 * POST /api/apply/income/documents
 *
 * Stores one income document the moment the applicant adds it, and answers
 * with its id. Reading and submitting then work from the stored copy by id,
 * so what was read is always what was kept - and what is sent to Ascend.
 *
 * Nothing is sent to Ascend here.
 */

import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getApplicant } from "@/lib/db/applicants";
import {
  insertIncomeDocument,
  listActiveIncomeDocuments,
  logIncomeDocumentEvent,
} from "@/lib/db/income-documents";
import { isDatabaseConfigured } from "@/lib/db/sql";
import { documentKey } from "@/lib/documents/links";
import { documentsConfigured, putDocument } from "@/lib/documents/store";
import { findDuplicate } from "@/lib/income-document-rules";
import { applicantIdFromRequest } from "@/lib/income-session";

export const runtime = "nodejs";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 6;

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured() || !documentsConfigured()) {
    return NextResponse.json({ error: "Uploads are not available right now." }, { status: 503 });
  }

  const applicantId = applicantIdFromRequest(request);
  if (!applicantId || !(await getApplicant(applicantId))) {
    return NextResponse.json({ error: "No application in progress." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `${file.name} is larger than 10 MB.` }, { status: 400 });
  }
  if (!ACCEPTED.includes(file.type)) {
    return NextResponse.json({ error: `${file.name} is not a PDF, JPG or PNG.` }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  // The same file again reuses the first. It is checked before the limit: a
  // copy of something already stored is not a new document, and refusing it
  // for the count would tell someone they have too many for a file they have
  // already added.
  const active = await listActiveIncomeDocuments(applicantId);
  const existing = findDuplicate(active, sha256);
  if (existing) {
    return NextResponse.json({
      id: existing.id,
      name: existing.file_name,
      bytes: existing.bytes,
      duplicate: true,
    });
  }
  if (active.length >= MAX_FILES) {
    return NextResponse.json({ error: `At most ${MAX_FILES} documents.` }, { status: 400 });
  }

  const objectKey = documentKey(applicantId, file.name);

  try {
    await putDocument({ objectKey, contentType: file.type, bytes });
  } catch (err) {
    console.error("[apply/income/documents] could not store the document", err);
    await logIncomeDocumentEvent({
      applicantId,
      event: "upload_failed",
      detail: { fileName: file.name, bytes: bytes.byteLength, error: String(err) },
    });
    return NextResponse.json(
      { error: "We could not save that document. Please try again." },
      { status: 502 },
    );
  }

  const doc = await insertIncomeDocument({
    applicantId,
    objectKey,
    fileName: file.name,
    contentType: file.type,
    bytes: bytes.byteLength,
    sha256,
  });

  return NextResponse.json({ id: doc.id, name: doc.file_name, bytes: doc.bytes });
}

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ documents: [] });
  }
  const applicantId = applicantIdFromRequest(request);
  if (!applicantId) return NextResponse.json({ documents: [] });

  const active = await listActiveIncomeDocuments(applicantId);
  return NextResponse.json({
    documents: active.map((doc) => ({
      id: doc.id,
      name: doc.file_name,
      bytes: doc.bytes,
      status: doc.status,
      readingId: doc.reading_id,
    })),
  });
}
