import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { FICTIONAL_NUMBERS, findIdentifiers, isMarkedAsTest } from "./identifiers";

/**
 * The eval files are committed, and they are documents of people. They must hold
 * invented people only. These tests do two things:
 *
 *   1. prove the scanner catches each kind of identifier (so a green run means
 *      something), and
 *   2. run it over every committed file under evals/.
 *
 * A real NRIC, number or email pasted into a fixture fails the second part.
 */

const kinds = (text: string) => findIdentifiers(text).map((f) => f.kind);

describe("findIdentifiers", () => {
  it("catches a full NRIC or FIN, whatever the case", () => {
    expect(kinds("NRIC S1234567D")).toEqual(["nric"]);
    expect(kinds("fin g7654321k")).toEqual(["nric"]);
    expect(kinds("T0412345A and M1234567X")).toEqual(["nric", "nric"]);
  });

  it("lets a masked NRIC through - that is how banks print it", () => {
    expect(kinds("S****083H")).toEqual([]);
  });

  it("catches an email address, but not an example domain", () => {
    expect(kinds("mail tan@gmail.com")).toEqual(["email"]);
    expect(kinds("mail tan@example.com, lim@staff.example.org, a@b.test")).toEqual([]);
  });

  it("catches a Singapore phone number in the usual spellings", () => {
    for (const text of ["+65 9123 4567", "9123 4567", "91234567", "+6581234567", "6123-4567"]) {
      expect(kinds(text), text).toEqual(["phone"]);
    }
  });

  it("does not take an amount, date or employee number for a phone number", () => {
    for (const text of ["5,200.00", "29000.00 / 261000.00", "1,91234567.00", "2026-09-30", "employee no. 100257", "S$ 12,345,678"]) {
      expect(kinds(text), text).toEqual([]);
    }
  });

  it("catches a bank account number, hyphenated or a long run of digits", () => {
    expect(kinds("Account 123-456789-0")).toEqual(["account"]);
    expect(kinds("Account 1234567890")).toEqual(["account"]);
  });

  it("lets the fictional account numbers through, and only those", () => {
    expect(kinds("Account 301-000555-1")).toEqual([]);
    expect(kinds(`Account ${FICTIONAL_NUMBERS[0]}`)).toEqual([]);
    expect(kinds("Account 301-000556-1")).toEqual(["account"]);
  });

  it("reports where it was found, so the fix is quick", () => {
    const [finding] = findIdentifiers("line one\nNRIC S1234567D here");

    expect(finding).toMatchObject({ kind: "nric", line: 2, text: "S1234567D" });
  });
});

describe("isMarkedAsTest", () => {
  it("accepts the SAMPLE stamp and the staging-persona line", () => {
    expect(isMarkedAsTest("SAMPLE - not a real payslip")).toBe(true);
    expect(isMarkedAsTest("Generated test document for UAT (staging persona). Not a real payslip.")).toBe(true);
  });

  it("refuses a document with neither", () => {
    expect(isMarkedAsTest("PAYSLIP  Net pay 4,160.00")).toBe(false);
  });
});

// ── The committed files ─────────────────────────────────────────────────────

const EVALS = __dirname;
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "results" ? [] : walk(full);
    return [full];
  });

const files = walk(EVALS);
const relative = (file: string) => path.relative(EVALS, file);
// The scanner's own tests contain planted identifiers on purpose.
const IS_SCANNER_TEST = (file: string) => relative(file) === "identifiers.test.ts";

const text = files.filter((f) => /\.(ts|mts|json|md)$/.test(f) && !IS_SCANNER_TEST(f));
const pdfs = files.filter((f) => f.endsWith(".pdf"));

const pdftotext = (() => {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("the committed eval files hold no real identifiers", () => {
  it("finds the files it is meant to scan", () => {
    expect(text.length).toBeGreaterThan(20);
    expect(pdfs.length).toBeGreaterThan(20);
  });

  it.each(text.map((f) => [relative(f), f]))("%s", (_name, file) => {
    expect(findIdentifiers(readFileSync(file, "utf8"))).toEqual([]);
  });

  // The generator holds every number printed on the fixtures, so the PNG (which
  // cannot be read as text) is covered by it. PDFs are read back as well,
  // because that is what the model sees.
  it.skipIf(!pdftotext).each(pdfs.map((f) => [relative(f), f]))("%s", (_name, file) => {
    const content = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });

    expect(findIdentifiers(content)).toEqual([]);
    expect(isMarkedAsTest(content), "carries neither a SAMPLE stamp nor a staging-persona line").toBe(true);
  });
});

describe("the replies from real runs stay off git", () => {
  it("evals/results/ is ignored", () => {
    const ignore = existsSync(path.join(EVALS, "../.gitignore")) ? readFileSync(path.join(EVALS, "../.gitignore"), "utf8") : "";

    expect(ignore).toMatch(/^evals\/results\/?$/m);
  });
});
