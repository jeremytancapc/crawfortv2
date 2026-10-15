/**
 * GET /api/cron/ascend-shape
 *
 * The daily report on how Ascend has been answering: counts of each departure
 * from its usual reply logged in the last 24 hours (see lib/ascend/shape.ts).
 * Answers 200 when only the known things to watch appeared, and 500 with
 * `alert: true` when anything new did - so a scheduler that reports failed
 * jobs turns a never-seen reply into a notification.
 *
 * Needs a scheduler to call it (e.g. a daily Vercel cron). Guarded by
 * CRON_SECRET, sent as `Authorization: Bearer <secret>`.
 */

import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/db/sql";
import { SHAPE_LOG_TAG } from "@/lib/ascend/shape-report";
import { summariseShapeLog } from "@/lib/ascend/shape";

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
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const rows = await sql<{ codes: string; n: string }>`
    select coalesce(error, '') as codes, count(*) as n
      from api_logs
     where tag = ${SHAPE_LOG_TAG} and created_at > now() - interval '24 hours'
     group by 1`;

  const summary = summariseShapeLog(rows.map((r) => ({ codes: r.codes, n: Number(r.n) })));
  return NextResponse.json({ since: "24 hours", ...summary }, { status: summary.alert ? 500 : 200 });
}
