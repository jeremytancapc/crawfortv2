/**
 * Puts notes on the applicant's Ascend Order, for the staff who review it.
 *
 * Never throws and never blocks the applicant: the plan or booking is already
 * saved by the time a note goes out, so a failed note is a missing note - not
 * a lost selection, and not a step to repeat. What it must not be is a silent
 * one. Every way a note can fail (Ascend not set up, no order on file, Ascend
 * refusing, the call timing out, our own database) leaves a row in api_logs
 * tied to the applicant, so "why does staff see no plan?" has an answer.
 */

import { logExternalApi } from "@/lib/external-api-logger";
import { getAscendOrder } from "@/lib/db/ascend-orders";
import { isDatabaseConfigured } from "@/lib/db/sql";

import { ascendAddOrderComment, AscendError } from "./client";
import { ascendConfig } from "./config";
import { formatBookingWithoutPlanNote, formatPlanComment, type PlanComment } from "./plan-comment";

/** Short on purpose: the caller is waiting, and a note is never worth a long stall. */
const NOTE_TIMEOUT_MS = 8_000;

type Deps = {
  configured: () => boolean;
  getOrder: (applicantId: string) => Promise<{ order_id: string } | null>;
  addComment: typeof ascendAddOrderComment;
  logFailure: (applicantId: string, purpose: string, reason: string) => void;
};

function logNoteFailure(applicantId: string, purpose: string, reason: string): void {
  console.error(`[ascend-note] ${purpose} note not placed: ${reason}`);
  logExternalApi({
    tag: "[ascend-note]",
    url: "/openApi/order/comments",
    method: "POST",
    headers: {},
    body: { purpose },
    status: 0,
    ok: false,
    ms: 0,
    leadId: applicantId,
    error: reason,
  });
}

const defaultDeps: Deps = {
  configured: () => Boolean(ascendConfig()),
  getOrder: getAscendOrder,
  addComment: ascendAddOrderComment,
  logFailure: logNoteFailure,
};

function describe(err: unknown): string {
  if (err instanceof AscendError) return `Ascend ${err.path} returned ${err.code}: ${err.msg}`;
  return err instanceof Error ? err.message : String(err);
}

/**
 * Writes `comments` on the applicant's order. True when Ascend took it; false
 * otherwise, with the reason recorded. Awaited by callers, so serverless does
 * not freeze before the request goes out.
 */
export async function placeNoteOnAscendOrder(
  applicantId: string,
  comments: string,
  purpose: string,
  overrides?: Partial<Deps>,
): Promise<boolean> {
  const deps = { ...defaultDeps, ...overrides };

  // Nothing to record into: without a database there is no applicant either.
  if (!overrides && !isDatabaseConfigured()) return false;

  const fail = (reason: string) => {
    try {
      deps.logFailure(applicantId, purpose, reason);
    } catch (err) {
      console.error("[ascend-note] could not record a failed note", err);
    }
    return false;
  };

  try {
    if (!deps.configured()) return fail("Ascend is not configured");

    const order = await deps.getOrder(applicantId);
    // No order means Ascend never decided for this applicant - there is
    // nothing to comment on.
    if (!order) return fail("no Ascend order on file for this applicant");

    await deps.addComment(
      { orderId: order.order_id, comments },
      { applicantId, timeoutMs: NOTE_TIMEOUT_MS },
    );
    return true;
  } catch (err) {
    return fail(describe(err));
  }
}

/** The applicant's chosen plan, on their Ascend Order. */
export function recordPlanOnAscendOrder(
  applicantId: string,
  plan: PlanComment,
  overrides?: Partial<Deps>,
): Promise<boolean> {
  return placeNoteOnAscendOrder(applicantId, formatPlanComment(plan), "plan", overrides);
}

/** A free-text note on the applicant's Ascend Order. */
export function recordNoteOnAscendOrder(
  applicantId: string,
  note: string,
  overrides?: Partial<Deps>,
): Promise<boolean> {
  return placeNoteOnAscendOrder(applicantId, note, "note", overrides);
}

/**
 * Booking does not need a plan, so a customer can book having picked none.
 * Staff then see an appointment and no amount or term: say so on the order.
 * A booking with a plan needs no note - the plan note already says it.
 */
export async function recordBookingOnAscendOrder(
  applicantId: string,
  booking: { selectedPlan: string | null | undefined; date: string; time: string },
  overrides?: Partial<Deps>,
): Promise<void> {
  if (booking.selectedPlan) return;
  await placeNoteOnAscendOrder(
    applicantId,
    formatBookingWithoutPlanNote({ date: booking.date, time: booking.time }),
    "booking without plan",
    overrides,
  );
}
