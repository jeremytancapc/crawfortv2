"use client";

import { useRef, useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/**
 * Reads a browser-only value (sessionStorage etc.) once, hydration-safe: the
 * server and first client render see `serverValue`, then the real value is
 * used without an effect-driven setState.
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  const cache = useRef<{ value: T } | null>(null);
  return useSyncExternalStore(
    subscribeNoop,
    () => {
      if (cache.current === null) cache.current = { value: read() };
      return cache.current.value;
    },
    () => serverValue,
  );
}
