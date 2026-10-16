/**
 * GET /api/cron/myinfo-retention
 *
 * Deletes raw MyInfo payloads past their 24-hour retention deadline. They hold
 * unminimised personal data (NRIC, CPF and NOA history), so the deadline is a
 * legal obligation, not housekeeping. Nothing reads a payload after it has
 * expired (getMyinfoRetrieval refuses it), so deleting it changes nothing for
 * an applicant.
 *
 * Needs a scheduler to call it (a daily Vercel cron, in vercel.json). Guarded
 * by CRON_SECRET, sent as `Authorization: Bearer <secret>`, which is what
 * Vercel Cron does when the variable is set. Vercel only runs crons on
 * Production deployments, so on staging call it by hand.
 */

import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { pruneExpiredMyinfoRetrievals } from "@/lib/db/myinfo-retrievals";

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
  const pruned = await pruneExpiredMyinfoRetrievals();
  console.info("[cron/myinfo-retention]", { pruned });
  return NextResponse.json({ pruned });
}
