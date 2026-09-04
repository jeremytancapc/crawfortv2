import { SHOW_INCOME_STEP } from "@/lib/apply-progress";

export type ApplyStepId =
  | "amount"
  | "income"
  | "singpass"
  | "verify"
  | "review"
  | "pending"
  | "approval"
  | "customReceived"
  | "accept"
  | "book"
  | "booked";

const STORAGE_KEY = "crawfort-apply-visited";

export const APPLY_STEP_HREF: Record<ApplyStepId, string> = {
  amount: "/",
  income: "/",
  singpass: "/",
  verify: "/apply/verify-income",
  review: "/apply/review",
  pending: "/apply/pending",
  approval: "/apply/approval",
  customReceived: "/apply/custom-received",
  accept: "/apply/accept",
  book: "/apply/book",
  booked: "/apply/booked",
};

const GATE_STEP_KEY = "crawfort-apply-gate-step";
const GATE_RESUME_KEY = "crawfort-apply-gate-resume";

/** Linear apply path. Side branches (pending, custom offer) are handled separately. */
export function applyStepOrder(): ApplyStepId[] {
  return SHOW_INCOME_STEP
    ? ["amount", "income", "singpass", "verify", "review", "approval", "accept", "book", "booked"]
    : ["amount", "singpass", "verify", "review", "approval", "accept", "book", "booked"];
}

export function neighborApplySteps(id: ApplyStepId): {
  prev: ApplyStepId | null;
  next: ApplyStepId | null;
} {
  if (id === "pending") {
    return { prev: "review", next: "approval" };
  }
  if (id === "customReceived") {
    return { prev: "approval", next: "accept" };
  }
  if (id === "review") {
    const next: ApplyStepId = hasVisitedApplyStep("approval")
      ? "approval"
      : hasVisitedApplyStep("pending")
        ? "pending"
        : "approval";
    return { prev: "verify", next };
  }
  const order = applyStepOrder();
  const index = order.indexOf(id);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: index > 0 ? order[index - 1] : null,
    next: index < order.length - 1 ? order[index + 1] : null,
  };
}

export function persistGateStep(step: number): void {
  if (typeof window === "undefined") return;
  if (step !== 1 && step !== 2 && step !== 3) return;
  sessionStorage.setItem(GATE_STEP_KEY, String(step));
}

export function setResumeGateStep(step: number): void {
  if (typeof window === "undefined") return;
  if (step !== 1 && step !== 2 && step !== 3) return;
  sessionStorage.setItem(GATE_RESUME_KEY, String(step));
}

export function readPersistedGateStep(): number {
  if (typeof window === "undefined") return 1;
  try {
    const resume = sessionStorage.getItem(GATE_RESUME_KEY);
    if (resume) {
      sessionStorage.removeItem(GATE_RESUME_KEY);
      const step = Number(resume);
      if (step === 1 || step === 2 || step === 3) return step;
    }
    const last = Number(sessionStorage.getItem(GATE_STEP_KEY));
    if (last === 1 || last === 2 || last === 3) return last;
  } catch {
    /* ignore quota / private mode */
  }
  return 1;
}

export function gateStepForId(id: ApplyStepId): number | null {
  if (id === "amount") return 1;
  if (id === "income") return 2;
  if (id === "singpass") return 3;
  return null;
}

function readVisited(): Set<ApplyStepId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is ApplyStepId => typeof item === "string"));
  } catch {
    return new Set();
  }
}

export function markApplyStepVisited(id: ApplyStepId): void {
  if (typeof window === "undefined") return;
  const visited = readVisited();
  visited.add(id);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...visited]));
}

export function hasVisitedApplyStep(id: ApplyStepId): boolean {
  return readVisited().has(id);
}
