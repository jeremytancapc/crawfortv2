/**
 * POST /api/apply/income/upload
 *
 * Takes one income document from the applicant and hands it to Ascend,
 * answering with the URL Ascend gives it back. /openApi/income/credit takes
 * those URLs as `orderFile`, and refuses without them: `600: orderFile is
 * required`.
 *
 * The file is streamed straight through and never stored here. It is a
 * payslip - someone's salary, employer and name - and the fewer places it
 * comes to rest, the better.
 */

import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, decodeSession } from "@/lib/apply-session";
import { AscendError, ascendUploadFile } from "@/lib/ascend/client";
import { ascendConfig } from "@/lib/ascend/config";
import { getApplicant } from "@/lib/db/applicants";
import { isDatabaseConfigured } from "@/lib/db/sql";
import { looksLikeLeadUuid } from "@/lib/lead-id";

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

  try {
    const uploaded = await ascendUploadFile({
      userId: applicant.ascend_user_id,
      fileName: file.name,
      contentType: file.type,
      bytes: await file.arrayBuffer(),
    });

    return NextResponse.json({
      fileUrl: uploaded.url,
      fileName: file.name,
    });
  } catch (err) {
    if (err instanceof AscendError) {
      console.error(`[apply/income/upload] file/upload failed ${err.code}: ${err.msg}`);
      return NextResponse.json(
        { error: "We could not accept that document. Please try again or contact us." },
        { status: 502 },
      );
    }
    throw err;
  }
}
