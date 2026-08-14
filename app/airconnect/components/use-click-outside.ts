"use client";

import { useEffect, type RefObject } from "react";

/** Calls onOutside when a pointer-down event happens outside the given ref's element. */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active = true) {
  useEffect(() => {
    if (!active) return;

    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [ref, onOutside, active]);
}
