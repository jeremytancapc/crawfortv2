/**
 * Capture endpoint for the AWS Lambda Singpass bridge.
 *
 * The Lambda completes the Singpass round trip and hands us the MyInfo
 * payload. Pointing it here instead of at /api/auth/callback stores the
 * payload and sends the browser to a page that shows exactly what arrived,
 * without dragging the applicant through the rest of the funnel. The real
 * callback is left alone.
 *
 * Accepts the payload three ways, because the Lambda's contract is not in
 * this repository and guessing wrong wastes a Singpass round trip:
 *
 *   POST {...}              - webhook style, either {myinfo:{...}} or bare
 *   POST ?rid=<uuid> {...}  - overwrite an existing capture in place
 *   GET  ?payload=<json>    - redirect style with the data inline
 *   GET  ?rid=<uuid>        - read back a payload already captured
 *
 * The `?rid=` form on POST is what lets a tester edit a capture - drop the
 * CPF or NOA block, say - and have submit send Ascend exactly that: submit
 * reads myinfo_retrievals by this same id, so overwriting the row in place
 * reaches a live, in-progress application without it needing a new key.
 *
 * Gated by either MYINFO_CAPTURE_ENABLED or MYINFO_EDITOR_ENABLED - two
 * different flags on purpose. MYINFO_CAPTURE_ENABLED also makes the real
 * Singpass callback (/api/auth/callback) divert every login on this
 * deployment to the inspector instead of continuing into the funnel - the
 * right switch for "show me exactly what Singpass sent," the wrong one for
 * editing, since it stops a tester from ever reaching Review to use the
 * edit. MYINFO_EDITOR_ENABLED unlocks this endpoint alone, with no effect
 * on the callback, so a tester can go through Singpass normally, edit their
 * own capture from the Review page, and continue - see the "Edit MyInfo"
 * link there.
 *
 * Either way this returns unminimised personal data - full NRIC, address,
 * CPF and NOA history - to whoever holds the link, so it must be switched
 * on deliberately and switched off after.
 */

import { NextRequest, NextResponse } from "next/server";

import { getMyinfoRetrieval, saveMyinfoRetrieval } from "@/lib/db/myinfo-retrievals";
import { isDatabaseConfigured } from "@/lib/db/sql";

export const runtime = "nodejs";

function enabled(): boolean {
  return (
    process.env.MYINFO_CAPTURE_ENABLED === "true" || process.env.MYINFO_EDITOR_ENABLED === "true"
  );
}

function disabledResponse() {
  return NextResponse.json(
    {
      code: 403,
      message:
        "MyInfo capture is off. Set MYINFO_EDITOR_ENABLED=true to edit a capture without " +
        "affecting real Singpass logins (or MYINFO_CAPTURE_ENABLED=true, which also diverts " +
        "every login on this deployment to the inspector) - and unset it once done, since this " +
        "endpoint returns unminimised personal data.",
    },
    { status: 403 },
  );
}

function origin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";
  return `${proto}://${host}`;
}

/** Unwraps {myinfo:{...}} or takes the object as-is. */
function unwrap(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  if (obj.myinfo && typeof obj.myinfo === "object") return obj.myinfo as Record<string, unknown>;
  // A bare payload always carries uinfin; anything else is an error envelope.
  if (obj.uinfin) return obj;
  return null;
}

export async function POST(request: NextRequest) {
  if (!enabled()) return disabledResponse();

  const rawBody = await request.text();

  let parsed: unknown = null;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ code: 400, message: "body was not JSON" }, { status: 400 });
  }

  const myinfo = unwrap(parsed);

  // Store the whole envelope, not just the unwrapped payload - if the Lambda
  // sends an error rather than data, the envelope is the thing worth seeing.
  // An edited capture is the one case this does not apply to: the tester is
  // sending back exactly the object they want stored, envelope or not, and
  // re-wrapping it in a search for `myinfo`/`uinfin` would silently drop an
  // edit that removed the field `unwrap` looks for.
  const editingExisting = Boolean(request.nextUrl.searchParams.get("rid"));
  const stored = editingExisting ? ((parsed as Record<string, unknown>) ?? {}) : (myinfo ?? (parsed as Record<string, unknown>) ?? {});

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { code: 500, message: "DATABASE_URL is not set on this deployment" },
      { status: 500 },
    );
  }

  const existingRid = request.nextUrl.searchParams.get("rid") ?? undefined;
  const rid = await saveMyinfoRetrieval(stored, existingRid);
  const resultUrl = `${origin(request)}/auth/callback-result?rid=${rid}`;

  // Mirrors the shape /api/auth/callback returns, so a Lambda written against
  // that contract can be repointed here with no change on its side.
  return NextResponse.json({
    code: 200,
    message: "success",
    data: resultUrl,
    // Convenience for a Lambda that redirects itself rather than reading `data`.
    redirect: resultUrl,
    rid,
    received: {
      hadMyinfo: Boolean(myinfo),
      bytes: rawBody.length,
      topLevelKeys: parsed && typeof parsed === "object" ? Object.keys(parsed as object) : [],
    },
  });
}

export async function GET(request: NextRequest) {
  if (!enabled()) return disabledResponse();

  const rid = request.nextUrl.searchParams.get("rid");
  const inlinePayload = request.nextUrl.searchParams.get("payload");

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { code: 500, message: "DATABASE_URL is not set on this deployment" },
      { status: 500 },
    );
  }

  // Read back a capture - this is what the result page calls.
  if (rid) {
    const payload = await getMyinfoRetrieval(rid);
    if (!payload) {
      return NextResponse.json(
        { code: 404, message: "No capture with that id, or it has expired." },
        { status: 404 },
      );
    }
    return NextResponse.json({ code: 200, message: "success", payload });
  }

  // A Lambda that redirects with the data inline rather than POSTing it.
  if (inlinePayload) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(inlinePayload);
    } catch {
      return NextResponse.json(
        { code: 400, message: "payload parameter was not JSON" },
        { status: 400 },
      );
    }
    const stored = unwrap(parsed) ?? (parsed as Record<string, unknown>);
    const newRid = await saveMyinfoRetrieval(stored);
    return NextResponse.redirect(`${origin(request)}/auth/callback-result?rid=${newRid}`);
  }

  return NextResponse.json(
    {
      code: 400,
      message:
        "Nothing to capture. POST the MyInfo payload here, or pass ?payload=<json>, " +
        "or ?rid=<uuid> to read one back.",
    },
    { status: 400 },
  );
}
