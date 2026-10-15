/**
 * GET /api/documents/<token>
 *
 * Streams one applicant document. This is the URL Ascend is given in place of
 * a presigned S3 link: it does not expire, so a credit decision keeps its
 * evidence, and the bucket behind it stays closed to the world.
 *
 * The token is a signed pointer to an object key, so a guessed or edited URL
 * fetches nothing. Access can be narrowed further here later - an IP allow
 * list, an expiry, a revocation check - without Ascend having to update
 * anything they have stored.
 */

import { NextRequest, NextResponse } from "next/server";

import { readDocumentToken } from "@/lib/documents/links";
import { documentsSecret, getDocument } from "@/lib/documents/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const secret = documentsSecret();
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const { token } = await params;
  const objectKey = readDocumentToken(token, secret);
  if (!objectKey) {
    // Deliberately the same answer as a missing file. Telling the difference
    // between "not signed by us" and "signed but gone" would let someone map
    // which documents exist.
    return new NextResponse("Not found", { status: 404 });
  }

  const file = await getDocument(objectKey);
  if (!file) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(file.body, {
    headers: {
      "Content-Type": file.contentType,
      ...(file.bytes ? { "Content-Length": String(file.bytes) } : {}),
      // Inline so an underwriter opening the link sees the payslip rather
      // than downloading it, and never cached by a shared proxy.
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
