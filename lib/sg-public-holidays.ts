/**
 * Gazetted Singapore public holidays, including in-lieu dates
 * when the holiday falls on a Sunday.
 * Keys are local calendar dates (YYYY-MM-DD).
 */
const SG_PUBLIC_HOLIDAYS: Record<string, string> = {
  "2026-01-01": "New Year's Day",
  "2026-02-17": "Chinese New Year",
  "2026-02-18": "Chinese New Year",
  "2026-03-21": "Hari Raya Puasa",
  "2026-04-03": "Good Friday",
  "2026-05-01": "Labour Day",
  "2026-05-27": "Hari Raya Haji",
  "2026-06-01": "Vesak Day (in lieu)",
  "2026-08-10": "National Day (in lieu)",
  "2026-11-09": "Deepavali (in lieu)",
  "2026-12-25": "Christmas Day",
  "2027-01-01": "New Year's Day",
};

export function sgPublicHolidayName(dateKey: string): string | undefined {
  return SG_PUBLIC_HOLIDAYS[dateKey];
}

export function isSgPublicHoliday(dateKey: string): boolean {
  return dateKey in SG_PUBLIC_HOLIDAYS;
}
