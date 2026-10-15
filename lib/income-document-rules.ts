/**
 * Two rules about the stored income documents, apart from the routes that
 * apply them so they can be tested without a database.
 */

/**
 * Whether the figures of a reading can still be submitted.
 *
 * What matters is that every document the figures were read from is still
 * there and still belongs to that reading - removing one, or re-reading it
 * into another reading, means the figures describe files that are gone.
 *
 * Documents that are NOT in the reading do not matter, and used to block
 * submission outright: a file left from an earlier attempt, one that was
 * refused, one added and not yet read. None of them is in the figures, and
 * only the reading's own documents are sent to Ascend, so they cannot put
 * anyone's evidence behind the decision. Insisting they match left an
 * applicant unable to submit because of files they could not even see.
 */
export function readingStillHolds(
  reading: { id: string; document_ids: string[] },
  active: Array<{ id: string; status: string; reading_id: string | null }>,
): boolean {
  if (reading.document_ids.length === 0) return false;
  const byId = new Map(active.map((doc) => [doc.id, doc]));
  return reading.document_ids.every((id) => {
    const doc = byId.get(id);
    return doc !== undefined && doc.status === "read" && doc.reading_id === reading.id;
  });
}

/**
 * The stored document with the same content, if there is one. A second copy
 * of a file adds nothing, counts against the limit and, once read, makes the
 * same month look doubled - so an identical upload reuses the first.
 */
export function findDuplicate<T extends { sha256: string }>(
  stored: readonly T[],
  sha256: string,
): T | undefined {
  return stored.find((doc) => doc.sha256 === sha256);
}
