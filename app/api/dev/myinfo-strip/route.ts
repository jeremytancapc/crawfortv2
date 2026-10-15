/**
 * One-click "mark CPF/NOA unavailable" for a live in-progress application.
 *
 * The full editor at /auth/callback-result exists for a reason - reading the
 * whole payload, hand-editing anything in it - but reaching it costs a tab
 * switch, a scroll, and a manual save for what is almost always just "drop
 * CPF" or "drop NOA" while a real application sits open in Review. This does
 * the read, the edit and the save server-side in one call, so the button on
 * Review needs nothing back but success.
 *
 * Read-modify-write on the same myinfo_retrievals row a live session already
 * points at: submit reads it fresh by the same id, so this reaches Ascend at
 * submit without the session needing to change.
 */

import { NextRequest, NextResponse } from "next/server";

import { getMyinfoRetrieval, saveMyinfoRetrieval } from "@/lib/db/myinfo-retrievals";
import { isDatabaseConfigured } from "@/lib/db/sql";

export const runtime = "nodejs";

const STRIPPABLE_FIELDS = ["cpfcontributions", "noahistory"] as const;
type StrippableField = (typeof STRIPPABLE_FIELDS)[number];

function enabled(): boolean {
  return process.env.MYINFO_EDITOR_ENABLED === "true" || process.env.MYINFO_CAPTURE_ENABLED === "true";
}

/** Wherever the real fields live - flat (legacy) or nested under person_info
 *  (FAPI 2.0). Editing the wrong level would silently no-op. */
function personLevel(obj: Record<string, unknown>): Record<string, unknown> {
  const nested = obj.person_info;
  return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : obj;
}

/** How Singpass actually marks "this person genuinely has none of this" -
 *  verified against real captures in myinfo_retrievals: `source` and
 *  `classification` never vary, only `lastupdated`. */
function unavailableField() {
  return {
    source: "1",
    lastupdated: new Date().toISOString().slice(0, 10),
    unavailable: true,
    classification: "C",
  };
}

export async function POST(request: NextRequest) {
  if (!enabled()) {
    return NextResponse.json(
      { error: "MYINFO_EDITOR_ENABLED is not set on this deployment." },
      { status: 403 },
    );
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 500 });
  }

  let body: { rid?: string; field?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body was not JSON." }, { status: 400 });
  }

  const { rid, field } = body;
  if (!rid || !field || !STRIPPABLE_FIELDS.includes(field as StrippableField)) {
    return NextResponse.json(
      { error: `rid and field are required; field must be one of ${STRIPPABLE_FIELDS.join(", ")}.` },
      { status: 400 },
    );
  }

  const payload = await getMyinfoRetrieval(rid);
  if (!payload) {
    return NextResponse.json(
      { error: "No capture with that id, or it has expired." },
      { status: 404 },
    );
  }

  personLevel(payload)[field] = unavailableField();
  await saveMyinfoRetrieval(payload, rid);

  return NextResponse.json({ ok: true, field, rid });
}
