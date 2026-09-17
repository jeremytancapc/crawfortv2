/**
 * POST /api/axs/submit
 *
 * Called by the AXS partner app with MyInfo + employment data.
 * 1. Validates AXS partner API key
 * 2. Creates a lead (auth_method: "axs")
 * 3. Saves MyInfo profile
 * 4. Runs AirConnect eligibility check
 * 5. Runs credit scoring
 * 6. If approved → generates a signed booking token/URL
 * 7. Returns status + approved amount + booking URL to AXS
 */

import { NextRequest, NextResponse } from "next/server";
import {
  insertApplicant,
  setApplicantStatus,
  setDesiredAmount,
  setEligibility,
} from "@/lib/db/applicants";
import { upsertCreditAssessment } from "@/lib/db/credit-assessments";
import { upsertMyinfoProfile } from "@/lib/db/myinfo-profiles";
import { checkLeadEligibility } from "@/lib/eligibility-check";
import { assessCredit } from "@/lib/credit-score";
import { deriveCreditRejectionReason } from "@/lib/credit-rejection";
import { createAxsToken } from "@/lib/axs-token";
import type { CpfContribution, NoaRecord } from "@/lib/loan-form";

export const runtime = "nodejs";

const LOG = "[axs/submit]";
const DEFAULT_TENURE = 12;

// ── Request body types ────────────────────────────────────────────────────────

interface AxsEmployment {
  "org-name"?: string;
  "job-title"?: string;
  "years-in-service"?: number;
  "business-nature"?: string;
}

interface AxsMyInfoPayload {
  uinfin?: { value?: string };
  name?: { value?: string };
  sex?: { code?: string; desc?: string };
  nationality?: { code?: string; desc?: string };
  dob?: { value?: string };
  residentialstatus?: { code?: string };
  email?: { value?: string };
  mobileno?: { areacode?: { value?: string }; prefix?: { value?: string }; nbr?: { value?: string } };
  regadd?: {
    unit?: { value?: string };
    street?: { value?: string };
    block?: { value?: string };
    postal?: { value?: string };
    floor?: { value?: string };
    building?: { value?: string };
  };
  marital?: { code?: string; desc?: string };
  cpfcontributions?: { history?: Array<{
    date?: { value?: string };
    employer?: { value?: string };
    amount?: { value?: number };
    month?: { value?: string };
  }> };
  "noa-basic"?: { yearofassessment?: { value?: string }; amount?: { value?: number } };
  axs?: {
    "reference-id"?: string;
    "education-level"?: string;
    "occupation-type"?: string;
    employments?: AxsEmployment[];
    loan_amount?: number;
    tenure?: number;
  };
}

