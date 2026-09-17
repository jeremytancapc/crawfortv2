/**
 * HTTP client for the Ascend Open API.
 *
 * Every call is a POST of the same signed envelope; only `data` differs. See
 * docs/ascend-open-api.md for the endpoint catalogue and the signing rules
 * this relies on.
 */

import type { AscendConfig } from "./config";
import { buildSignedRequest } from "./sign";
import { logExternalApi } from "@/lib/external-api-logger";
import { redactAscendRequest } from "./redact";

/** Ascend returns `"10000"` for success - a string, and not `"200"`. */
export const ASCEND_SUCCESS_CODE = "10000";

export type AscendEnvelope<T> = {
  code: string;
  msg: string;
  data: T;
};

/**
 * Fields are declared and assigned rather than written as constructor
 * parameter properties: Node's type stripping refuses those, and scripts
 * import this module directly so that it and the app never drift apart.
 */
export class AscendError extends Error {
  readonly code: string;
  readonly msg: string;
  readonly path: string;

  constructor(code: string, msg: string, path: string) {
    super(`Ascend ${path} returned ${code}: ${msg}`);
    this.name = "AscendError";
    this.code = code;
    this.msg = msg;
    this.path = path;
  }
}

export class AscendNotConfiguredError extends Error {
  constructor() {
    super("Ascend is not configured (ASCEND_ENABLED, ASCEND_BASE_URL, ASCEND_APP_ID, ASCEND_APP_SECRET)");
    this.name = "AscendNotConfiguredError";
  }
}

/**
 * Signs `data`, POSTs it, and unwraps the envelope.
 *
 * Throws AscendError on any code other than 10000 rather than returning it:
 * a caller that forgets to check a status code on a lending API should fail
 * loudly, not carry on with an empty `data`.
 *
 * `config` is injectable so a smoke test can target an environment without
 * touching process.env.
 */
/**
 * `applicantId` is not sent to Ascend - it stamps the api_logs row, so a
 * support question about one customer is a single `where applicant_id = ...`
 * rather than a guess at which of the day's calls was theirs.
 */
export type AscendCallOptions = {
  config?: AscendConfig;
  timeoutMs?: number;
  applicantId?: string | null;
};

