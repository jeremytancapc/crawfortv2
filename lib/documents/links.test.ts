import { describe, expect, it } from "vitest";

import { signDocumentToken, readDocumentToken } from "./links";

const SECRET = "a".repeat(64);
const OTHER = "b".repeat(64);
const KEY = "applicants/431db450/2026-09-18/payslip-aug.pdf";

describe("document links", () => {
  it("round-trips the object it points at", () => {
    const token = signDocumentToken(KEY, SECRET);

    expect(readDocumentToken(token, SECRET)).toBe(KEY);
  });

  it("refuses a token signed with a different secret", () => {
    // The whole point: the link is handed to a third party, so holding one
    // must not be enough to mint others.
    expect(readDocumentToken(signDocumentToken(KEY, OTHER), SECRET)).toBeNull();
  });

  it("refuses a token whose key was edited", () => {
    const token = signDocumentToken(KEY, SECRET);
    const [payload, signature] = token.split(".");
    const swapped = Buffer.from("applicants/SOMEONE-ELSE/payslip.pdf").toString("base64url");

    expect(readDocumentToken(`${swapped}.${signature}`, SECRET)).toBeNull();
  });

  it("refuses rubbish without throwing", () => {
    for (const bad of ["", ".", "nodot", "a.b.c", "!!!.???", "x".repeat(5000)]) {
      expect(readDocumentToken(bad, SECRET)).toBeNull();
    }
  });

  it("produces a URL-safe token", () => {
    // It travels in a path segment and is stored by Ascend, so anything
    // needing escaping will eventually come back wrong.
    expect(signDocumentToken(KEY, SECRET)).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it("gives the same key the same token, so a retry does not orphan a link", () => {
    expect(signDocumentToken(KEY, SECRET)).toBe(signDocumentToken(KEY, SECRET));
  });
});

describe("object keys", () => {
  it("keeps an applicant's documents together and never collides", async () => {
    const { documentKey } = await import("./links");
    const a = documentKey("431db450-5695-4bc5-9556-cfcd4168c73c", "Aug payslip.pdf");
    const b = documentKey("431db450-5695-4bc5-9556-cfcd4168c73c", "Aug payslip.pdf");

    expect(a).toContain("431db450-5695-4bc5-9556-cfcd4168c73c");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^applicants\/[0-9a-f-]+\/[0-9a-f]+\.pdf$/);
  });

  it("does not carry the applicant's own filename into the key", () => {
    // Filenames arrive from the applicant's phone. "../../etc/passwd" and
    // "my nric S1234567D.pdf" are both things people actually upload.
    const key = documentKeySync("431db450-5695-4bc5-9556-cfcd4168c73c", "../../secret S1234567D.pdf");

    expect(key).not.toContain("..");
    expect(key).not.toContain("S1234567D");
    expect(key).not.toContain(" ");
  });
});

import { documentKey as documentKeySync } from "./links";
