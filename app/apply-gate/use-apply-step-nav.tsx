"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  APPLY_STEP_HREF,
  gateStepForId,
  hasVisitedApplyStep,
  markApplyStepVisited,
  neighborApplySteps,
  setResumeGateStep,
  type ApplyStepId,
} from "@/lib/apply-step-nav";
import { StickyFooter, type StepNavControls } from "@/app/apply-gate/ios-ui";

/**
 * Footer back/next for the apply funnel. Next stays blank until that page
 * has been opened at least once in this session.
 */
export function useApplyStepNav(
  id: ApplyStepId,
  overrides?: {
    onBack?: () => void;
    onNext?: () => void;
  },
): StepNavControls {
  const router = useRouter();
  const [{ prev, next, nextVisited }, setNeighbors] = useState(() => ({
    prev: null as ApplyStepId | null,
    next: null as ApplyStepId | null,
    nextVisited: false,
  }));

  useEffect(() => {
    markApplyStepVisited(id);
    const neighbors = neighborApplySteps(id);
    setNeighbors({
      ...neighbors,
      nextVisited: neighbors.next ? hasVisitedApplyStep(neighbors.next) : false,
    });
  }, [id]);

  return {
    back: prev
      ? {
          onClick:
            overrides?.onBack ??
            (() => {
              goToApplyStep(router, prev);
            }),
        }
      : { disabled: true },
    next:
      next && nextVisited
        ? {
            onClick:
              overrides?.onNext ??
              (() => {
                goToApplyStep(router, next);
              }),
          }
        : { disabled: true },
  };
}

function goToApplyStep(
  router: ReturnType<typeof useRouter>,
  id: ApplyStepId,
) {
  const gateStep = gateStepForId(id);
  if (gateStep != null) setResumeGateStep(gateStep);
  router.push(APPLY_STEP_HREF[id]);
}

/** Sticky footer with the apply back/next arrows. Use on pages that have no other CTA. */
export function ApplyStepNavFooter({
  id,
  children,
  banner,
}: {
  id: ApplyStepId;
  children?: ReactNode;
  banner?: ReactNode;
}) {
  const nav = useApplyStepNav(id);
  return (
    <StickyFooter nav={nav} banner={banner}>
      {children}
    </StickyFooter>
  );
}
