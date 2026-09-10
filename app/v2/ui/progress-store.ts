"use client";

import { useSyncExternalStore } from "react";

import type { V2Progress } from "@/app/v2/ui/progress";

/**
 * The desktop sidebar lives in the /v2 layout, outside every screen, but the
 * current stage is known only by the screen's `V2Header`. This is the smallest
 * possible bridge: the header publishes, the sidebar subscribes.
 */
let current: V2Progress | null = null;
const listeners = new Set<() => void>();

export function setV2Progress(progress: V2Progress | null): void {
  if (
    current?.stage === progress?.stage &&
    current?.fraction === progress?.fraction
  ) {
    return;
  }
  current = progress;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => current;
const getServerSnapshot = () => null;

export function useV2Progress(): V2Progress | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
