/**
 * HTTP client for the Ascend Open API.
 *
 * Every call is a POST of the same signed envelope; only `data` differs. See
 * docs/ascend-open-api.md for the endpoint catalogue and the signing rules
 * this relies on.
 */

import type { AscendConfig } from "./config";
import { buildSignedRequest } from "./sign";

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
export async function callAscend<T = unknown>(
  path: string,
  data: Record<string, unknown>,
  options?: { config?: AscendConfig; timeoutMs?: number },
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

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
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
    throw new AscendError(
      String(response.status),
      `non-JSON response: ${text.slice(0, 200)}`,
      path,
    );
  }

  if (envelope.code !== ASCEND_SUCCESS_CODE) {
    throw new AscendError(envelope.code, envelope.msg, path);
  }

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
  options?: { config?: AscendConfig },
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
  options?: { config?: AscendConfig },
): Promise<AscendCreditResult> {
  if (!input.myinfo && !input.userId) {
    throw new Error("ascendApplyCredit needs either myinfo or userId");
  }
  return callAscend<AscendCreditResult>("/openApi/apply/credit", { ...input }, options);
}

/** Re-checks an order left PENDING, which means Ascend has no income on file. */
export function ascendQueryCredit(
  input: { orderId: string },
  options?: { config?: AscendConfig },
): Promise<AscendCreditResult> {
  return callAscend<AscendCreditResult>("/openApi/query/credit", { ...input }, options);
}
