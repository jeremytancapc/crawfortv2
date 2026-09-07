const STORAGE_KEY = "crawfort-withdraw-amount";

export const MIN_WITHDRAW_AMOUNT = 500;
export const WITHDRAW_STEP = 100;

/** Clamp to [min(500, max), max], snapped to $100. The true max is always
 *  reachable even when it is not a $100 boundary. */
export function clampWithdrawAmount(raw: number, max: number): number {
  const safeMax = Math.max(max, 0);
  const floor = Math.min(MIN_WITHDRAW_AMOUNT, safeMax);
  if (!Number.isFinite(raw)) return safeMax;
  if (raw >= safeMax) return safeMax;

  const lastStep = Math.floor(safeMax / WITHDRAW_STEP) * WITHDRAW_STEP;
  if (lastStep < safeMax && raw > lastStep) return safeMax;

  const snapped = Math.round(raw / WITHDRAW_STEP) * WITHDRAW_STEP;
  return Math.min(Math.max(snapped, floor), safeMax);
}

export function readStoredWithdrawAmount(max: number): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return Math.min(max, Math.max(500, Math.round(amount)));
  } catch {
    return null;
  }
}

export function storeWithdrawAmount(amount: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, String(amount));
  } catch {
    /* ignore quota / private mode */
  }
}

export function parseWithdrawAmountParam(
  raw: string | string[] | undefined,
  max: number,
): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const amount = parseInt(value, 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.min(max, Math.max(500, amount));
}
