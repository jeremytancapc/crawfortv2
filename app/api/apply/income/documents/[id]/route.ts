/**
 * DELETE /api/apply/income/documents/:id
 *
 * The applicant took a document off. The bytes are deleted from the bucket -
 * a document they chose not to submit is not one we have any reason to keep -
 * and the row stays as the record that it existed and when it went.
 *
 * A submitted document cannot be removed: it is the evidence behind a credit
 * decision.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  getIncomeDocument,
  logIncomeDocumentEvent,
  markIncomeDocumentDeletedFromStorage,
  markIncomeDocumentRemoved,
} from "@/lib/db/income-documents";
import { isDatabaseConfigured } from "@/lib/db/sql";
import { deleteDocument } from "@/lib/documents/store";
import { applicantIdFromRequest } from "@/lib/income-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Not available right now." }, { status: 503 });
  }

  const applicantId = applicantIdFromRequest(request);
  if (!applicantId) {
    return NextResponse.json({ error: "No application in progress." }, { status: 400 });
  }

  const { id } = await params;
  // Scoped to the applicant: an id alone must never be enough to touch
  // someone else's document.
  const doc = /^[0-9a-f-]{36}$/i.test(id) ? await getIncomeDocument(applicantId, id) : null;
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  if (doc.status === "submitted") {
    return NextResponse.json(
      { error: "That document has already been submitted." },
      { status: 409 },
    );
  }

  if (doc.status === "uploaded" || doc.status === "read") {
    await markIncomeDocumentRemoved(doc);
  }

  if (!doc.deleted_from_storage_at) {
    try {
      await deleteDocument(doc.object_key);
      await markIncomeDocumentDeletedFromStorage(doc);
    } catch (err) {
      // Removed from the applicant's point of view, but the bytes are still
      // there. Left unmarked so the sweep deletes them on its next run.
      console.error("[apply/income/documents] could not delete the object", err);
      await logIncomeDocumentEvent({
        applicantId,
        documentId: doc.id,
        event: "delete_failed",
        detail: { objectKey: doc.object_key, error: String(err) },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
