import { describe, expect, it } from "vitest";

import { nextPathAfterSubmit, postSubmitUrl } from "./post-submit-nav";

const LEAD = "00000000-0000-4000-8000-000000000001";

describe("nextPathAfterSubmit", () => {
  it("follows the destination the server decided", () => {
    // Four outcomes now, not two. A boolean cannot carry verify-income.
    expect(nextPathAfterSubmit({ destination: "/apply/verify-income", leadId: LEAD }))
      .toBe(`/apply/verify-income?leadId=${LEAD}`);
  });

  it("carries the applicant id so the page can load after cookies are cleared", () => {
    expect(nextPathAfterSubmit({ destination: "/apply/approval", leadId: LEAD }))
      .toBe(`/apply/approval?leadId=${LEAD}`);
  });

  it("falls back to the pending page when the server named no destination", () => {
    // Safer than defaulting to approval: pending is the credit review queue,
    // and showing an offer nobody decided is the worse failure.
    expect(nextPathAfterSubmit({ leadId: LEAD })).toBe(`/apply/pending?leadId=${LEAD}`);
  });

  it("omits the query string when there is no applicant id", () => {
    expect(nextPathAfterSubmit({ destination: "/apply/approval", leadId: null }))
      .toBe("/apply/approval");
  });
});

describe("postSubmitUrl", () => {
  it("appends the id to a path that already has a query string", () => {
    expect(postSubmitUrl("/apply/approval?x=1", LEAD)).toBe(`/apply/approval?x=1&leadId=${LEAD}`);
  });
});
