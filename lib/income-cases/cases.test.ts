import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { decide, type IncomeDocument } from "../income-extraction";

/**
 * The test set: real applicants' stored reports, with the names replaced, and
 * what a customer should be told. Each file here is a case that went wrong in
 * production; it is run through `decide`, which is plain code, so the set costs
 * nothing to run. Add a case by dropping a file in this folder - see the
 * existing ones for the shape. A case must be proven red on the code that got
 * it wrong before the fix goes in.
 */

type Case = {
  description: string;
  applicant: { name: string; aliases?: string[] };
  today: string;
  employmentType?: string;
  report: unknown;
  expect: { kind: string; reasonIncludes?: string[] };
};

const DIR = __dirname;
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

const DOC = (i: number): IncomeDocument => ({
  fileName: `document-${i + 1}.pdf`,
  mediaType: "application/pdf",
  bytes: Buffer.from("x"),
});

describe("income cases", () => {
  it("has cases", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const c = JSON.parse(readFileSync(join(DIR, file), "utf8")) as Case;

    it(`${file}: ${c.description.slice(0, 80)}`, () => {
      const count = (c.report as { documents: unknown[] }).documents.length;
      const outcome = decide(Array.from({ length: count }, (_, i) => DOC(i)), { reported: c.report as never }, {
        today: new Date(c.today),
        applicant: c.applicant,
        employmentType: c.employmentType,
      });

      expect(outcome.kind).toBe(c.expect.kind);
      const reason = (outcome as { reason?: string }).reason ?? "";
      for (const part of c.expect.reasonIncludes ?? []) expect(reason).toContain(part);
    });
  }
});