export async function callAscend<T = unknown>(
  path: string,
  data: Record<string, unknown>,
  options?: AscendCallOptions,
): Promise<T> {
  // ./config is loaded lazily, and only when no config was passed in: it is
  // the one part of this module that reads process.env, so an injected config
  // makes the whole client testable without touching the environment.
  const config = options?.config ?? (await import("./config")).ascendConfig();
  if (!config) throw new AscendNotConfiguredError();

  const body = buildSignedRequest(data, config);
  const url = `${config.baseUrl}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 30_000);

  // Every outcome below is recorded, because the failures are the ones worth
  // having. A call that never became an Order used to leave nothing but a
  // console line in a serverless log nobody keeps, which made "the applicant
  // submitted but nothing reached Ascend" indistinguishable from "the
  // applicant never submitted".
  const started = Date.now();
  const record = (status: number, ok: boolean, responseBody: string, error?: string) =>
    logExternalApi({
      tag: `[ascend]${path}`,
      url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Redacted: this request carries the applicant's whole MyInfo payload.
      body: redactAscendRequest(body as Record<string, unknown>),
      status,
      ok,
      ms: Date.now() - started,
      responseBody: responseBody.slice(0, 2000),
      ...(options?.applicantId ? { leadId: options.applicantId } : {}),
      ...(error ? { error } : {}),
    });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    // A timeout or a DNS failure never reaches Ascend at all, and is the one
    // case with no response to learn from - so it has to be recorded here.
    record(0, false, "", err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();

  let envelope: AscendEnvelope<T>;
  try {
    envelope = JSON.parse(text) as AscendEnvelope<T>;
  } catch {
    // Non-JSON means something answered that was not Ascend - a gateway, a
    // login wall, an error page. Surface a slice of it rather than a generic
    // parse failure, because the body says which.
    record(response.status, false, text, "non-JSON response");
    throw new AscendError(
      String(response.status),
      `non-JSON response: ${text.slice(0, 200)}`,
      path,
    );
  }

  if (envelope.code !== ASCEND_SUCCESS_CODE) {
    record(response.status, false, text, `${envelope.code}: ${envelope.msg}`);
    throw new AscendError(envelope.code, envelope.msg, path);
  }

  record(response.status, true, text);
  return envelope.data;
}

// ── Endpoints ────────────────────────────────────────────────────────────

export type AscendUser = {
  userId: string;
  newCustomer: boolean;
  hasMyinfo: boolean;
};

/**
 * Identifies the applicant, and is the authority on New vs Reloan.
 *
 * This does not only look up: it CREATES the user in Ascend and returns the
 * userId that /openApi/apply/credit later consumes. Cheap in credit pulls,
 * but not free of side effects - so never call it on render or speculatively.
 */
export function ascendUsers(
  input: { idNumber: string; phone: string },
  options?: AscendCallOptions,
): Promise<AscendUser> {
  return callAscend<AscendUser>("/openApi/users", { ...input }, options);
}

export type AscendRiskStatus = "PASS" | "PENDING" | "REJECT";

export type AscendCreditResult = {
  orderId: string;
  /**
   * Ascend's user. Resolved from the MyInfo `sub` claim, NOT from `uinfin` -
   * established by submitting a payload with a changed NRIC but the original
   * sub, which returned the original user. A string because these ids exceed
   * Number.MAX_SAFE_INTEGER.
   */
  userId: string;
  newCustomer: boolean;
  risk: {
    riskStatus: AscendRiskStatus;
    /**
     * Documented as present only on REJECT, but a PENDING response carried
     * "There is no income, please submit income". Treat it as available on
     * any non-PASS status.
     */
    riskMsg?: string;
  };
  /**
   * EMPTY on PENDING. A pending response returns `creditScore: {}`, so every
   * field here is optional - reading `.creditLimit` off a pending result
   * yields undefined, not a number. Check riskStatus before trusting any of
   * it.
   */
  creditScore: {
    creditLevel?: string;
    /** A-Card Limit: what Ascend will lend. May exceed the Desired Amount. */
    creditLimit?: number;
    /** Fractional - a live response returned 588.26. */
    creditScore?: number;
    /** Maximum Loan Quantum: the MLCB ceiling. */
    mlcbMaxLoanAmount?: number;
  };
};

/** Maps Ascend's wire spelling to the CONTEXT.md Risk Status vocabulary. */
export function toRiskStatus(wire: AscendRiskStatus): "passed" | "pending" | "rejected" {
  switch (wire) {
    case "PASS":
      return "passed";
    case "PENDING":
      return "pending";
    case "REJECT":
      return "rejected";
  }
}

/**
 * The credit decision. NOT a quote - it creates an Order.
 *
 * Call once per applicant, guarded by the persisted orderId (ADR-0001). Takes
 * either the MyInfo object or a userId that has authorised MyInfo.
 */
export function ascendApplyCredit(
  input: {
    desiredAmount: number;
    myinfo?: Record<string, unknown>;
    userId?: string;
    remark?: string;
  },
  options?: AscendCallOptions,
): Promise<AscendCreditResult> {
  if (!input.myinfo && !input.userId) {
    throw new Error("ascendApplyCredit needs either myinfo or userId");
  }
  return callAscend<AscendCreditResult>("/openApi/apply/credit", { ...input }, options);
}

/** Re-checks an order left PENDING, which means Ascend has no income on file. */
export function ascendQueryCredit(
  input: { orderId: string },
  options?: AscendCallOptions,
): Promise<AscendCreditResult> {
  return callAscend<AscendCreditResult>("/openApi/query/credit", { ...input }, options);
}

/** What the payslip extraction produces, in Ascend's shape. */
export type AscendIncomeInput = {
  orderId: string;
  /** CPF, NOA, PANEL_PAYSLIP, NON_PANEL_PAYSLIP, BANK_STATEMENT_OTHER_INCOME, INCOME_STATEMENT */
  incomeType: string;
  /** The three months before this one, most recent first. */
  m1: number;
  m2: number;
  m3: number;
  /** Whether a document backs these figures. Ascend calls this credible income. */
  incomeFile: boolean;
  files: Array<{ fileType: string; fileName: string; fileUrl: string }>;
};

/**
 * Submits income against a PENDING order, which re-scores it.
 *
 * Only valid while the order is still awaiting income: once it has passed,
 * Ascend answers `600: order status is not CREATE or ELIGIBILITY`. The
 * response is the same shape as apply/credit, so the same decision applies.
 */
export function ascendSubmitIncome(
  input: AscendIncomeInput,
  options?: AscendCallOptions,
): Promise<AscendCreditResult> {
  const monthlyIncome = Number(((input.m1 + input.m2 + input.m3) / 3).toFixed(2));

  return callAscend<AscendCreditResult>(
    "/openApi/income/credit",
    {
      orderId: input.orderId,
      income: {
        incomeType: input.incomeType,
        documentTypes: [input.incomeType],
        incomeFile: input.incomeFile,
        m1: input.m1,
        m2: input.m2,
        m3: input.m3,
        monthlyIncome,
        yearlyIncome: Number((monthlyIncome * 12).toFixed(2)),
      },
      orderFile: input.files,
    },
    options,
  );
}

/** Records the applicant's chosen plan against the order, as a free-text note. */
export function ascendAddOrderComment(
  input: { orderId: string; comments: string },
  options?: AscendCallOptions,
): Promise<Record<string, unknown>> {
  return callAscend<Record<string, unknown>>("/openApi/order/comments", { ...input }, options);
}

export type AscendUploadedFile = {
  /** The URL Ascend returns, which /openApi/income/credit takes as fileUrl. */
  url: string;
};

/**
 * Uploads one document and returns the URL Ascend gives it back.
 *
 * Multipart, not JSON: `file` as binary alongside `fileInfo`, with the usual
 * signed envelope as sibling fields - the shape /openApi/docusign uses, since
 * this endpoint's own documentation does not say whether it wants one.
 *
 * UNVERIFIED against a live endpoint. On the `test` environment this answers
 * `500: System error` for every request shape and every file type tried -
 * including no envelope at all, flattened fields, and `data` in place of
 * `fileInfo`. A malformed request returns 502 by their own error table, so a
 * 500 across all of them points at the endpoint rather than the caller. The
 * same environment 404s /openApi/user/myinfo.
 */
export async function ascendUploadFile(
  input: {
    userId: string;
    fileName: string;
    contentType: string;
    bytes: ArrayBuffer;
    fileSource?: string;
    fileBusiness?: string;
  },
  options?: AscendCallOptions,
): Promise<AscendUploadedFile> {
  const config = options?.config ?? (await import("./config")).ascendConfig();
  if (!config) throw new AscendNotConfiguredError();

  const fileInfo = {
    userId: input.userId,
    fileSource: input.fileSource ?? "web",
    fileBusiness: input.fileBusiness ?? "income",
  };
  const signed = buildSignedRequest(fileInfo, config);

  const form = new FormData();
  form.append("file", new Blob([input.bytes], { type: input.contentType }), input.fileName);
  form.append("fileInfo", JSON.stringify(fileInfo));
  form.append("appId", signed.appId);
  form.append("timestamp", signed.timestamp);
  form.append("nonce", signed.nonce);
  form.append("sign", signed.sign);

  const response = await fetch(`${config.baseUrl}/openApi/file/upload`, {
    method: "POST",
    body: form,
  });

  const text = await response.text();
  let envelope: AscendEnvelope<string>;
  try {
    envelope = JSON.parse(text) as AscendEnvelope<string>;
  } catch {
    throw new AscendError(
      String(response.status),
      `non-JSON response: ${text.slice(0, 200)}`,
      "/openApi/file/upload",
    );
  }

  if (envelope.code !== ASCEND_SUCCESS_CODE) {
    throw new AscendError(envelope.code, envelope.msg, "/openApi/file/upload");
  }

  // `data` is the URL itself, not an object wrapping one.
  return { url: envelope.data };
}