interface AxsRequestBody {
  myinfo: AxsMyInfoPayload;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPhone(mobileno: AxsMyInfoPayload["mobileno"]): string {
  if (!mobileno?.nbr?.value) return "";
  const prefix = mobileno.prefix?.value ?? "+";
  const area = mobileno.areacode?.value ?? "65";
  return `${prefix}${area}${mobileno.nbr.value}`;
}

function extractAddress(regadd: AxsMyInfoPayload["regadd"]): string {
  if (!regadd) return "";
  const parts = [
    regadd.block?.value ? `Blk ${regadd.block.value}` : "",
    regadd.street?.value ?? "",
    regadd.floor?.value && regadd.unit?.value ? `#${regadd.floor.value}-${regadd.unit.value}` : "",
    regadd.building?.value ?? "",
  ].filter(Boolean);
  return parts.join(" ");
}

function extractCpfContributions(history: AxsMyInfoPayload["cpfcontributions"]): CpfContribution[] {
  if (!history?.history?.length) return [];
  return history.history.map((h) => ({
    month: h.month?.value ?? "",
    amount: h.amount?.value ?? 0,
    employer: h.employer?.value ?? "",
    paidOn: h.date?.value ?? "",
  }));
}

function extractNoaHistory(noa: AxsMyInfoPayload["noa-basic"]): NoaRecord[] {
  if (!noa?.amount?.value) return [];
  // noa-basic.yearofassessment.value might be "2,024.00" - parse it
  const yaRaw = String(noa.yearofassessment?.value ?? "").replace(/,/g, "");
  const ya = String(Math.round(parseFloat(yaRaw) || 0));
  return [{
    yearOfAssessment: ya,
    type: "ORIGINAL",
    taxClearance: "N",
    assessableIncome: noa.amount.value,
    employmentIncome: noa.amount.value,
    tradeIncome: 0,
    rentIncome: 0,
    interestIncome: 0,
  }];
}

function determineIdType(nationality?: string): string {
  if (!nationality) return "singaporean";
  const code = nationality.toUpperCase();
  if (code === "SG") return "singaporean";
  // PR detection would need residentialstatus; for now treat non-SG as foreigner
  return "foreigner";
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Validate API key
  const apiKey = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const expectedKey = process.env.AXS_PARTNER_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    console.warn(`${LOG} reject: invalid API key`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: AxsRequestBody;
  try {
    body = (await request.json()) as AxsRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const myinfo = body.myinfo;
  if (!myinfo) {
    return NextResponse.json({ error: "Missing myinfo object" }, { status: 400 });
  }

  const nric = myinfo.uinfin?.value ?? "";
  const fullName = myinfo.name?.value ?? "";
  const dob = myinfo.dob?.value ?? "";
  const mobile = extractPhone(myinfo.mobileno);
  const email = myinfo.email?.value ?? "";
  const address = extractAddress(myinfo.regadd);
  const postalCode = myinfo.regadd?.postal?.value ?? "";
  const axsRef = myinfo.axs?.["reference-id"] ?? "";
  const nationalityCode = myinfo.nationality?.code ?? "";
  const idType = determineIdType(nationalityCode);
  const requestedLoanAmount = myinfo.axs?.loan_amount ?? 20000;
  const requestedTenure = myinfo.axs?.tenure ?? DEFAULT_TENURE;

  console.info(`${LOG} processing`, { nric: nric.slice(0, 2) + "***", fullName, axsRef, idType });

  if (!nric) {
    return NextResponse.json({ error: "Missing uinfin (NRIC/FIN)" }, { status: 400 });
  }

  // 3. Create the applicant
  let leadId: string;
  try {
    leadId = await insertApplicant({
      authMethod: "axs",
      fullName: fullName || null,
      nric: nric || null,
      mobile: mobile || null,
      email: email || null,
      address: address || null,
      postalCode: postalCode || null,
      idType: idType === "foreigner" ? "foreigner" : "singaporean",
      desiredAmount: requestedLoanAmount,
      loanTenure: requestedTenure,
      moneylenderNoLoans: true, // never asked on the AXS path
      status: "new",
    });
  } catch (leadError) {
    console.error(`${LOG} insert applicant failed`, leadError);
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }
  console.info(`${LOG} applicant created`, { leadId, axsRef });

  // 4. Save MyInfo profile
  const cpfContributions = extractCpfContributions(myinfo.cpfcontributions);
  const noaHistory = extractNoaHistory(myinfo["noa-basic"]);

  await upsertMyinfoProfile(leadId, {
    nric,
    fullName: fullName || null,
    email: email || null,
    mobile: mobile || null,
    address: address || null,
    postalCode: postalCode || null,
    // Mapped, not verbatim. The whole payload is not kept here - see
    // myinfo_retrievals for where unminimised data lives, and for how long.
    processedPayload: { cpfContributions, noaHistory },
  });

  // 5. Eligibility check
  const eligibility = await checkLeadEligibility({
    phoneNumber: mobile,
    idNumber: nric,
    leadId,
  });

  await setEligibility(leadId, {
    status: eligibility.status,
    notes: eligibility.notes,
    reloanReason: eligibility.reloanReason,
  });

  if (eligibility.status === "NOT_ELIGIBLE" || eligibility.status === "RELOAN") {
    console.info(`${LOG} rejected by eligibility`, { leadId, status: eligibility.status });
    await setApplicantStatus(leadId, "rejected");

    // Still run credit scoring for analytics
    const assessment = assessCredit({
      dob,
      idType,
      cpfContributions,
      noaHistory,
      selfDeclaredMonthlyIncome: 0,
      requestedLoanAmount,
      moneylenderNoLoans: true,
      moneylenderLoanAmount: "",
      moneylenderPaymentHistory: "",
      authMethod: "singpass",
    });

    const creditRejectionReason = eligibility.status === "RELOAN" ? "airconnect_reloan" : "airconnect_not_eligible";

    await upsertCreditAssessment(leadId, {
      incomeSource: assessment.incomeSource,
      verifiedMonthlyIncome: assessment.verifiedMonthlyIncome,
      underwrittenCap: assessment.maxEligibleLoan,
      engineOfferAmount: 0,
      isEligible: false,
      creditRejectionReason,
      ageAtApplication: assessment.age || null,
      existingLoans: 0,
      explanation: `AirConnect: ${eligibility.notes} | Income: ${assessment.explanation}`,
      rawAssessment: { eligibility: eligibility.raw, assessment } as unknown as Record<string, unknown>,
    });

    // Still generate booking URL - rejected customers can still book
    const token = createAxsToken({ leadId, axsRef, approvedAmount: requestedLoanAmount, tenure: requestedTenure });
    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? "https://apply.crawfort.com";
    const bookingUrl = `${baseUrl}/axs/book?token=${token}`;

    return NextResponse.json({
      status: "pending",
      decision: "rejected",
      reason: creditRejectionReason,
      notes: eligibility.notes,
      verifiedMonthlyIncome: assessment.verifiedMonthlyIncome,
      maxEligibleLoan: assessment.maxEligibleLoan,
      leadId,
      axsRef,
      bookingUrl,
    });
  }

  // 6. Credit scoring
  const assessment = assessCredit({
    dob,
    idType,
    cpfContributions,
    noaHistory,
    selfDeclaredMonthlyIncome: 0,
    requestedLoanAmount,
    moneylenderNoLoans: true,
    moneylenderLoanAmount: "",
    moneylenderPaymentHistory: "",
    authMethod: "singpass", // Treat as verified since we have MyInfo data
  });

  const creditRejectionReason = deriveCreditRejectionReason(assessment);

  await upsertCreditAssessment(leadId, {
    incomeSource: assessment.incomeSource,
    verifiedMonthlyIncome: assessment.verifiedMonthlyIncome,
    underwrittenCap: assessment.maxEligibleLoan,
    engineOfferAmount: assessment.approvedLoanAmount,
    isEligible: assessment.isEligible,
    creditRejectionReason,
    ageAtApplication: assessment.age || null,
    existingLoans: 0,
    explanation: assessment.explanation,
    rawAssessment: assessment as unknown as Record<string, unknown>,
  });

  // The AXS path has no Ascend order, so the engine's figure is still what
  // this applicant is shown. It is the one route where that remains true.
  const approvedAmount = assessment.approvedLoanAmount;
  await setDesiredAmount(leadId, approvedAmount);
  await setApplicantStatus(leadId, assessment.isEligible ? "approved" : "rejected");

  // Always generate a booking token - all customers can book regardless of decision
  const token = createAxsToken({
    leadId,
    axsRef,
    approvedAmount: approvedAmount > 0 ? approvedAmount : requestedLoanAmount,
    tenure: requestedTenure,
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? "https://apply.crawfort.com";
  const bookingUrl = `${baseUrl}/axs/book?token=${token}`;

  const decision = (assessment.isEligible && approvedAmount > 0) ? "approved" : "rejected";

  console.info(`${LOG} ${decision}`, {
    leadId,
    axsRef,
    approvedAmount,
    maxEligibleLoan: assessment.maxEligibleLoan,
    verifiedMonthlyIncome: assessment.verifiedMonthlyIncome,
    incomeSource: assessment.incomeSource,
    requestedLoanAmount,
    requestedTenure,
  });

  return NextResponse.json({
    status: "pending",
    decision,
    reason: creditRejectionReason ?? null,
    notes: assessment.explanation,
    approvedLoanAmount: approvedAmount,
    maxEligibleLoan: assessment.maxEligibleLoan,
    tenure: requestedTenure,
    verifiedMonthlyIncome: assessment.verifiedMonthlyIncome,
    incomeSource: assessment.incomeSource,
    bookingUrl,
    leadId,
    axsRef,
  });
}
