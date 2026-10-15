/**
 * POST /api/apply/draft
 *
 * Creates a partial lead (status: in_progress) when a manual-flow customer
 * confirms the review page (step 8 → step 5). This captures customers who
 * drop off before reaching the final Submit button.
 *
 * At final submit, the existing lead is updated to status "new" with all data.
 * Returns { leadId } so the client can carry it forward into the submit body.
 */

import { NextRequest, NextResponse } from "next/server";
import { insertApplicant } from "@/lib/db/applicants";
import type { AuthMethod, IdType } from "@/lib/db/types";
import { initialLoanFormData } from "@/lib/loan-form";
import type { LoanFormData } from "@/lib/loan-form";
import { draftLeadCookieValue, DRAFT_LEAD_COOKIE } from "@/lib/apply-session";
import { looksLikeLeadUuid } from "@/lib/lead-id";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let bodyData: Partial<LoanFormData> = {};
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      bodyData = (await request.json()) as Partial<LoanFormData>;
    }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const formData = { ...initialLoanFormData, ...bodyData };

  if (!formData.amount || !formData.tenure) {
    return NextResponse.json({ error: "Missing loan details" }, { status: 400 });
  }

  // If this browser already has a draft lead from the same journey, reuse it.
  const existingDraftLeadId = request.cookies.get(DRAFT_LEAD_COOKIE)?.value ?? "";
  if (looksLikeLeadUuid(existingDraftLeadId)) {
    return NextResponse.json({ ok: true });
  }

  let leadId: string;
  try {
    leadId = await insertApplicant({
      desiredAmount: formData.amount,
      loanTenure: formData.tenure,
      loanPurpose: formData.loanPurpose || null,
      urgency: formData.urgency || null,
      authMethod: (formData.authMethod as AuthMethod | undefined) || null,
      idType: (formData.idType as IdType | undefined) || null,
      fullName: formData.fullName || null,
      nric: formData.nric || null,
      monthlyIncome: formData.monthlyIncome || null,
      // Partial until submit. Captured so an applicant who drops off after
      // the review confirm can still be followed up.
      status: "in_progress",
      moneylenderNoLoans: false,
    });
  } catch (err) {
    console.error("[draft] Failed to create partial applicant:", err);
    return NextResponse.json({ error: "Failed to create draft" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(draftLeadCookieValue(leadId));
  return res;
}
