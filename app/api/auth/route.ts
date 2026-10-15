import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

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
 * Two behaviours, chosen by whether MYINFO_AUTH_URL is set.
 *
 * Set: forward to the Lambda that owns the Singpass round trip. The Lambda
 * authenticates the applicant, retrieves MyInfo, POSTs the payload to
 * /api/auth/callback, and sends the browser to the URL that returns. No
 * client_id, PKCE or DPoP lives in this repository - all of it is the
 * Lambda's.
 *
 * Unset: simulate. Clone the demo fixture with CPF/NOA dates shifted to be
 * relative to now, and go straight to /api/apply/activate as a real callback
 * would. This is what lets the funnel run on a laptop with no external
 * identity provider, and it always resolves to an approved outcome.
 *
 * There is deliberately no hardcoded fallback URL. The previous version of
 * this route defaulted to the staging Lambda, so an unset variable in
 * production would have sent real applicants to staging Singpass without
 * anything appearing to be wrong. Absent means simulate, which is obvious
 * the moment anyone looks.
 */
export async function GET(request: NextRequest) {
  const lambdaUrl = process.env.MYINFO_AUTH_URL?.trim();

  if (lambdaUrl) {
    const redirectUrl = new URL(lambdaUrl);

    // Forward any params the caller added, e.g. their own `state`.
    request.nextUrl.searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });

    await logApplyFlowEvent({
      event: "singpass_redirected",
      traceId: newApplyTraceId(),
      request,
      requestPath: "/api/auth",
      details: { lambda_host: redirectUrl.host },
    });

    return NextResponse.redirect(redirectUrl);
  }

  const payload = buildSimulatedMyInfoPayload();
  const debugRid = randomUUID();

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
