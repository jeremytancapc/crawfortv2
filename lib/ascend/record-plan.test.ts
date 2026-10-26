import { describe, expect, it, vi } from "vitest";

import { AscendError } from "./client";
import { placeNoteOnAscendOrder, recordBookingOnAscendOrder } from "./record-plan";

const ORDER = { order_id: "1563576689950142464" };

const deps = (over: Record<string, unknown> = {}) => ({
  configured: vi.fn().mockReturnValue(true),
  getOrder: vi.fn().mockResolvedValue(ORDER),
  addComment: vi.fn().mockResolvedValue({}),
  logFailure: vi.fn(),
  ...over,
});

describe("placeNoteOnAscendOrder", () => {
  it("puts the note on the applicant's order, tied to the applicant so the call can be found", async () => {
    const d = deps();

    expect(await placeNoteOnAscendOrder("a-1", "Plan selected: custom", "plan", d as never)).toBe(true);

    expect(d.addComment).toHaveBeenCalledWith(
      { orderId: ORDER.order_id, comments: "Plan selected: custom" },
      expect.objectContaining({ applicantId: "a-1" }),
    );
    expect(d.logFailure).not.toHaveBeenCalled();
  });

  it("logs when Ascend refuses the note, with what it said", async () => {
    const d = deps({ addComment: vi.fn().mockRejectedValue(new AscendError("600", "Signature verification failed", "/openApi/order/comments")) });

    expect(await placeNoteOnAscendOrder("a-1", "x", "plan", d as never)).toBe(false);

    expect(d.logFailure).toHaveBeenCalledWith("a-1", "plan", expect.stringContaining("Signature verification failed"));
  });

  it("logs when the call never completes", async () => {
    const d = deps({ addComment: vi.fn().mockRejectedValue(new Error("This operation was aborted")) });

    expect(await placeNoteOnAscendOrder("a-1", "x", "plan", d as never)).toBe(false);

    expect(d.logFailure).toHaveBeenCalledWith("a-1", "plan", expect.stringContaining("aborted"));
  });

  it("logs when there is no order to put the note on", async () => {
    const d = deps({ getOrder: vi.fn().mockResolvedValue(null) });

    expect(await placeNoteOnAscendOrder("a-1", "x", "plan", d as never)).toBe(false);

    expect(d.logFailure).toHaveBeenCalledWith("a-1", "plan", expect.stringMatching(/no ascend order/i));
    expect(d.addComment).not.toHaveBeenCalled();
  });

  it("logs when our own database cannot be read", async () => {
    const d = deps({ getOrder: vi.fn().mockRejectedValue(new Error("db down")) });

    expect(await placeNoteOnAscendOrder("a-1", "x", "plan", d as never)).toBe(false);

    expect(d.logFailure).toHaveBeenCalledWith("a-1", "plan", expect.stringContaining("db down"));
  });

  it("logs when Ascend is not configured", async () => {
    const d = deps({ configured: vi.fn().mockReturnValue(false) });

    expect(await placeNoteOnAscendOrder("a-1", "x", "plan", d as never)).toBe(false);

    expect(d.logFailure).toHaveBeenCalledWith("a-1", "plan", expect.stringMatching(/not configured/i));
    expect(d.addComment).not.toHaveBeenCalled();
  });

  it("never throws, even when logging the failure fails", async () => {
    const d = deps({
      addComment: vi.fn().mockRejectedValue(new Error("boom")),
      logFailure: vi.fn().mockImplementation(() => {
        throw new Error("log down");
      }),
    });

    await expect(placeNoteOnAscendOrder("a-1", "x", "plan", d as never)).resolves.toBe(false);
  });
});

describe("recordBookingOnAscendOrder", () => {
  const slot = { date: "2026-10-24", time: "19:00" };

  it("tells staff when the customer booked without choosing a plan", async () => {
    const d = deps();

    await recordBookingOnAscendOrder("a-1", { selectedPlan: null, ...slot }, d as never);

    expect(d.addComment).toHaveBeenCalledTimes(1);
    const note = d.addComment.mock.calls[0][0].comments as string;
    expect(note).toMatch(/without choosing a plan/i);
    expect(note).toContain("2026-10-24");
    expect(note).toContain("19:00");
    expect(d.addComment.mock.calls[0][1]).toEqual(expect.objectContaining({ applicantId: "a-1" }));
  });

  it("writes nothing when a plan was chosen", async () => {
    const d = deps();

    await recordBookingOnAscendOrder("a-1", { selectedPlan: "lowest_interest", ...slot }, d as never);

    expect(d.addComment).not.toHaveBeenCalled();
    expect(d.logFailure).not.toHaveBeenCalled();
  });

  it("logs the failure under its own purpose when the note cannot be placed", async () => {
    const d = deps({ addComment: vi.fn().mockRejectedValue(new Error("nope")) });

    await recordBookingOnAscendOrder("a-1", { selectedPlan: null, ...slot }, d as never);

    expect(d.logFailure).toHaveBeenCalledWith("a-1", "booking without plan", expect.stringContaining("nope"));
  });
});
