import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { saveAuthCallbackPayload } from "@/lib/auth-callback-store";
import { saveMyinfoRetrieval } from "@/lib/db/myinfo-retrievals";
import { isDatabaseConfigured } from "@/lib/db/sql";
import { encodeSession } from "@/lib/apply-session";
import { buildMyInfoPatch } from "@/lib/myinfo";
import type { LoanFormData } from "@/lib/loan-form";
import {
  byteLength,
  logApplyFlowEvent,
  newApplyTraceId,
  snapshotSession,
} from "@/lib/apply-flow-log";

export const runtime = "nodejs";

type MyInfoPayload = {
  myinfo?: Record<string, unknown>;
  state?: string;
  code?: number;
  message?: string;
};

function getRequestOrigin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host  = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";
  return `${proto}://${host}`;
}

/**
 * Diagnostic only.
 *
 * This endpoint takes a POST from the Lambda and answers with JSON; it is not
 * somewhere a browser should ever land. But a caller that redirects the
 * browser here instead of POSTing gets a bare 405 with nothing to act on, and
 * that is an expensive thing to debug from the outside - it looks like the
 * page is simply broken.
 *
 * So GET says what it expects and what it received. It deliberately does not
 * accept a MyInfo payload by query string: minting a session from data in a
 * URL would let anyone fabricate an identity by typing one.
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());

  return NextResponse.json(
    {
      code: 405,
      message: "This endpoint expects a POST, not a browser redirect.",
      expected: {
        method: "POST",
        contentType: "application/json",
        body: { myinfo: "{ ...MyInfo person data... }", state: "optional", code: 200 },
        response:
          "{ code, message, data } - `data` is the URL the caller must then send the browser to.",
      },
      received: {
        method: "GET",
        queryParams: Object.keys(params),
        hint: Object.keys(params).length
          ? "Query parameters were sent. The payload must be POSTed as a JSON body instead."
          : "No query parameters. If the Lambda redirected the browser here, it should POST server-side and follow the `data` URL it gets back.",
      },
    },
    { status: 405 },
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let payload: MyInfoPayload = {};

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as MyInfoPayload;
    } catch {
      payload = {};
    }
  }

  const debugRid = randomUUID();
  saveAuthCallbackPayload(debugRid, payload);

  const myinfoPatch = payload.myinfo ? buildMyInfoPatch(payload.myinfo) : {};
  const sessionData: Partial<LoanFormData> = { ...myinfoPatch, singpassRawKey: debugRid };

  const activateToken = encodeSession(sessionData);
  const activateUrl = new URL("/api/apply/activate", getRequestOrigin(request));
  activateUrl.searchParams.set("token", activateToken);

  // Debug detour. The caller decides nothing about where the browser goes -
  // it reads the `data` field below - so pointing it at the inspector is a
  // matter of returning a different URL, with no change on the Lambda's side.
  //
  // Off by default, so the funnel is untouched unless someone deliberately
  // switches capture on.
  if (process.env.MYINFO_CAPTURE_ENABLED === "true" && payload.myinfo && isDatabaseConfigured()) {
    try {
      const rid = await saveMyinfoRetrieval(payload.myinfo, debugRid);
      const inspectUrl = new URL("/auth/callback-result", getRequestOrigin(request));
      inspectUrl.searchParams.set("rid", rid);

      await logApplyFlowEvent({
        event: "auth_callback_captured",
        traceId: newApplyTraceId(),
        singpassRawKey: debugRid,
        request,
        requestPath: "/api/auth/callback",
        details: { captured_to: "myinfo_retrievals", rid },
      });

      return NextResponse.json({
        code: 200,
        message: "success",
        data: inspectUrl.toString(),
        redirect: inspectUrl.toString(),
      });
    } catch (err) {
      // A failed capture must not cost the applicant their journey: fall
      // through to the normal activate URL rather than returning an error.
      console.error("[auth/callback] capture failed, continuing to activate", err);
    }
  }

  const traceId = newApplyTraceId();
  await logApplyFlowEvent({
    event: "auth_callback_received",
    traceId,
    singpassRawKey: debugRid,
    request,
    requestPath: "/api/auth/callback",
    hadActivateToken: true,
    tokenDecodeOk: true,
    cookieTokenBytes: byteLength(activateToken),
    sessionAfter: sessionData,
    details: {
      has_myinfo: Boolean(payload.myinfo),
      payload_code: payload.code ?? null,
      payload_message: payload.message ?? null,
      payload_state: payload.state ?? null,
      myinfo_snapshot: snapshotSession(sessionData),
      activate_url_length: activateUrl.toString().length,
    },
  });

  return NextResponse.json({
    code: 200,
    message: "success",
    data: activateUrl.toString(),
  });
}
