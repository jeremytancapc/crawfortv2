"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  applyStepHref,
  gateStepForId,
  hasVisitedApplyStep,
  markApplyStepVisited,
  neighborApplySteps,
  setResumeGateStep,
  type ApplyStepId,
} from "@/lib/apply-step-nav";
import { StickyFooter, type StepNavControls } from "@/app/apply-gate/ios-ui";
import { useApplyVariant } from "@/app/use-apply-path";

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
  const variant = useApplyVariant();
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
              goToApplyStep(router, prev, variant);
            }),
        }
      : { disabled: true },
    next:
      next && nextVisited
        ? {
            onClick:
              overrides?.onNext ??
              (() => {
                goToApplyStep(router, next, variant);
              }),
          }
        : { disabled: true },
  };
}

function goToApplyStep(
  router: ReturnType<typeof useRouter>,
  id: ApplyStepId,
  variant: ReturnType<typeof useApplyVariant>,
) {
  const gateStep = gateStepForId(id);
  if (gateStep != null) setResumeGateStep(gateStep);
  router.push(applyStepHref(id, variant));
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
