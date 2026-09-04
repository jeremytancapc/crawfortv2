"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * The gate keeps its step in client state, but the desktop sidebar that shows
 * progress is rendered by the page as a sibling. This lets the form publish the
 * step so the sidebar can follow along without lifting the whole layout into a
 * client component.
 */
let publishedStep: number | null = null;
const listeners = new Set<() => void>();

export function setApplyProgressStep(step: number | null): void {
  if (publishedStep === step) return;
  publishedStep = step;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `fallback` covers the server render and the paint before the form mounts. */
export function useApplyProgressStep(fallback: number): number {
  return useSyncExternalStore(
    subscribe,
    () => publishedStep ?? fallback,
    () => fallback,
  );
}

/** Publish the live step for the footer progress strip (and desktop sidebar). */
export function usePublishApplyProgress(step: number | null): void {
  useEffect(() => {
    setApplyProgressStep(step);
    return () => setApplyProgressStep(null);
  }, [step]);
}
