/**
 * GET /api/health/config
 *
 * Which settings the running site has, as yes or no per setting (never a value),
 * with the names of any that are wrong. Behind CRON_SECRET, like the cron routes:
 * the site's setup is not public.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://get.crawfort.com/api/health/config
 *
 * `node scripts/prod-check.mjs --live` does this for you and prints it.
 */

import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { configReport, problemsIn } from "@/lib/health/config-report";

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
  const report = configReport();
  return NextResponse.json({ ...report, problems: problemsIn(report) });
}
