/**
 * The part of an Ascend credit application that MyInfo cannot answer.
 *
 * `borrowerMyInfo` is required on /openApi/apply/credit, and five of its
 * fields are mandatory: employment type, period, position, job category and a
 * bankruptcy declaration. None of them exist in MyInfo for a Singapore
 * citizen or PR - `employment` and `occupation` come from MOM's work-pass
 * records, so only pass holders have them, and the rest are nowhere at all.
 * They have to be asked.
 *
 * Every list here is closed: Ascend rejects anything off it. The values are
 * reproduced exactly as their specification writes them, spacing included -
 * "1-2 YEARS" has no spaces around the dash while "3 - 4 YEARS" does, and
 * "MANAGER / ASSISTANT MANAGER" is one option rather than two.
 */

export const EMPLOYMENT_TYPE_OPTIONS = [
  // Ordered by how often a borrower picks it, not alphabetically: nearly
  // everyone applying online is simply employed.
  "EMPLOYED",
  "SELF EMPLOYED",
  "FULL TIME PLATFORM WORKER",
  "EMPLOYED + PART TIME PLATFORM WORKER",
  "SELF EMPLOYED + PART TIME PLATFORM WORKER",
  "UNEMPLOYED WITH INCOME",
  "UNEMPLOYED WITHOUT INCOME",
] as const;

export const EMPLOYMENT_PERIOD_OPTIONS = [
  "JUST START WORKING, LESS THAN A MONTH",
  "1 MONTH",
  "2 MONTHS",
  "3 MONTHS",
  "4 MONTHS",
  "5 MONTHS",
  "6 - 7 MONTHS",
  "8 - 9 MONTHS",
  "10 - 12 MONTHS",
  "1-2 YEARS",
  "3 - 4 YEARS",
  "5 - 7 YEARS",
  "8 - 10 YEARS",
  "10 YEARS AND ABOVE",
] as const;

export const WORKING_POSITION_OPTIONS = [
  "NON-EXECUTIVE",
  "JUNIOR EXECUTIVE",
  "SENIOR EXECUTIVE",
  "SUPERVISOR",
  "MANAGER / ASSISTANT MANAGER",
  "SENIOR MANAGER",
  "DIRECTOR / GM",
  "PROFESSIONAL",
  "OTHERS",
] as const;

export const JOB_CATEGORY_OPTIONS = [
  "CONSTRUCTION",
  "MANUFACTURING",
  "WHOLESALE AND RETAIL TRADE",
  "TRANSPORTATION AND STORAGE",
  "ACCOMMODATION AND FOOD SERVICE ACTIVITIES",
  "INFORMATION AND COMMUNICATIONS",
  "FINANCIAL AND INSURANCE ACTIVITIES",
  "REAL ESTATE ACTIVITIES",
  "PROFESSIONAL, SCIENTIFIC AND TECHNICAL ACTIVITIES",
  "ADMINISTRATIVE AND SUPPORT SERVICE ACTIVITIES",
  "PUBLIC ADMINISTRATION AND DEFENSE",
  "EDUCATION",
  "HEALTH AND SOCIAL SERVICES",
  "ARTS, ENTERTAINMENT AND RECREATION",
  "OTHER SERVICE ACTIVITIES",
  "ACTIVITIES OF HOUSEHOLDS AS EMPLOYERS OF DOMESTIC PERSONNEL",
  "AGRICULTURE AND FISHING",
  "MINING AND QUARRYING",
  "ELECTRICITY, GAS, STEAM AND AIR-CONDITIONING SUPPLY",
  "WATER SUPPLY; SEWERAGE, WASTE MANAGEMENT AND REMEDIATION ACTIVITIES",
  "ACTIVITIES OF EXTRA-TERRITORIAL ORGANIZATIONS AND BODIES",
  "ACTIVITIES NOT ADEQUATELY DEFINED",
] as const;

export const BANKRUPTCY_OPTIONS = [
  "NOT BANKRUPTCY",
  "Bankruptcy Discharge > 5 years",
  "Bankruptcy Discharge 4 to 5 years",
  "Bankruptcy Discharge 1 to 3 years",
  "Bankruptcy Discharge < 1 year",
  "Bankrupted",
] as const;

export type BorrowerAnswers = {
  employmentType: (typeof EMPLOYMENT_TYPE_OPTIONS)[number];
  employmentPeriod: (typeof EMPLOYMENT_PERIOD_OPTIONS)[number];
  /** Ascend's spelling, missing the r. Correcting it sends a field they ignore. */
  wokingPosition: (typeof WORKING_POSITION_OPTIONS)[number];
  jobCategory: (typeof JOB_CATEGORY_OPTIONS)[number];
  bankruptcyDeclaration: (typeof BANKRUPTCY_OPTIONS)[number];
};

/** What we can fill in without asking. All optional to Ascend. */
export type BorrowerExtras = {
  /** MyInfo's passexpirydate, as yyyy-MM-dd. Required by Ascend for FIN holders. */
  passExpiryDate?: string;
  /** PR only. Not in MyInfo, so only present if collected. */
  issuanceDate?: string;
  officeNumber?: string;
  mailingAddress?: string;
  secondaryPhone?: string;
};

export type BorrowerMyInfo = BorrowerAnswers & BorrowerExtras;

const LISTS: Record<keyof BorrowerAnswers, readonly string[]> = {
  employmentType: EMPLOYMENT_TYPE_OPTIONS,
  employmentPeriod: EMPLOYMENT_PERIOD_OPTIONS,
  wokingPosition: WORKING_POSITION_OPTIONS,
  jobCategory: JOB_CATEGORY_OPTIONS,
  bankruptcyDeclaration: BANKRUPTCY_OPTIONS,
};

/** Ascend wants dd/MM/yyyy; MyInfo gives yyyy-MM-dd. */
function asAscendDate(iso: string | undefined): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso?.trim() ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : undefined;
}

/**
 * Validated here rather than at the API boundary, because the alternative is
 * discovering a bad value at submit - after Singpass, after the credit pull -
 * which is the most expensive moment to find out.
 */
export function buildBorrowerMyInfo(
  answers: BorrowerAnswers,
  extras: BorrowerExtras,
): BorrowerMyInfo {
  for (const [field, allowed] of Object.entries(LISTS)) {
    const value = answers[field as keyof BorrowerAnswers];
    if (!allowed.includes(value)) {
      throw new Error(
        `${field}: "${value}" is not one of Ascend's values (${allowed.length} allowed)`,
      );
    }
  }

  const built: BorrowerMyInfo = { ...answers };

  // Omitted rather than sent empty: Ascend drops empty values from the
  // signature, so an empty string is a field that is not really there.
  const passExpiryDate = asAscendDate(extras.passExpiryDate);
  if (passExpiryDate) built.passExpiryDate = passExpiryDate;

  const issuanceDate = asAscendDate(extras.issuanceDate) ?? extras.issuanceDate?.trim();
  if (issuanceDate) built.issuanceDate = issuanceDate;

  for (const key of ["officeNumber", "mailingAddress", "secondaryPhone"] as const) {
    const value = extras[key]?.trim();
    if (value) built[key] = value;
  }

  return built;
}
