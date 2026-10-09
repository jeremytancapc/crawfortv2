import { describe, expect, it } from "vitest";

import { findDuplicate, readingStillHolds } from "./income-document-rules";

/**
 * Two rules about the stored income documents, kept apart from the routes so
 * they can be tested without a database.
 */

describe("readingStillHolds - may these figures still be submitted?", () => {
  const reading = { id: "r1", document_ids: ["a", "b", "c"] };
  const read = (id: string, readingId = "r1") => ({ id, status: "read" as const, reading_id: readingId });

  it("holds when every document the figures came from is still there, read for this reading", () => {
    expect(readingStillHolds(reading, [read("a"), read("b"), read("c")])).toBe(true);
  });

  it("ignores extra documents - they are not in the figures and are not sent", () => {
    // Left from an earlier attempt, refused, or added and not yet read.
    const extras = [
      { id: "x", status: "uploaded" as const, reading_id: null },
      { id: "y", status: "read" as const, reading_id: "older-reading" },
    ];

    expect(readingStillHolds(reading, [read("a"), read("b"), read("c"), ...extras])).toBe(true);
  });

  it("fails when a document the figures came from has been removed", () => {
    expect(readingStillHolds(reading, [read("a"), read("b")])).toBe(false);
  });

  it("fails when one of them now belongs to a different reading", () => {
    expect(readingStillHolds(reading, [read("a"), read("b"), read("c", "r2")])).toBe(false);
  });

  it("fails when there is nothing to submit", () => {
    expect(readingStillHolds({ id: "r1", document_ids: [] }, [])).toBe(false);
  });
});

describe("findDuplicate - the same file is never stored twice", () => {
  const stored = [
    { id: "a", sha256: "aaa", file_name: "slip-sep.pdf" },
    { id: "b", sha256: "bbb", file_name: "slip-aug.pdf" },
  ];

  it("finds a document with identical content, whatever it is called", () => {
    expect(findDuplicate(stored, "bbb")?.id).toBe("b");
  });

  it("finds nothing for new content", () => {
    expect(findDuplicate(stored, "ccc")).toBeUndefined();
  });
});
