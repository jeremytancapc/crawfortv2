/**
 * Full-length demo MyInfo records for /apply/review.
 *
 * The live session cookie is slimmed (no CPF/NOA) and the in-memory store
 * does not survive a deployed serverless request, so this page always falls
 * back to the staging fixture — 15 CPF months + 2 NOA years — so the demo
 * scroll is complete even when hydration is empty.
 */

import mockPayload from "./mock-singpass-payload.json";
import { buildMyInfoPatch } from "./myinfo";
import type { CpfContribution, NoaRecord } from "./loan-form";

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBefore(ref: Date, offset: number): Date {
  return new Date(ref.getFullYear(), ref.getMonth() - offset, 1);
}

export type DemoReviewMyInfo = {
  cpfContributions: CpfContribution[];
  noaHistory: NoaRecord[];
  dob: string;
};

/** Fresh-dated copy of the Felicia staging fixture, always long enough to demo. */
export function buildDemoReviewMyInfo(ref: Date = new Date()): DemoReviewMyInfo {
  const base = structuredClone(mockPayload) as { myinfo: Record<string, unknown> };
  const myinfo = base.myinfo;

  const cpfContributions = myinfo.cpfcontributions as
    | { history?: Array<Record<string, unknown>> }
    | undefined;
  cpfContributions?.history?.forEach((row, i) => {
    const monthDate = monthsBefore(ref, i + 1);
    row.month = { value: monthKey(monthDate) };
    row.date = { value: `${monthKey(monthDate)}-01` };
  });

  const noaHistory = myinfo.noahistory as { noas?: Array<Record<string, unknown>> } | undefined;
  noaHistory?.noas?.forEach((row, i) => {
    row.yearofassessment = { value: String(ref.getFullYear() - 1 - i) };
  });

  const patch = buildMyInfoPatch(myinfo);
  return {
    cpfContributions: patch.cpfContributions ?? [],
    noaHistory: patch.noaHistory ?? [],
    dob: patch.dob ?? "",
  };
}

export function withDemoReviewMyInfo<T extends { cpfContributions?: CpfContribution[]; noaHistory?: NoaRecord[]; dob?: string }>(
  session: T | null,
): T {
  const demo = buildDemoReviewMyInfo();
  const current = session ?? ({} as T);
  const hasBulk =
    (current.cpfContributions?.length ?? 0) > 0 &&
    (current.noaHistory?.length ?? 0) > 0;
  if (hasBulk) return current;
  return {
    ...current,
    cpfContributions: demo.cpfContributions,
    noaHistory: demo.noaHistory,
    dob: current.dob || demo.dob,
  };
}
