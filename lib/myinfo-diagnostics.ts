/**
 * What arrived from Singpass, described without any of it.
 *
 * When an applicant says "it didn't fill in my details", the useful question
 * is which fields were in the payload - and that question has to be
 * answerable from a log, months later, without the log holding their NRIC.
 * So this reports field NAMES and counts only. No values, ever.
 *
 * It exists because the failure it detects is silent: a payload in a shape
 * the mapper does not understand yields no fields, raises no error, and lets
 * the applicant continue with a blank application.
 */

import { myinfoPersonData } from "./myinfo";

/** The ten fields lib/myinfo.ts maps onto the form. */
export const MYINFO_FIELDS_CONSUMED = [
  "uinfin",
  "name",
  "dob",
  "email",
  "mobileno",
  "regadd",
  "residentialstatus",
  "marital",
  "noahistory",
  "cpfcontributions",
] as const;

export type MyinfoPayloadReport = {
  /** fapi2 nests the person under person_info; legacy puts it at the top. */
  shape: "fapi2" | "legacy" | "unknown";
  /** Which of the consumed fields were present. Names only. */
  present: string[];
  /** Which were absent. This is the list support actually wants. */
  missing: string[];
  /** Total keys in the person object, including ones we never read. */
  totalFields: number;
  /**
   * False when nothing usable arrived. The distinction that matters: a
   * payload can be large and still map to nothing if its shape changed.
   */
  usable: boolean;
};

export function describeMyinfoPayload(payload: Record<string, unknown>): MyinfoPayloadReport {
  const person = myinfoPersonData(payload);
  const keys = Object.keys(person);

  const present = MYINFO_FIELDS_CONSUMED.filter((f) => f in person);
  const missing = MYINFO_FIELDS_CONSUMED.filter((f) => !(f in person));

  const nested = "person_info" in payload;
  const shape: MyinfoPayloadReport["shape"] =
    present.length === 0 ? "unknown" : nested ? "fapi2" : "legacy";

  return {
    shape,
    present: [...present],
    missing: [...missing],
    totalFields: keys.length,
    usable: present.length > 0,
  };
}
