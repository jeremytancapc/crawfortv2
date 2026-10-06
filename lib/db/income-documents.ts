/**
 * Income documents, the readings taken from them, and the log of what
 * happened to both.
 *
 * Every state change writes an event in the same transaction-sized step, so
 * the log cannot say less than the table. The events table is append-only:
 * nothing here updates or deletes a row in it.
 */

import { sql, sqlOne } from "./sql";

export type IncomeDocumentStatus = "uploaded" | "read" | "submitted" | "removed" | "expired";

export type IncomeDocument = {
  id: string;
  created_at: string;
  applicant_id: string;
  object_key: string;
  file_name: string;
  content_type: string;
  bytes: number;
  sha256: string;
  status: IncomeDocumentStatus;
  kind: string | null;
  file_type: string | null;
  reading_id: string | null;
  read_at: string | null;
  submitted_at: string | null;
  removed_at: string | null;
  deleted_from_storage_at: string | null;
  ascend_file_url: string | null;
};

export type IncomeReading = {
  id: string;
  created_at: string;
  applicant_id: string;
  income_type: string;
  months: Array<{ month: string; amount: number; employer: string | null }>;
  average: string;
  m1: string;
  m2: string;
  m3: string;
  advice: string | null;
  document_ids: string[];
  name_not_shown_for: string[];
  used_document_ids: string[] | null;
  submitting_at: string | null;
  submitted_at: string | null;
};

export type IncomeDocumentEvent =
  | "uploaded"
  | "upload_failed"
  | "removed"
  | "deleted_from_storage"
  | "delete_failed"
  | "read"
  | "read_not_usable"
  | "read_failed"
  | "submitted"
  | "submit_failed"
  | "expired";

export async function logIncomeDocumentEvent(input: {
  applicantId: string;
  event: IncomeDocumentEvent;
  documentId?: string | null;
  readingId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await sql`
      insert into income_document_events (applicant_id, document_id, reading_id, event, detail)
      values (${input.applicantId}, ${input.documentId ?? null}, ${input.readingId ?? null},
              ${input.event}, ${JSON.stringify(input.detail ?? {})}::jsonb)`;
  } catch (err) {
    // The log must not be able to break the step it describes, but a lost
    // row is worth a console line: it is the one thing this table is for.
    console.error("[income-documents] could not write event", input.event, err);
  }
}

export async function insertIncomeDocument(input: {
  applicantId: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  bytes: number;
  sha256: string;
}): Promise<IncomeDocument> {
  const row = await sqlOne<IncomeDocument>`
    insert into income_documents
      (applicant_id, object_key, file_name, content_type, bytes, sha256)
    values (${input.applicantId}, ${input.objectKey}, ${input.fileName},
            ${input.contentType}, ${input.bytes}, ${input.sha256})
    returning *`;
  if (!row) throw new Error("insertIncomeDocument returned no row");
  await logIncomeDocumentEvent({
    applicantId: input.applicantId,
    documentId: row.id,
    event: "uploaded",
    detail: { fileName: input.fileName, contentType: input.contentType, bytes: input.bytes, sha256: input.sha256 },
  });
  return row;
}

/** The applicant's documents that are still in play: stored, read, not removed. */
export function listActiveIncomeDocuments(applicantId: string): Promise<IncomeDocument[]> {
  return sql<IncomeDocument>`
    select * from income_documents
    where applicant_id = ${applicantId} and status in ('uploaded', 'read')
    order by created_at`;
}

/** One document, but only if it is this applicant's - never trust an id alone. */
export function getIncomeDocument(
  applicantId: string,
  id: string,
): Promise<IncomeDocument | null> {
  return sqlOne<IncomeDocument>`
    select * from income_documents where id = ${id} and applicant_id = ${applicantId}`;
}

export async function markIncomeDocumentRemoved(doc: IncomeDocument): Promise<void> {
  await sql`
    update income_documents set status = 'removed', removed_at = now(),
      reading_id = null, kind = null, file_type = null
    where id = ${doc.id} and status in ('uploaded', 'read')`;
  await logIncomeDocumentEvent({
    applicantId: doc.applicant_id,
    documentId: doc.id,
    event: "removed",
    detail: { fileName: doc.file_name },
  });
}

export async function markIncomeDocumentDeletedFromStorage(doc: IncomeDocument): Promise<void> {
  await sql`update income_documents set deleted_from_storage_at = now() where id = ${doc.id}`;
  await logIncomeDocumentEvent({
    applicantId: doc.applicant_id,
    documentId: doc.id,
    event: "deleted_from_storage",
    detail: { objectKey: doc.object_key },
  });
}

/**
 * Records a reading and ties it to the exact documents it came from.
 * Documents of an earlier reading are re-tagged: a document belongs to at
 * most one reading, the latest.
 */
