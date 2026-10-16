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
 * behaviour, which is what lets this land on staging and on a laptop without it.
 *
 * Takes the environment as an argument so it can be tested; it defaults to the
 * real one.
 */
export function ascendConfig(env: NodeJS.ProcessEnv = process.env): AscendConfig | null {
  if (env.ASCEND_ENABLED !== "true") return null;

  const baseUrl = env.ASCEND_BASE_URL?.trim() ?? "";
  const appId = env.ASCEND_APP_ID?.trim() ?? "";
  const secret = env.ASCEND_APP_SECRET?.trim() ?? "";

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

/**
 * True on the live site when Ascend is not fully set up.
 *
 * "Ascend is off" is a fine state for staging and a laptop, but on production it
 * is a fault: with no answer from Ascend an applicant is sent to the "under
 * review" page, nobody checks them and no lead is made. On 16 Oct the first
 * real customer went this way because one setting (the app secret) was not in
 * Vercel. Production refuses to submit instead, so the applicant is told to try
 * again and the fault shows up at once.
 */
export function ascendMissingInProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === "production" && ascendConfig(env) === null;
}
