/**
 * Does an Ascend reply still look the way Ascend has always answered?
 *
 * On 8 Oct 2026 income/credit began returning PASS with an empty creditScore,
 * where every earlier PASS had carried the limit. Nothing announced it; the
 * first we knew was testers landing on the pending page. This looks at each
 * credit reply and names what is off, so the next change is a logged line on
 * the day it starts.
 *
 * Pure: it only reads the reply. Logging it, and what is done about it, is
 * shape-report.ts.
 */

export type ShapeSeverity = "watch" | "alert";

export type ShapeProblem = {
  code:
    | "not_an_object"
    | "missing_risk"
    | "missing_order_id"
    | "unknown_risk_status"
    | "pass_without_limit"
    | "pass_without_mlcb_max"
    | "unexpected_fields";
  /**
   * `watch`: a known departure from Ascend's own documentation that we already
   * handle (re-asking for a missing limit) - counted, not alarming.
   * `alert`: something never seen, which should be looked at.
   */
  severity: ShapeSeverity;
  detail: string;
};

const CREDIT_ENDPOINTS = new Set(["/openApi/apply/credit", "/openApi/income/credit", "/openApi/query/credit"]);

// Everything seen in these replies on staging, 17 Sep - 13 Oct 2026. A field
// outside these is new; add it here once it has been looked at.
const KNOWN_TOP = new Set(["creditScore", "hasIncome", "newCustomer", "orderId", "risk", "userId"]);
const KNOWN_RISK = new Set(["riskStatus", "riskMsg"]);
const KNOWN_SCORE = new Set(["creditLevel", "creditLimit", "creditScore", "mlcbMaxLoanAmount"]);
const KNOWN_STATUS = new Set(["PASS", "PENDING", "REJECT"]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unknownKeys = (value: Record<string, unknown>, known: Set<string>) => Object.keys(value).filter((k) => !known.has(k));

export function shapeProblems(path: string, data: unknown): ShapeProblem[] {
  if (!CREDIT_ENDPOINTS.has(path)) return [];
  if (!isObject(data)) return [{ code: "not_an_object", severity: "alert", detail: `data is ${data === null ? "null" : typeof data}` }];

  const problems: ShapeProblem[] = [];
  const risk = isObject(data.risk) ? data.risk : null;
  const score = isObject(data.creditScore) ? data.creditScore : {};

  if (!risk) problems.push({ code: "missing_risk", severity: "alert", detail: "no risk object" });
  if (typeof data.orderId !== "string" || !data.orderId) {
    problems.push({ code: "missing_order_id", severity: "alert", detail: "no orderId" });
  }

  const status = risk?.riskStatus;
  if (risk && !KNOWN_STATUS.has(String(status))) {
    problems.push({ code: "unknown_risk_status", severity: "alert", detail: `riskStatus is ${JSON.stringify(status)}` });
  }

  // Documented as always present on a PASS; an empty score was what changed.
  if (status === "PASS") {
    if (!(Number(score.creditLimit) > 0)) {
      problems.push({ code: "pass_without_limit", severity: "watch", detail: "PASS with no creditLimit" });
    } else if (score.mlcbMaxLoanAmount === undefined || score.mlcbMaxLoanAmount === null) {
      problems.push({ code: "pass_without_mlcb_max", severity: "watch", detail: "PASS with a limit but no mlcbMaxLoanAmount" });
    }
  }

  const fresh = [
    ...unknownKeys(data, KNOWN_TOP),
    ...(risk ? unknownKeys(risk, KNOWN_RISK).map((k) => `risk.${k}`) : []),
    ...unknownKeys(score, KNOWN_SCORE).map((k) => `creditScore.${k}`),
  ];
  if (fresh.length > 0) problems.push({ code: "unexpected_fields", severity: "alert", detail: `new fields: ${fresh.join(", ")}` });

  return problems;
}

/** Codes that are counted and do not raise the alarm: known, and handled. */
const WATCH_ONLY = new Set(["pass_without_limit", "pass_without_mlcb_max"]);

/**
 * The daily report: rows of `{ codes: "a,b", n }` from the shape log, boiled
 * down to a count per code and whether anything other than a known watch item
 * appeared.
 */
export function summariseShapeLog(rows: Array<{ codes: string; n: number }>): {
  alert: boolean;
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const code of row.codes.split(",").filter(Boolean)) counts[code] = (counts[code] ?? 0) + row.n;
  }
  return { alert: Object.keys(counts).some((code) => !WATCH_ONLY.has(code)), counts };
}
