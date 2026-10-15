import { describe, expect, it } from "vitest";

import { buildSimulatedMyInfoPayload } from "./singpass-simulate";
import { buildMyInfoPatch, myinfoPersonData } from "./myinfo";

describe("buildSimulatedMyInfoPayload", () => {
  it("produces the shape the real Lambda sends, not the legacy one", () => {
    // Local development that exercises a different payload shape than
    // production is how the person_info bug survived being tested at all.
    const { myinfo } = buildSimulatedMyInfoPayload();

    expect(myinfo).toHaveProperty("person_info");
    expect(myinfo.iss).toContain("/fapi");
  });

  it("carries a bare-UUID sub, as FAPI 2.0 does", () => {
    const { myinfo } = buildSimulatedMyInfoPayload();

    // The legacy form was `u=<uuid>`. Ascend keys identity on this claim, so
    // the prefix is not cosmetic.
    expect(myinfo.sub).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("still maps through to a complete applicant", () => {
    const { myinfo } = buildSimulatedMyInfoPayload();
    const patch = buildMyInfoPatch(myinfo);

    expect(patch.nric).toBeTruthy();
    expect(patch.fullName).toBeTruthy();
    expect(patch.cpfContributions?.length).toBeGreaterThan(0);
    expect(patch.noaHistory?.length).toBeGreaterThan(0);
  });

  it("keeps the CPF dates fresh so the income engine still scores them", () => {
    const { myinfo } = buildSimulatedMyInfoPayload();
    const person = myinfoPersonData(myinfo);
    const history = (person.cpfcontributions as { history: Array<{ month: { value: string } }> }).history;

    const thisMonth = new Date();
    const lastMonth = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth()).padStart(2, "0")}`;
    expect(history[0].month.value).toBe(
      thisMonth.getMonth() === 0
        ? `${thisMonth.getFullYear() - 1}-12`
        : lastMonth,
    );
  });
});
