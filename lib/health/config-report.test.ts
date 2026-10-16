import { describe, expect, it } from "vitest";

import { configReport, problemsIn } from "./config-report";

const GOOD = {
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_SHA: "c71572f0123456789",
  ASCEND_ENABLED: "true",
  ASCEND_BASE_URL: "https://api-admin-ascend.crawfort.com",
  ASCEND_APP_ID: "10001",
  ASCEND_APP_SECRET: "secret",
  DATABASE_URL: "postgresql://u:p@h/db",
  DOCUMENTS_S3_BUCKET: "bucket",
  DOCUMENTS_S3_REGION: "ap-southeast-1",
  DOCUMENTS_URL_SECRET: "x",
  AWS_ACCESS_KEY_ID: "AKIAEXAMPLE",
  AWS_SECRET_ACCESS_KEY: "awssecret",
  ANTHROPIC_API_KEY: "sk-ant-x",
  MYINFO_AUTH_URL: "https://lss57v8zd2.execute-api.ap-southeast-1.amazonaws.com/prod/auth",
  AIRCONNECT_API_KEY: "k",
  AIRCONNECT_LEADS_URL: "https://airconnect.test/leads",
  AIRCONNECT_APPOINTMENTS_URL: "https://airconnect.test/appointments",
  NEXT_PUBLIC_APP_BASE_URL: "https://get.crawfort.com",
  CRON_SECRET: "cron-value-9f3a",
  MYINFO_EDITOR_ENABLED: "false",
  MYINFO_CAPTURE_ENABLED: "false",
} as unknown as NodeJS.ProcessEnv;

const env = (over: Record<string, string | undefined>) => ({ ...GOOD, ...over }) as NodeJS.ProcessEnv;

describe("configReport", () => {
  it("says yes to everything for a complete production, and names the commit it is running", () => {
    const report = configReport(GOOD);

    expect(report).toMatchObject({
      environment: "production",
      commit: "c71572f",
      ascend: true,
      database: true,
      documents: true,
      anthropic: true,
      singpass: true,
      airconnect: true,
      appBaseUrl: true,
      cron: true,
      editorsOff: true,
      testBanksOff: true,
    });
    expect(problemsIn(report)).toEqual([]);
  });

  it("catches the fault of 16 Oct: no Ascend secret", () => {
    const report = configReport(env({ ASCEND_APP_SECRET: undefined }));

    expect(report.ascend).toBe(false);
    expect(problemsIn(report)).toEqual(["ascend"]);
  });

  it("catches each other setting that production needs", () => {
    const cases: Array<[string, Record<string, string | undefined>]> = [
      ["database", { DATABASE_URL: undefined }],
      ["documents", { DOCUMENTS_URL_SECRET: undefined }],
      ["anthropic", { ANTHROPIC_API_KEY: "  " }],
      ["airconnect", { AIRCONNECT_API_KEY: undefined }],
      ["appBaseUrl", { NEXT_PUBLIC_APP_BASE_URL: undefined }],
      ["singpass", { MYINFO_AUTH_URL: undefined }],
    ];
    for (const [name, over] of cases) {
      expect(problemsIn(configReport(env(over))), name).toEqual([name]);
    }
  });

  it("refuses a staging Singpass Lambda on production", () => {
    const report = configReport(env({ MYINFO_AUTH_URL: "https://3j05ygjt3i.execute-api.ap-southeast-1.amazonaws.com/stg/auth" }));

    expect(report.singpass).toBe(false);
  });

  it("refuses the staging editors and test banks being on", () => {
    expect(problemsIn(configReport(env({ MYINFO_EDITOR_ENABLED: "true" })))).toEqual(["editorsOff"]);
    expect(problemsIn(configReport(env({ MYINFO_CAPTURE_ENABLED: "true" })))).toEqual(["editorsOff"]);
    expect(problemsIn(configReport(env({ TEST_RECOGNISED_BANKS: "HARBOURFRONT" })))).toEqual(["testBanksOff"]);
  });

  it("never carries a value: only yes or no, the environment name and the commit", () => {
    const text = JSON.stringify(configReport(GOOD));

    for (const secret of ["secret", "sk-ant-x", "postgresql", "lss57v8zd2", "airconnect.test", "9f3a"]) {
      expect(text.includes(secret), secret).toBe(false);
    }
  });
});
