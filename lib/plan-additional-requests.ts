/**
 * Cookie bridge for additional plan requests selected on /apply/approval,
 * so /apply/accept can display them on the PlanSummaryCard.
 */

import { cookies } from "next/headers";

export const PLAN_ADDITIONAL_REQUESTS_COOKIE = "plan_additional_requests";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export type PlanAdditionalRequests = {
  longerTenure: boolean;
  higherAmount: boolean;
};

export function encodePlanAdditionalRequests(data: PlanAdditionalRequests): string {
  return Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
}

export function decodePlanAdditionalRequests(raw: string): PlanAdditionalRequests | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<PlanAdditionalRequests>;
    return {
      longerTenure: Boolean(parsed.longerTenure),
      higherAmount: Boolean(parsed.higherAmount),
    };
  } catch {
    return null;
  }
}

export function planAdditionalRequestsCookieValue(data: PlanAdditionalRequests) {
  return {
    name: PLAN_ADDITIONAL_REQUESTS_COOKIE,
    value: encodePlanAdditionalRequests(data),
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SEC,
  };
}

export async function getPlanAdditionalRequests(): Promise<PlanAdditionalRequests> {
  const store = await cookies();
  const raw = store.get(PLAN_ADDITIONAL_REQUESTS_COOKIE)?.value;
  if (!raw) return { longerTenure: false, higherAmount: false };
  return decodePlanAdditionalRequests(raw) ?? { longerTenure: false, higherAmount: false };
}

export function clearPlanAdditionalRequestsCookie() {
  return {
    name: PLAN_ADDITIONAL_REQUESTS_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
  };
}

export function formatPlanAdditionalRequestsLabel(data: PlanAdditionalRequests): string[] {
  const labels: string[] = [];
  if (data.longerTenure) labels.push("Longer tenure");
  if (data.higherAmount) labels.push("Higher loan amount");
  return labels;
}
