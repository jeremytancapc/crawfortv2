"use client";

import { useRouter } from "next/navigation";

import { StickyFooter } from "@/app/apply-gate/ios-ui";
import { useApplyPath } from "@/app/use-apply-path";

/**
 * Arrow-only footer for the bad-case staging pages (pending review / rejected
 * / existing customer). These are dead ends in production - nothing to
 * "continue" to - so there is no primary CTA, just the back/next arrows that
 * let staging walk the chain. `useApplyStepNav` doesn't fit: it keys off the
 * fixed `ApplyStepId` union and gates the next arrow on visited history,
 * neither of which applies to a linear demo sequence outside the funnel.
 */
export function BadCaseNav({
  back,
  next,
}: {
  /** Canonical apply path, e.g. "/apply/rejected". */
  back?: string;
  /** Canonical apply path, or a callback (e.g. the Singpass handoff). */
  next?: string | (() => void);
}) {
  const router = useRouter();
  const applyHref = useApplyPath();

  return (
    <StickyFooter
      nav={{
        back: back
          ? { onClick: () => router.push(applyHref(back)) }
          : undefined,
        next: next
          ? {
              onClick:
                typeof next === "function"
                  ? next
                  : () => router.push(applyHref(next)),
            }
          : undefined,
      }}
    />
  );
}
