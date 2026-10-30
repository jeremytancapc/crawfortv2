import { describe, expect, it } from "vitest";

import { translateText } from "./i18n";
import { UPLOAD_GUIDANCE } from "./income-upload-guidance";

/**
 * Said on the upload screen before anything is uploaded, so a customer does not
 * learn what we cannot use only by being refused - and does not upload their
 * NRIC and think they are done.
 */
describe("upload guidance", () => {
  const all = [UPLOAD_GUIDANCE.heading, ...UPLOAD_GUIDANCE.lines];

  it("asks for the PDF of a payslip or bank statement", () => {
    expect(UPLOAD_GUIDANCE.lines.join(" ")).toMatch(/PDF of your payslip or bank statement/);
  });

  it("says plainly what cannot be used: ID, CPF pages, credit reports and screenshots of a banking app", () => {
    const text = UPLOAD_GUIDANCE.lines.join(" ");
    for (const word of ["NRIC", "CPF", "credit reports", "screenshots of a banking app"]) {
      expect(text).toContain(word);
    }
  });

  it("is translated into both other languages", () => {
    for (const line of all) {
      expect(translateText(line, "zh-CN")).not.toBe(line);
      expect(translateText(line, "ms")).not.toBe(line);
    }
  });
});
