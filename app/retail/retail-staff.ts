import type { StationType } from "./types";

/** Mock logged-in retail staff identity (in-memory CRM). */
export const RETAIL_STAFF = {
  id: "staff-rachel-ong",
  name: "Rachel Ong",
  initials: "RO",
  role: "Loan Officer",
  outlet: "Orchard Outlet",
  email: "rachel.ong@crawfort.com",
  /** Royalty-free portrait (Pexels). */
  avatarSrc: "/images/retail-staff-avatar.jpg",
} as const;

export interface RetailStaffMember {
  id: string;
  name: string;
  initials: string;
  role: string;
}

/** Dummy outlet roster used for room / cashier assignments in the mock CRM. */
export const RETAIL_STAFF_ROSTER: RetailStaffMember[] = [
  RETAIL_STAFF,
  { id: "staff-marcus-tan", name: "Marcus Tan", initials: "MT", role: "Loan Officer" },
  { id: "staff-priya-nair", name: "Priya Nair", initials: "PN", role: "Customer Advisor" },
  { id: "staff-jason-lim", name: "Jason Lim", initials: "JL", role: "Loan Officer" },
  { id: "staff-siti-rahman", name: "Siti Rahman", initials: "SR", role: "Cashier" },
  { id: "staff-david-wong", name: "David Wong", initials: "DW", role: "Customer Advisor" },
];

const STAFF_BY_ID = Object.fromEntries(
  RETAIL_STAFF_ROSTER.map((s) => [s.id, s]),
) as Record<string, RetailStaffMember>;

export function getStaffById(id: string | null | undefined): RetailStaffMember | null {
  if (!id) return null;
  return STAFF_BY_ID[id] ?? null;
}

/** Rooms and cashier need an officer; kiosks are self-service. */
export function stationRequiresStaff(type: StationType): boolean {
  return type === "room" || type === "cashier";
}

export function stationTypeFromId(stationId: string | null): StationType | null {
  if (!stationId) return null;
  if (stationId.startsWith("kiosk-")) return "kiosk";
  if (stationId.startsWith("room-")) return "room";
  if (stationId.startsWith("cashier")) return "cashier";
  return null;
}

/**
 * Pick a deterministic dummy officer for a station when auto-allocating.
 * Logged-in staff (Rachel) is preferred for demo call-to-station alerts.
 */
export function allocateStaffForStation(stationId: string, preferLoggedIn = true): string {
  if (preferLoggedIn) return RETAIL_STAFF.id;

  const n = stationId.split("-").pop() ?? "1";
  const idx = (parseInt(n, 10) || 1) % RETAIL_STAFF_ROSTER.length;
  // Prefer someone other than the logged-in officer for already-serving seeds
  const pick = RETAIL_STAFF_ROSTER[idx === 0 ? 1 : idx];
  return pick.id;
}
