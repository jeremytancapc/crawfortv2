import { describe, expect, it } from "vitest";

import { MAX_INCOME_FILES, afterReread, canRemoveOnResults, footerAction, pendingNote, roomForMore } from "./income-add-more";

/**
 * On the results page an applicant can add more documents but not take any
 * away. Two rules keep that safe: the reading never takes more files than the
 * server will read, and a re-read that fails never costs them the figures
 * they already had.
 */

describe("roomForMore", () => {
  it("takes everything while under the limit", () => {
    expect(roomForMore(2, 3)).toEqual({ accept: 3, message: null });
  });

  it("takes only what fits, and says how many were left out", () => {
    expect(roomForMore(MAX_INCOME_FILES - 1, 3)).toEqual({
      accept: 1,
      message: `You can add up to ${MAX_INCOME_FILES} documents. 2 were not added.`,
    });
  });

  it("takes nothing once full", () => {
    expect(roomForMore(MAX_INCOME_FILES, 1)).toEqual({
      accept: 0,
      message: `You can add up to ${MAX_INCOME_FILES} documents. 1 was not added.`,
    });
  });

  it("is quiet when nothing was offered", () => {
    expect(roomForMore(1, 0)).toEqual({ accept: 0, message: null });
  });
});

describe("afterReread - what the page does with a second reading", () => {
  it("shows the new figures when the new reading is usable", () => {
    expect(afterReread({ hadReading: true, readUsable: true })).toBe("replace");
  });

  it("keeps the earlier figures, and says why the new document did not count, when it is not usable", () => {
    expect(afterReread({ hadReading: true, readUsable: false })).toBe("keep_previous");
  });

  it("shows what is missing when there was never a reading to keep", () => {
    expect(afterReread({ hadReading: false, readUsable: false })).toBe("show_ask");
  });
});

describe("footerAction - what the main button does on the results page", () => {
  it("submits when nothing has changed since the figures were read", () => {
    expect(footerAction({ saving: false, unreadNew: 0 })).toBe("submit");
  });

  it("offers to update the income once new documents are saved - it does not submit stale figures", () => {
    expect(footerAction({ saving: false, unreadNew: 2 })).toBe("update");
  });

  it("waits while a document is still being saved", () => {
    expect(footerAction({ saving: true, unreadNew: 0 })).toBe("saving");
    expect(footerAction({ saving: true, unreadNew: 1 })).toBe("saving");
  });
});

describe("pendingNote", () => {
  it("says nothing when there is nothing new", () => {
    expect(pendingNote(0)).toBeNull();
  });

  it("tells the applicant the new documents are not counted yet", () => {
    expect(pendingNote(1)).toBe("1 new document added. Tap Update my income to include it.");
    expect(pendingNote(3)).toBe("3 new documents added. Tap Update my income to include them.");
  });
});

describe("canRemoveOnResults - a document that did not count can be taken out; one that did cannot", () => {
  const counted = new Set(["doc-a", "doc-b"]);

  it("keeps a document the figures were read from", () => {
    expect(canRemoveOnResults({ status: "ready", documentId: "doc-a" }, counted)).toBe(false);
  });

  it("lets a refused document go - it is not in the figures, and left in it blocks every later reading", () => {
    expect(canRemoveOnResults({ status: "ready", documentId: "doc-z" }, counted)).toBe(true);
  });

  it("lets a file that failed to save go", () => {
    expect(canRemoveOnResults({ status: "failed" }, counted)).toBe(true);
  });

  it("lets a file still saving go", () => {
    expect(canRemoveOnResults({ status: "uploading" }, counted)).toBe(true);
  });

  it("lets anything go when nothing was read yet - no figures depend on it", () => {
    expect(canRemoveOnResults({ status: "ready", documentId: "doc-a" }, new Set())).toBe(true);
  });
});