export async function insertIncomeReading(input: {
  applicantId: string;
  incomeType: string;
  months: IncomeReading["months"];
  average: number;
  m1: number;
  m2: number;
  m3: number;
  advice: string | null;
  /** File names accepted although they show no name. */
  nameNotShown: string[];
  /** Ids of the documents that fed the months; the rest are not sent to Ascend. */
  usedDocumentIds: string[];
  documents: Array<{ id: string; kind: string; fileType: string }>;
}): Promise<IncomeReading> {
  const ids = input.documents.map((d) => d.id);
  const row = await sqlOne<IncomeReading>`
    insert into income_readings
      (applicant_id, income_type, months, average, m1, m2, m3, advice, document_ids, name_not_shown_for, used_document_ids)
    values (${input.applicantId}, ${input.incomeType}, ${JSON.stringify(input.months)}::jsonb,
            ${input.average}, ${input.m1}, ${input.m2}, ${input.m3}, ${input.advice}, ${ids}::uuid[], ${input.nameNotShown}::text[], ${input.usedDocumentIds}::uuid[])
    returning *`;
  if (!row) throw new Error("insertIncomeReading returned no row");

  for (const doc of input.documents) {
    await sql`
      update income_documents set status = 'read', kind = ${doc.kind},
        file_type = ${doc.fileType}, reading_id = ${row.id}, read_at = now()
      where id = ${doc.id} and applicant_id = ${input.applicantId} and status in ('uploaded', 'read')`;
  }
  await logIncomeDocumentEvent({
    applicantId: input.applicantId,
    readingId: row.id,
    event: "read",
    detail: {
      incomeType: input.incomeType,
      months: input.months,
      documents: input.documents,
      nameNotShown: input.nameNotShown,
      ignoredDocumentIds: ids.filter((id) => !input.usedDocumentIds.includes(id)),
    },
  });
  return row;
}

export function getIncomeReading(
  applicantId: string,
  id: string,
): Promise<IncomeReading | null> {
  return sqlOne<IncomeReading>`
    select * from income_readings where id = ${id} and applicant_id = ${applicantId}`;
}

export async function markIncomeDocumentsSubmitted(
  applicantId: string,
  readingId: string,
  documentIds: string[],
): Promise<void> {
  await sql`
    update income_documents set status = 'submitted', submitted_at = now()
    where applicant_id = ${applicantId} and id = any(${documentIds}::uuid[])`;
  await logIncomeDocumentEvent({
    applicantId,
    readingId,
    event: "submitted",
    detail: { documentIds },
  });
}

/**
 * Documents whose bytes should no longer be in the bucket: added but never
 * submitted and older than the retention window, or removed and the delete
 * did not go through. Submitted documents are never returned: they are the
 * record behind a credit decision and are kept.
 */
export function listDocumentsNeedingDeletion(olderThanDays: number): Promise<IncomeDocument[]> {
  return sql<IncomeDocument>`
    select * from income_documents
    where (status in ('uploaded', 'read')
           and created_at < now() - make_interval(days => ${olderThanDays}))
       or (status in ('removed', 'expired') and deleted_from_storage_at is null)
    order by created_at
    limit 200`;
}

export async function markIncomeDocumentExpired(doc: IncomeDocument): Promise<void> {
  await sql`
    update income_documents set status = 'expired', removed_at = now()
    where id = ${doc.id} and status in ('uploaded', 'read')`;
  await logIncomeDocumentEvent({
    applicantId: doc.applicant_id,
    documentId: doc.id,
    event: "expired",
    detail: { fileName: doc.file_name, createdAt: doc.created_at },
  });
}

/**
 * Takes the right to submit this reading, or returns null when someone else
 * has it (a second tap, a retry while the first request is still waiting on
 * Ascend) or it has already gone. A lock older than two minutes is taken
 * over: the request that held it is not coming back.
 */
export function claimIncomeReading(
  applicantId: string,
  id: string,
): Promise<IncomeReading | null> {
  return sqlOne<IncomeReading>`
    update income_readings set submitting_at = now()
    where id = ${id} and applicant_id = ${applicantId}
      and submitted_at is null
      and (submitting_at is null or submitting_at < now() - interval '2 minutes')
    returning *`;
}

/** Gives the right back after a failure, so the applicant can try again. */
export async function releaseIncomeReading(id: string): Promise<void> {
  await sql`update income_readings set submitting_at = null where id = ${id} and submitted_at is null`;
}

export async function completeIncomeReading(id: string): Promise<void> {
  await sql`update income_readings set submitted_at = now() where id = ${id}`;
}

export async function setIncomeDocumentAscendUrl(id: string, url: string): Promise<void> {
  await sql`update income_documents set ascend_file_url = ${url} where id = ${id}`;
}
