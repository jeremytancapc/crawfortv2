import { describe, expect, it } from "vitest";

import { MAX_INCOME_FILES, afterReread, roomForMore } from "./income-add-more";

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
