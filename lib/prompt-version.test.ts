import { describe, expect, it } from "vitest";

import { versionOf } from "./prompt-version";

describe("versionOf - a label for 'which prompt and schema produced this reply'", () => {
  it("is the same for the same text", () => {
    expect(versionOf("system", { a: 1 })).toBe(versionOf("system", { a: 1 }));
  });

  it("changes when the prompt changes by a single character", () => {
    expect(versionOf("system.", { a: 1 })).not.toBe(versionOf("system", { a: 1 }));
  });

  it("changes when the tool schema changes", () => {
    expect(versionOf("system", { a: 1 })).not.toBe(versionOf("system", { a: 2 }));
  });

  it("is twelve hex characters, short enough to read in a log line", () => {
    expect(versionOf("system", { a: 1 })).toMatch(/^[0-9a-f]{12}$/);
  });

  it("does not confuse where the prompt ends and the schema begins", () => {
    expect(versionOf("ab", "c")).not.toBe(versionOf("a", "bc"));
  });
});
