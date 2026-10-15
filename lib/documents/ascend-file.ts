/**
 * The URL Ascend is given for a stored income document.
 *
 * Tries Ascend's own upload first, so the day it works their URL is used.
 * While it answers 500, the URL is a signed link to our own copy - see
 * lib/documents/links.ts for why it is not a presigned S3 link.
 */

import { AscendError, ascendUploadFile } from "@/lib/ascend/client";
import type { IncomeDocument } from "@/lib/db/income-documents";

import { signDocumentToken } from "./links";
import { documentsSecret } from "./store";

export async function fileUrlForAscend(input: {
  doc: IncomeDocument;
  bytes: Buffer;
  ascendUserId: string;
  origin: string;
}): Promise<{ fileUrl: string; storedBy: "ascend" | "crawfort" }> {
  const { doc, bytes } = input;
  try {
    const uploaded = await ascendUploadFile(
      {
        userId: input.ascendUserId,
        fileName: doc.file_name,
        contentType: doc.content_type,
        bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      },
      { applicantId: doc.applicant_id },
    );
    return { fileUrl: uploaded.url, storedBy: "ascend" };
  } catch (err) {
    if (!(err instanceof AscendError)) throw err;
    console.error(`[income] file/upload failed ${err.code}: ${err.msg}; using our own copy`);
    const secret = documentsSecret();
    if (!secret) throw err;
    const token = signDocumentToken(doc.object_key, secret);
    return { fileUrl: new URL(`/api/documents/${token}`, input.origin).toString(), storedBy: "crawfort" };
  }
}
