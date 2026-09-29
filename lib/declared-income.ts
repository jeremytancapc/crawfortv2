import { useSyncExternalStore } from "react";

/**
 * Income an applicant declared and signed for when they had no payslips or
 * bank statements. Kept in sessionStorage for now - nothing is sent to the
 * server yet, so it lasts as long as the browser tab.
 */
export type DeclaredIncome = {
  monthlyIncome: number;
  /** PNG data URL of the drawn signature. */
  signature: string;
  /** ISO timestamp of when the applicant signed. */
  signedAt: string;
};

const STORAGE_KEY = "crawfort-declared-income";
const CHANGE_EVENT = "crawfort-declared-income-change";

export const MAX_DECLARED_INCOME = 9_999_999;

function isDeclaredIncome(value: unknown): value is DeclaredIncome {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.monthlyIncome === "number" &&
    Number.isFinite(candidate.monthlyIncome) &&
    candidate.monthlyIncome > 0 &&
    typeof candidate.signature === "string" &&
    typeof candidate.signedAt === "string"
  );
}

// useSyncExternalStore needs a stable reference between reads, so parse only
// when the stored string actually changes.
let cachedRaw: string | null | undefined;
let cachedValue: DeclaredIncome | null = null;

export function readDeclaredIncome(): DeclaredIncome | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    /* private mode - behave as if nothing is saved */
  }
  if (raw === cachedRaw) return cachedValue;

  cachedRaw = raw;
  cachedValue = null;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isDeclaredIncome(parsed)) cachedValue = parsed;
    } catch {
      /* corrupt entry - ignore */
    }
  }
  return cachedValue;
}

export function saveDeclaredIncome(value: DeclaredIncome): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* quota / private mode - the in-memory flow still continues */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The saved declaration, or null on the server and before anything is saved. */
export function useDeclaredIncome(): DeclaredIncome | null {
  return useSyncExternalStore(subscribe, readDeclaredIncome, () => null);
}
