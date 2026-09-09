/**
 * The six stages a customer sees in the /v2 header. Coarser than
 * `APPLY_PROGRESS` on purpose - the header bar is a glanceable "how much is
 * left", not a step counter.
 */
export const V2_STAGES = [
  "setup",
  "verify",
  "review",
  "offer",
  "accept",
  "book",
] as const;

export type V2Stage = (typeof V2_STAGES)[number];

export interface V2Progress {
  stage: V2Stage;
  /** 0-1 fill of the current stage's segment. Defaults to a started stage. */
  fraction?: number;
}

/** Per-segment fill (0-1) for the header bar. */
export function v2ProgressFills(progress: V2Progress): number[] {
  const index = V2_STAGES.indexOf(progress.stage);
  const fraction = Math.min(1, Math.max(0.15, progress.fraction ?? 0.15));
  return V2_STAGES.map((_, i) => {
    if (i < index) return 1;
    if (i === index) return fraction;
    return 0;
  });
}
