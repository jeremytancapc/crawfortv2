import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { saveAuthCallbackPayload } from "@/lib/auth-callback-store";
import { encodeSession } from "@/lib/apply-session";
import { buildMyInfoPatch } from "@/lib/myinfo";
import { buildSimulatedMyInfoPayload } from "@/lib/singpass-simulate";
import type { LoanFormData } from "@/lib/loan-form";
import {
  byteLength,
  logApplyFlowEvent,
  newApplyTraceId,
  snapshotSession,
} from "@/lib/apply-flow-log";

export const runtime = "nodejs";

function getRequestOrigin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";
  return `${proto}://${host}`;
}

/**
 * "Retrieve MyInfo with Singpass" entry point.
 *
 * The real Singpass OIDC redirect + AWS Lambda webhook has been removed -
 * there is no external identity provider here. Instead this instantly
 * simulates a successful MyInfo retrieval (fresh CPF/NOA data) and sends the
 * browser straight to /api/apply/activate, exactly like a real callback
 * would, so the rest of the funnel (activate → review → submit) is
 * unchanged and always resolves to an approved outcome.
 */
export async function GET(request: NextRequest) {
  const payload = buildSimulatedMyInfoPayload();
  const debugRid = randomUUID();
  saveAuthCallbackPayload(debugRid, payload);

  const myinfoPatch = buildMyInfoPatch(payload.myinfo);
  const sessionData: Partial<LoanFormData> = { ...myinfoPatch, singpassRawKey: debugRid };

  const activateToken = encodeSession(sessionData);
  const activateUrl = new URL("/api/apply/activate", getRequestOrigin(request));
  activateUrl.searchParams.set("token", activateToken);

  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== "token") activateUrl.searchParams.set(key, value);
  });

  const traceId = newApplyTraceId();
  await logApplyFlowEvent({
    event: "singpass_simulated",
    traceId,
    singpassRawKey: debugRid,
    request,
    requestPath: "/api/auth",
    hadActivateToken: true,
    tokenDecodeOk: true,
    cookieTokenBytes: byteLength(activateToken),
    sessionAfter: sessionData,
    details: {
      simulated: true,
      myinfo_snapshot: snapshotSession(sessionData),
    },
  });

  return NextResponse.redirect(activateUrl);
}
