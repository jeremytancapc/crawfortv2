/**
 * Ascend connection settings.
 *
 * Everything here comes from the environment. Nothing in this repo may hold a
 * live appId or secret - the smoke-test scripts that do are gitignored for
 * exactly that reason.
 *
 * Ascend is off unless it is fully configured, so a deploy that is missing one
 * variable behaves like a deploy that was never meant to call Ascend, rather
 * than failing halfway through an applicant's journey.
 */

export type AscendConfig = {
  baseUrl: string;
  appId: string;
  secret: string;
};

/**
 * Environments from the Ascend guide. Our credentials are currently accepted by
 * `test` only - uat answered 401 when the last round of smoke tests ran - so the
 * URL stays an env var rather than being picked from a hardcoded map.
 */
export const ASCEND_ENVIRONMENTS = {
  test: "https://api-mms.newtime.top",
  uat: "https://api-admin-uat-ascend.crawfort.com",
  prod: "https://api-admin-ascend.crawfort.com",
} as const;

/**
 * Returns null when Ascend is not configured or not switched on. Callers treat
 * null as "Ascend is not part of this journey" and keep the pre-Ascend
 * behaviour, which is what lets this land on production dark.
 */
export function ascendConfig(): AscendConfig | null {
  if (process.env.ASCEND_ENABLED !== "true") return null;

  const baseUrl = process.env.ASCEND_BASE_URL?.trim() ?? "";
  const appId = process.env.ASCEND_APP_ID?.trim() ?? "";
  const secret = process.env.ASCEND_APP_SECRET?.trim() ?? "";

  if (!baseUrl || !appId || !secret) {
    console.warn("[ascend] ASCEND_ENABLED is true but config is incomplete - staying off", {
      hasBaseUrl: Boolean(baseUrl),
      hasAppId: Boolean(appId),
      hasSecret: Boolean(secret),
    });
    return null;
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), appId, secret };
}
