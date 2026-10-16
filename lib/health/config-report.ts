/**
 * Which settings the running site actually has.
 *
 * A local file of settings proves nothing about what Vercel holds. On 16 Oct the
 * first real customer was sent to "under review" because one Ascend setting was
 * missing in production, while the local file checked out. This answers from the
 * live site: yes or no per setting, never a value.
 */

import { ascendConfig } from "@/lib/ascend/config";

export type ConfigReport = {
  environment: string | null;
  /** The first seven characters of the commit this deployment is running. */
  commit: string | null;
  ascend: boolean;
  database: boolean;
  documents: boolean;
  anthropic: boolean;
  singpass: boolean;
  airconnect: boolean;
  appBaseUrl: boolean;
  cron: boolean;
  /** The staging-only editors and capture are off. */
  editorsOff: boolean;
  /** The staging-only test banks are off. */
  testBanksOff: boolean;
};

const has = (value: string | undefined) => Boolean(value?.trim());

export function configReport(env: NodeJS.ProcessEnv = process.env): ConfigReport {
  const environment = env.VERCEL_ENV ?? null;
  const singpassUrl = env.MYINFO_AUTH_URL?.trim() ?? "";

  return {
    environment,
    commit: env.VERCEL_GIT_COMMIT_SHA ? env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : null,
    ascend: ascendConfig(env) !== null,
    database: has(env.DATABASE_URL),
    // Stored documents need the bucket, its region, the signing secret and the keys.
    documents:
      has(env.DOCUMENTS_S3_BUCKET) &&
      has(env.DOCUMENTS_S3_REGION) &&
      has(env.DOCUMENTS_URL_SECRET) &&
      has(env.AWS_ACCESS_KEY_ID) &&
      has(env.AWS_SECRET_ACCESS_KEY),
    anthropic: has(env.ANTHROPIC_API_KEY),
    // On production the Singpass Lambda must be the production one, not /stg/.
    singpass: singpassUrl !== "" && !(environment === "production" && singpassUrl.includes("/stg/")),
    airconnect: has(env.AIRCONNECT_API_KEY) && has(env.AIRCONNECT_LEADS_URL) && has(env.AIRCONNECT_APPOINTMENTS_URL),
    appBaseUrl: has(env.NEXT_PUBLIC_APP_BASE_URL),
    cron: has(env.CRON_SECRET),
    editorsOff: env.MYINFO_EDITOR_ENABLED !== "true" && env.MYINFO_CAPTURE_ENABLED !== "true",
    testBanksOff: !has(env.TEST_RECOGNISED_BANKS),
  };
}

/** The names of the settings that are not right. Empty when all is well. */
export function problemsIn(report: ConfigReport): string[] {
  return Object.entries(report)
    .filter(([, value]) => value === false)
    .map(([name]) => name);
}
