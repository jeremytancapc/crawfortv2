"use client";

import { useSyncExternalStore } from "react";

import type { V2Progress, V2Stage } from "@/app/v2/ui/progress";

/**
 * The desktop sidebar lives in the /v2 layout, outside every screen, but the
 * current stage is known only by the screen's `V2Header`. This is the smallest
 * possible bridge: the header publishes, the sidebar subscribes.
 *
 * It also doubles as the sidebar's memory of "how far this session has
 * gotten": every stage a `V2Header` mounts with is stamped into `visited`
 * (a plain in-memory Set - client-side route changes keep this module alive,
 * a hard reload or `window.location` hop intentionally forgets it, same as
 * the gate's own resume logic). The rail uses that to decide which of its
 * steps are clickable: behind the current step, or ahead of it but already
 * reached once, e.g. the customer went back and now wants to go forward
 * again without redoing steps they already cleared.
 */
let current: V2Progress | null = null;
const visited = new Set<V2Stage>();
const listeners = new Set<() => void>();

export function setV2Progress(progress: V2Progress | null): void {
  const stageChanged = current?.stage !== progress?.stage;
  const fractionChanged = current?.fraction !== progress?.fraction;
  if (!stageChanged && !fractionChanged) return;

  current = progress;
  if (progress && !visited.has(progress.stage)) {
    visited.add(progress.stage);
    visitedSnapshotStale = true;
  }
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

/** Stable snapshot of `visited` for `useSyncExternalStore` - a fresh Set
 *  identity per mutation, memoised until the next one. */
let visitedSnapshot: ReadonlySet<V2Stage> = visited;
let visitedSnapshotStale = false;

const getVisitedSnapshot = (): ReadonlySet<V2Stage> => {
  if (visitedSnapshotStale) {
    visitedSnapshot = new Set(visited);
    visitedSnapshotStale = false;
  }
  return visitedSnapshot;
};
const EMPTY_VISITED: ReadonlySet<V2Stage> = new Set();
const getVisitedServerSnapshot = (): ReadonlySet<V2Stage> => EMPTY_VISITED;

export function useV2VisitedStages(): ReadonlySet<V2Stage> {
  return useSyncExternalStore(subscribe, getVisitedSnapshot, getVisitedServerSnapshot);
}
