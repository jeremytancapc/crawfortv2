"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";

import {
  applyPath,
  variantFromPathname,
  type ApplyVariant,
} from "@/lib/apply-paths";

export function useApplyVariant(): ApplyVariant {
  const pathname = usePathname() ?? "/";
  return variantFromPathname(pathname);
}

/** Prefix a canonical apply path (`/` or `/apply/review`) for the current variant. */
export function useApplyPath() {
  const variant = useApplyVariant();
  return useCallback(
    (canonicalPath: string) => applyPath(variant, canonicalPath),
    [variant],
  );
}
