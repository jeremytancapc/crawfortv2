import { describe, expect, it, vi } from "vitest";

import { CREDIT_LIMIT_SOURCE, pushCreditLimit } from "./credit-limit";

const APPLICANT = { full_name: "TAN CAKEN", mobile: "91234567", nric: "S1234567D", auth_method: "singpass" };
const ORDER = "1560590648489684992";

const deps = (over: Record<string, unknown> = {}) => ({
  getApplicant: vi.fn().mockResolvedValue(APPLICANT),
  push: vi.fn().mockResolvedValue(true),
  ...over,
});

describe("pushCreditLimit", () => {
  it("names this app as the source: it is the second H5", () => {
    expect(CREDIT_LIMIT_SOURCE).toBe("cf_h5_v2");
  });

  it("sends the lead again carrying Ascend's limit and the order it belongs to", async () => {
    const d = deps();

    const ok = await pushCreditLimit({ applicantId: "a-1", orderId: ORDER, amount: 7600 }, d as never);

    expect(ok).toBe(true);
    expect(d.push).toHaveBeenCalledWith(
      {
        applicantId: "a-1",
        customerName: "TAN CAKEN",
        phoneNumber: "+6591234567",
        idNumber: "S1234567D",
        creditLimit: { amount: 7600, source: "cf_h5_v2", provider: "ascend", reference: ORDER },
      },
      expect.any(String),
    );
  });

  it("sends nothing for a limit that is not a positive amount", async () => {
    for (const amount of [0, -5, Number.NaN]) {
      const d = deps();
      expect(await pushCreditLimit({ applicantId: "a-1", orderId: ORDER, amount }, d as never), String(amount)).toBe(false);
      expect(d.push).not.toHaveBeenCalled();
    }
  });

  it("sends nothing when the applicant cannot be found", async () => {
    const d = deps({ getApplicant: vi.fn().mockResolvedValue(null) });

    expect(await pushCreditLimit({ applicantId: "a-1", orderId: ORDER, amount: 7600 }, d as never)).toBe(false);
    expect(d.push).not.toHaveBeenCalled();
  });

  it("never throws: an approved applicant must not lose their offer to a missed note", async () => {
    const d = deps({ getApplicant: vi.fn().mockRejectedValue(new Error("db down")) });

    await expect(pushCreditLimit({ applicantId: "a-1", orderId: ORDER, amount: 7600 }, d as never)).resolves.toBe(false);
  });
});
