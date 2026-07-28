/**
 * Local simulation of a Singpass/MyInfo identity check.
 *
 * The real Singpass OIDC + AWS Lambda integration has been stripped out —
 * there is no external auth provider to redirect to. Instead we clone the
 * demo MyInfo fixture and shift its CPF/NOA dates to be relative to "now",
 * so the credit engine's staleness checks always pass and the simulated
 * applicant always comes back approved (never a "pending" outcome).
 */

import { randomUUID } from "crypto";

import mockPayload from "./mock-singpass-payload.json";

export type SimulatedMyInfoPayload = {
  myinfo: Record<string, unknown>;
  state: string;
  code: number;
  message: string;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** N months before `ref`, e.g. offset=1 → last month. */
function monthsBefore(ref: Date, offset: number): Date {
  return new Date(ref.getFullYear(), ref.getMonth() - offset, 1);
}

/** Builds a fresh, always-approvable MyInfo payload for the Singpass simulation. */
export function buildSimulatedMyInfoPayload(ref: Date = new Date()): SimulatedMyInfoPayload {
  const base = structuredClone(mockPayload) as SimulatedMyInfoPayload;
  const myinfo = base.myinfo as Record<string, unknown>;

  // CPF contributions — most recent entry is last month, so `scoreCpf` always
  // sees data within its 2-month staleness window.
  const cpfContributions = myinfo.cpfcontributions as
    | { history?: Array<Record<string, unknown>> }
    | undefined;
  cpfContributions?.history?.forEach((row, i) => {
    const monthDate = monthsBefore(ref, i + 1);
    row.month = { value: monthKey(monthDate) };
    row.date = { value: `${monthKey(monthDate)}-01` };
  });

  const cpfEmployers = myinfo.cpfemployers as
    | { history?: Array<Record<string, unknown>> }
    | undefined;
  cpfEmployers?.history?.forEach((row, i) => {
    row.month = { value: monthKey(monthsBefore(ref, i + 1)) };
  });

  // NOA history — latest year of assessment is last year, so `scoreNoa`
  // always falls inside its [currentYear - 1, currentYear] scoring window.
  const noaHistory = myinfo.noahistory as { noas?: Array<Record<string, unknown>> } | undefined;
  noaHistory?.noas?.forEach((row, i) => {
    row.yearofassessment = { value: String(ref.getFullYear() - 1 - i) };
  });

  return {
    ...base,
    myinfo,
    state: randomUUID(),
  };
}
