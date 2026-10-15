/**
 * Deletes the bytes of income documents that should be gone, and records it.
 *
 * Unsubmitted documents are kept for a short window rather than deleted the
 * moment the applicant leaves: someone who drops off and comes back the next
 * day finds their files still there. After that they are personal data we
 * have no reason to hold.
 */

import {
  listDocumentsNeedingDeletion,
  logIncomeDocumentEvent,
  markIncomeDocumentDeletedFromStorage,
  markIncomeDocumentExpired,
} from "@/lib/db/income-documents";

import { deleteDocument } from "./store";

export const RETENTION_DAYS = 7;

export async function sweepIncomeDocuments(): Promise<{
  checked: number;
  expired: number;
  deleted: number;
  failed: number;
}> {
  const docs = await listDocumentsNeedingDeletion(RETENTION_DAYS);
  let expired = 0;
  let deleted = 0;
  let failed = 0;

  for (const doc of docs) {
    if (doc.status === "uploaded" || doc.status === "read") {
      await markIncomeDocumentExpired(doc);
      expired += 1;
    }
    try {
      await deleteDocument(doc.object_key);
      await markIncomeDocumentDeletedFromStorage(doc);
      deleted += 1;
    } catch (err) {
      failed += 1;
      console.error("[income-documents sweep] could not delete", doc.id, err);
      await logIncomeDocumentEvent({
        applicantId: doc.applicant_id,
        documentId: doc.id,
        event: "delete_failed",
        detail: { objectKey: doc.object_key, error: String(err), during: "sweep" },
      });
    }
  }

  return { checked: docs.length, expired, deleted, failed };
}
