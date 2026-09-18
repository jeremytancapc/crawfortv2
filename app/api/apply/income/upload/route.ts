/**
 * POST /api/apply/income/upload
 *
 * Takes one income document from the applicant and hands it to Ascend,
 * answering with the URL Ascend gives it back. /openApi/income/credit takes
 * those URLs as `orderFile`, and refuses without them: `600: orderFile is
 * required`.
 *
 * The file is stored in our own bucket first, then offered to Ascend. Storing
 * it is not a workaround: until now a failed upload simply lost the
 * applicant's document, so they had to find and send it again and support had
 * nothing to look at.
 *
 * Ascend's own upload has answered `500: System error` to every request shape
 * tried, including its own documented example and an empty POST. While that
 * lasts, the URL handed back is ours - a link that does not expire, pointing
 * at a bucket that blocks all public access - rather than a presigned S3 link
 * that would leave a credit decision with no retrievable evidence.
 *
 * It still tries Ascend first, so the day their endpoint works, their URL is
 * used again and nothing here needs changing.
 */

import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, decodeSession } from "@/lib/apply-session";
import { AscendError, ascendUploadFile } from "@/lib/ascend/client";
import { ascendConfig } from "@/lib/ascend/config";
import { getApplicant } from "@/lib/db/applicants";
import { isDatabaseConfigured } from "@/lib/db/sql";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import { documentKey, signDocumentToken } from "@/lib/documents/links";
import { documentsConfigured, documentsSecret, putDocument } from "@/lib/documents/store";

export const runtime = "nodejs";

/** Mirrors the accepted types on the upload step. */
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  if (!ascendConfig() || !isDatabaseConfigured()) {
    return NextResponse.json({ error: "Uploads are not available right now." }, { status: 503 });
  }

  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value ?? "") ?? {};
  const applicantId = (session as { leadId?: string }).leadId ?? "";
  if (!looksLikeLeadUuid(applicantId)) {
    return NextResponse.json({ error: "No application in progress." }, { status: 400 });
  }

  const applicant = await getApplicant(applicantId);
  // Ascend files hang off its own user, not our applicant id. Without it
  // there is nowhere to put the document.
  if (!applicant?.ascend_user_id) {
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
    return NextResponse.json({ error: "That file is larger than 10 MB." }, { status: 400 });
  }
  if (!ACCEPTED.includes(file.type)) {
    return NextResponse.json({ error: "Please upload a PDF, JPG or PNG." }, { status: 400 });
  }

  const raw = await file.arrayBuffer();
  const bytes = Buffer.from(raw);

  // Ours first: if this fails there is nothing to fall back to, and sending
  // the file to Ascend while keeping no copy is how documents went missing.
  let ownUrl: string | null = null;
  if (documentsConfigured()) {
    try {
      const objectKey = documentKey(applicant.id, file.name);
      await putDocument({ objectKey, contentType: file.type, bytes });
      const token = signDocumentToken(objectKey, documentsSecret()!);
      ownUrl = new URL(`/api/documents/${token}`, request.nextUrl.origin).toString();
    } catch (err) {
      console.error("[apply/income/upload] could not store the document", err);
    }
  }

  try {
    const uploaded = await ascendUploadFile({
      userId: applicant.ascend_user_id,
      fileName: file.name,
      contentType: file.type,
      bytes: raw,
    }, { applicantId: applicant.id });

    return NextResponse.json({ fileUrl: uploaded.url, fileName: file.name });
  } catch (err) {
    if (err instanceof AscendError) {
      console.error(`[apply/income/upload] file/upload failed ${err.code}: ${err.msg}`);

      // Their upload is down, but we have the file. Hand Ascend a link to our
      // copy rather than stopping an applicant who did nothing wrong.
      if (ownUrl) {
        console.warn(`[apply/income/upload] using our own copy for ${applicant.id}`);
        return NextResponse.json({ fileUrl: ownUrl, fileName: file.name, storedBy: "crawfort" });
      }

      return NextResponse.json(
        { error: "We could not accept that document. Please try again or contact us." },
        { status: 502 },
      );
    }
    throw err;
  }
}
