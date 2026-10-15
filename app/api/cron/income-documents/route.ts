/**
 * GET /api/cron/income-documents
 *
 * Deletes the bytes of income documents that should no longer be in the
 * bucket: added but never submitted for RETENTION_DAYS, or removed and the
 * delete did not go through. Rows stay, as the record.
 *
 * Needs a scheduler to call it (e.g. a daily Vercel cron). Guarded by
 * CRON_SECRET, sent as `Authorization: Bearer <secret>`, which is what Vercel
 * Cron does when the variable is set.
 */

import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { sweepIncomeDocuments } from "@/lib/documents/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want));
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  return NextResponse.json(await sweepIncomeDocuments());
}
