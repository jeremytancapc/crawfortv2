/**
 * What the upload screen says before anything is uploaded.
 *
 * Learning what we cannot use only by being refused sends customers round in
 * circles: 13 attempts from one who had a real bank statement, 7 from one who
 * sent screenshots of a banking app and CPF pages, and some will simply upload
 * their NRIC and consider it done. So the screen says it first.
 */
export const UPLOAD_GUIDANCE = {
  heading: "What to upload",
  lines: [
    "Use the PDF of your payslip or bank statement. Download it from your employer's portal or from your bank's website or app.",
    "We cannot use an NRIC or other ID, CPF pages, credit reports, or screenshots of a banking app.",
  ],
} as const;
