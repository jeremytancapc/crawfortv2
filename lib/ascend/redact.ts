/**
 * What an Ascend call may leave behind in `api_logs`.
 *
 * The apply/credit request carries a whole MyInfo payload - NRIC, full name,
 * address, CPF history, notices of assessment. Support reads these logs to
 * find out why a submission never became an Order, and that question is
 * answered by which fields were sent and what Ascend replied, never by the
 * applicant's income or where they live.
 *
 * So the envelope survives and the payload becomes a list of field names. A
 * missing `uinfin` or an empty `myinfo` is still diagnosable; the person's
 * details are not in the table to leak.
 */

export type RedactedAscendRequest = {
  appId: unknown;
  timestamp: unknown;
  nonce: unknown;
  /** Enough to match a call against Ascend's own logs, not to verify it. */
  sign: string;
  /** Top-level keys of `data`, in order. */
  dataFields: string[];
  /** Keys of the MyInfo payload, when one was sent. */
  myinfoFields?: string[];
};

function keysOf(value: unknown): string[] | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>)
    : undefined;
}

export function redactAscendRequest(body: Record<string, unknown>): RedactedAscendRequest {
  const data = (body.data ?? {}) as Record<string, unknown>;
  const myinfoFields = keysOf(data.myinfo);

  return {
    appId: body.appId,
    timestamp: body.timestamp,
    nonce: body.nonce,
    sign: String(body.sign ?? "").slice(0, 12),
    dataFields: Object.keys(data),
    ...(myinfoFields ? { myinfoFields } : {}),
  };
}
