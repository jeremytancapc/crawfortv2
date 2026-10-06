import type { NextRequest } from "next/server";

import { SESSION_COOKIE, decodeSession } from "@/lib/apply-session";
import { looksLikeLeadUuid } from "@/lib/lead-id";

/** The applicant this request belongs to, from the signed session - or null. */
export function applicantIdFromRequest(request: NextRequest): string | null {
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value ?? "") ?? {};
  const id = (session as { leadId?: string }).leadId ?? "";
  return looksLikeLeadUuid(id) ? id : null;
}
