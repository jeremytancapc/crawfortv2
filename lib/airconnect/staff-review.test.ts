import { describe, expect, it, vi } from "vitest";

import { pushStaffReviewLink, staffReviewLinkAtSubmit } from "./staff-review";

const APPLICANT = {
  full_name: "TAN CAKEN",
  mobile: "91234567",
  nric: "S1234567D",
  auth_method: "singpass",
};
const ORDER = "1560591551355564032";
const BASE = "https://api-admin-ascend.crawfort.com";
const LINK = `${BASE}/order/pending/notify?orderId=${ORDER}`;

const deps = (over: Record<string, unknown> = {}) => ({
  getApplicant: vi.fn().mockResolvedValue(APPLICANT),
  push: vi.fn().mockResolvedValue(true),
  baseUrl: BASE,
  ...over,
});

describe("pushStaffReviewLink", () => {
  it("sends the lead again with the link staff open to review the order", async () => {
    const d = deps();

    const ok = await pushStaffReviewLink({ applicantId: "a-1", orderId: ORDER }, d as never);

    expect(ok).toBe(true);
    expect(d.push).toHaveBeenCalledWith(
      {
        applicantId: "a-1",
        customerName: "TAN CAKEN",
        phoneNumber: "+6591234567",
        idNumber: "S1234567D",
        customerHyperLink: LINK,
      },
      expect.any(String),
    );
  });

  it("leaves the ID number out for an applicant who did not come through Singpass", async () => {
    const d = deps({ getApplicant: vi.fn().mockResolvedValue({ ...APPLICANT, auth_method: "manual" }) });

    await pushStaffReviewLink({ applicantId: "a-1", orderId: ORDER }, d as never);

    expect(d.push.mock.calls[0][0]).not.toHaveProperty("idNumber");
  });

  it("sends nothing when the link cannot be built", async () => {
    const d = deps({ baseUrl: "" });

    expect(await pushStaffReviewLink({ applicantId: "a-1", orderId: ORDER }, d as never)).toBe(false);
    expect(d.push).not.toHaveBeenCalled();
  });

  it("sends nothing when the applicant cannot be found", async () => {
    const d = deps({ getApplicant: vi.fn().mockResolvedValue(null) });

    expect(await pushStaffReviewLink({ applicantId: "a-1", orderId: ORDER }, d as never)).toBe(false);
    expect(d.push).not.toHaveBeenCalled();
  });

  it("never throws: an applicant who finished a step must not lose it to a missed note", async () => {
    const d = deps({ getApplicant: vi.fn().mockRejectedValue(new Error("db down")) });

    await expect(pushStaffReviewLink({ applicantId: "a-1", orderId: ORDER }, d as never)).resolves.toBe(false);
  });
});

describe("staffReviewLinkAtSubmit", () => {
  const link = (kind: string) => staffReviewLinkAtSubmit({ kind } as never, ORDER, BASE);

  it("gives staff the link as soon as Ascend asks for income, before any is submitted", () => {
    expect(link("needs_income")).toBe(LINK);
  });

  it("gives staff the link for a PASS that named no limit", () => {
    expect(link("unresolved")).toBe(LINK);
  });

  it("gives nobody a link when no person is needed or the application is closed", () => {
    expect(link("approved")).toBeUndefined();
    expect(link("declined")).toBeUndefined();
    expect(link("unavailable")).toBeUndefined();
  });

  it("gives no link without an order to open", () => {
    expect(staffReviewLinkAtSubmit({ kind: "needs_income" } as never, undefined, BASE)).toBeUndefined();
    expect(staffReviewLinkAtSubmit({ kind: "needs_income" } as never, "abc", BASE)).toBeUndefined();
  });
});
