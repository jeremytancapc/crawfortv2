import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs against a real Postgres: the NRIC lives in two tables and the Ascend
 * identity in three columns, and what is under test is that one edit moves all
 * of them together for one applicant and for nobody else.
 *
 *   TEST_DATABASE_URL=$(bash scripts/db-test-server.sh start) npx vitest run lib/db/applicants-nric
 */
const TEST_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_URL)("setApplicantNric - the staging ID number edit", () => {
  let insertApplicant: typeof import("./applicants").insertApplicant;
  let setApplicantNric: typeof import("./applicants").setApplicantNric;
  let setAscendIdentity: typeof import("./applicants").setAscendIdentity;
  let getApplicant: typeof import("./applicants").getApplicant;
  let sql: typeof import("./sql").sql;

  const made: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL;
    ({ insertApplicant, setApplicantNric, setAscendIdentity, getApplicant } = await import("./applicants"));
    ({ sql } = await import("./sql"));
  });

  afterAll(async () => {
    for (const id of made) await sql`delete from applicants where id = ${id}`;
  });

  async function applicantWith(nric: string): Promise<string> {
    const id = await insertApplicant({ desiredAmount: 5000, loanTenure: 6, authMethod: "singpass", nric, status: "in_progress" });
    made.push(id);
    return id;
  }

  it("changes the applicant's NRIC", async () => {
    const id = await applicantWith("S1234567A");

    await setApplicantNric(id, "S7654321B");

    expect((await getApplicant(id))?.nric).toBe("S7654321B");
  });

  it("changes the copy kept on the MyInfo profile as well", async () => {
    const id = await applicantWith("S1234567A");
    await sql`insert into myinfo_profiles (applicant_id, nric) values (${id}, 'S1234567A')`;

    await setApplicantNric(id, "S7654321B");

    const rows = await sql<{ nric: string }>`select nric from myinfo_profiles where applicant_id = ${id}`;
    expect(rows.map((r) => r.nric)).toEqual(["S7654321B"]);
  });

  it("forgets who Ascend said this was, because it is now someone else", async () => {
    const id = await applicantWith("S1234567A");
    await setAscendIdentity(id, { ascendUserId: "1561757121636130816", newCustomer: false, hasMyinfo: true });

    await setApplicantNric(id, "S7654321B");

    const after = await getApplicant(id);
    expect(after?.ascend_user_id).toBeNull();
    expect(after?.ascend_new_customer).toBeNull();
    expect(after?.ascend_has_myinfo).toBeNull();
  });

  it("leaves every other applicant alone", async () => {
    const edited = await applicantWith("S1234567A");
    const bystander = await applicantWith("S1111111A");

    await setApplicantNric(edited, "S7654321B");

    expect((await getApplicant(bystander))?.nric).toBe("S1111111A");
  });
});
