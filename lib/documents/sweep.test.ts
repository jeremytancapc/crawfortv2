import { beforeEach, describe, expect, it, vi } from "vitest";

const docs = vi.hoisted(() => ({ list: vi.fn() }));
const events = vi.hoisted(() => ({
  expired: vi.fn(),
  deletedFromStorage: vi.fn(),
  log: vi.fn(),
}));
const store = vi.hoisted(() => ({ del: vi.fn() }));

vi.mock("@/lib/db/income-documents", () => ({
  listDocumentsNeedingDeletion: docs.list,
  markIncomeDocumentExpired: events.expired,
  markIncomeDocumentDeletedFromStorage: events.deletedFromStorage,
  logIncomeDocumentEvent: events.log,
}));
vi.mock("./store", () => ({ deleteDocument: store.del }));

import { RETENTION_DAYS, sweepIncomeDocuments } from "./sweep";

const doc = (status: string, id = status) => ({
  id,
  status,
  applicant_id: "a",
  object_key: `applicants/a/${id}.pdf`,
});

describe("sweepIncomeDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.del.mockResolvedValue(undefined);
  });

  it("expires an unsubmitted document, then deletes its bytes", async () => {
    docs.list.mockResolvedValue([doc("uploaded")]);
    const result = await sweepIncomeDocuments();

    expect(docs.list).toHaveBeenCalledWith(RETENTION_DAYS);
    expect(events.expired).toHaveBeenCalledTimes(1);
    expect(store.del).toHaveBeenCalledWith("applicants/a/uploaded.pdf");
    expect(events.deletedFromStorage).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ checked: 1, expired: 1, deleted: 1, failed: 0 });
  });

  it("only retries the delete for a document already removed - no second 'expired'", async () => {
    docs.list.mockResolvedValue([doc("removed")]);
    const result = await sweepIncomeDocuments();

    expect(events.expired).not.toHaveBeenCalled();
    expect(store.del).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ checked: 1, expired: 0, deleted: 1, failed: 0 });
  });

  it("logs a failed delete and does not mark the bytes as gone", async () => {
    docs.list.mockResolvedValue([doc("removed")]);
    store.del.mockRejectedValue(new Error("AccessDenied"));
    const result = await sweepIncomeDocuments();

    expect(events.deletedFromStorage).not.toHaveBeenCalled();
    expect(events.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "delete_failed" }),
    );
    expect(result.failed).toBe(1);
  });
});
