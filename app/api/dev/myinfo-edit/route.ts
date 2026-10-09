/**
 * POST /api/dev/myinfo-edit - staging only.
 *
 * Writes the CPF and/or NOA a tester typed into the retrieved Singpass record
 * for the application that is open, so they reach Ascend at submit exactly as
 * if Singpass had returned them. The same figures are saved in our own
 * database and in the signed cookie the review page reads, so what the tester
 * sees is what is sent and what is kept.
 *
 * Body: { rid, cpf?: CpfRow[], noa?: NoaRow[] } - only what is named changes.
 *
 * Switched on per deployment by MYINFO_EDITOR_ENABLED; with it off this answers
 * 403 and touches nothing.
 */

import { NextRequest, NextResponse } from "next/server";

import { myinfoCookieValue } from "@/lib/apply-myinfo-cookie";
import { DRAFT_LEAD_COOKIE } from "@/lib/apply-session-codec";
import { getMyinfoRetrieval, saveMyinfoRetrieval } from "@/lib/db/myinfo-retrievals";
import { updateMyinfoProcessed } from "@/lib/db/myinfo-profiles";
import { isDatabaseConfigured } from "@/lib/db/sql";
import { applicantIdFromRequest } from "@/lib/income-session";
import { looksLikeLeadUuid } from "@/lib/lead-id";
import {
  applyMyinfoEdits,
  validateCpfRows,
  validateNoaRows,
  type CpfRow,
  type NoaRow,
} from "@/lib/myinfo-edit";

export const runtime = "nodejs";

function enabled(): boolean {
  return process.env.MYINFO_EDITOR_ENABLED === "true" || process.env.MYINFO_CAPTURE_ENABLED === "true";
}

function numberOr(value: unknown, fallback = NaN): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cpfRowsFrom(input: unknown): CpfRow[] | null {
  if (!Array.isArray(input)) return null;
  return input.map((row) => ({
    month: String((row as CpfRow).month ?? "").trim(),
    amount: numberOr((row as CpfRow).amount),
    employer: String((row as CpfRow).employer ?? "").trim(),
  }));
}

function noaRowsFrom(input: unknown): NoaRow[] | null {
  if (!Array.isArray(input)) return null;
  return input.map((row) => {
    const r = row as NoaRow;
    return {
      yearOfAssessment: String(r.yearOfAssessment ?? "").trim(),
      employmentIncome: numberOr(r.employmentIncome, 0),
      tradeIncome: numberOr(r.tradeIncome, 0),
      rentIncome: numberOr(r.rentIncome, 0),
      interestIncome: numberOr(r.interestIncome, 0),
    };
  });
}

export async function POST(request: NextRequest) {
  if (!enabled()) {
    return NextResponse.json({ error: "MYINFO_EDITOR_ENABLED is not set on this deployment." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 500 });
  }

  let body: { rid?: string; cpf?: unknown; noa?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body was not JSON." }, { status: 400 });
  }

  const rid = typeof body.rid === "string" ? body.rid : "";
  const cpf = body.cpf === undefined ? undefined : cpfRowsFrom(body.cpf);
  const noa = body.noa === undefined ? undefined : noaRowsFrom(body.noa);
  if (!rid || cpf === null || noa === null || (cpf === undefined && noa === undefined)) {
    return NextResponse.json({ error: "rid and at least one of cpf / noa (as lists) are required." }, { status: 400 });
  }

  const errors = [...(cpf ? validateCpfRows(cpf) : []), ...(noa ? validateNoaRows(noa) : [])];
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const payload = await getMyinfoRetrieval(rid);
  if (!payload) {
    return NextResponse.json({ error: "No capture with that id, or it has expired." }, { status: 404 });
  }

  const edited = applyMyinfoEdits(payload, { cpf, noa });

  // 1. The raw record - what Ascend is sent at submit.
  await saveMyinfoRetrieval(edited.payload, rid);

  // 2. Our own mapped copy for this applicant, when there is one yet. The
  //    review page reads it when no cookie carries the figures.
  const draft = request.cookies.get(DRAFT_LEAD_COOKIE)?.value?.trim() ?? "";
  const applicantId = applicantIdFromRequest(request) ?? (looksLikeLeadUuid(draft) ? draft : null);
  let savedToProfile = false;
  if (applicantId) {
    savedToProfile = await updateMyinfoProcessed(applicantId, edited.processed, edited.monthlyIncomeNoa);
  }

  const response = NextResponse.json({
    ok: true,
    rid,
    cpfMonths: edited.processed.cpfContributions.length,
    noaYears: edited.processed.noaHistory.length,
    savedToProfile,
  });

  // 3. The signed cookie the review page reads first.
  response.cookies.set(myinfoCookieValue(edited.processed));
  return response;
}
