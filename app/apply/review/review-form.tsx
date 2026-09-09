"use client";

import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Step4_Identity,
  Step6_Contact,
  Step7_Additional,
  Step7_BankruptcyDeclaration,
  Step8_Review,
} from "@/app/loan-application-form";
import {
  ApplyProgressPanel,
  MobileGateHeader,
  MobileGateSheet,
  PrimaryButton,
  StickyFooter,
  resetApplySheetScroll,
} from "@/app/apply-gate/ios-ui";
import { useApplyStepNav } from "@/app/apply-gate/use-apply-step-nav";
import { SidebarTrustFeatures } from "@/app/sidebar-trust-features";
import type { LoanFormData } from "@/lib/loan-form";
import { trackDisplayStep } from "@/lib/analytics";
import { LoanLoadingScreen } from "@/app/loan-loading-screen";
import { saveReviewDraft, submitReview } from "@/app/apply/review/submit-review";
import { APPLY_PROGRESS, APPLY_PROGRESS_TOTAL } from "@/lib/apply-progress";
import { useApplyPath } from "@/app/use-apply-path";

interface Props {
  initialData: LoanFormData;
}

// Internal step numbers (same as original form)
// 4=Identity, 5=Contact, 6=Additional, 7=Bankruptcy (final step), 8=Review

const REVIEW_STEP_META: Record<number, { title: string; subtitle: string }> = {
  4: {
    title: "Confirm your identity",
    subtitle: "We need this to verify your identity and eligibility.",
  },
  5: {
    title: "Get instant updates",
    subtitle: "We'll WhatsApp you as soon as there's news.",
  },
  6: {
    title: "Confirm extra details",
    subtitle: "Almost done. This helps us finalise your application.",
  },
  7: {
    title: "Get instant updates",
    subtitle: "We'll WhatsApp you as soon as there's news.",
  },
  8: {
    title: "Confirm your info",
    subtitle: "Check your details.",
  },
};

export function ReviewForm({ initialData }: Props) {
  const router = useRouter();
  const applyHref = useApplyPath();
  const [formData, setFormData] = useState<LoanFormData>(initialData);
  const [submitOverlay, setSubmitOverlay] = useState<{
    waitUntil: Promise<unknown>;
    key: number;
  } | null>(null);
  const submitNavRef = useRef<string | null>(null);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Singpass users skip identity (already filled); manual users start at 4.
  const firstStep = initialData.authMethod === "singpass" ? 8 : 4;
  const [history, setHistory] = useState<number[]>([firstStep]);
  const step = history[history.length - 1];
  const sheetScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const updateField = useCallback(
    <K extends keyof LoanFormData>(key: K, value: LoanFormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const canProceed = useMemo(() => {
    switch (step) {
      case 4:
        return (
          formData.idType !== "" &&
          formData.fullName.trim().length > 1 &&
          /^[STFGM]\d{7}[A-Z]$/i.test(formData.nric.trim())
        );
      case 5:
        return (
          /^[89]\d{7}$/.test(formData.mobile.replace(/\s/g, "")) &&
          formData.bankruptcyDeclaration !== "" &&
          formData.bankruptcyDeclaration !== "active"
        );
      case 6:
        return true;
      case 7:
        return (
          /^[89]\d{7}$/.test(formData.mobile.replace(/\s/g, "")) &&
          formData.bankruptcyDeclaration !== "" &&
          formData.bankruptcyDeclaration !== "active"
        );
      case 8:
        return true;
      default:
        return false;
    }
  }, [step, formData]);

  const navigateTo = useCallback((next: number) => {
    setHistory((h) => [...h, next]);
  }, []);

  const scrollToTop = useCallback(() => {
    resetApplySheetScroll(sheetScrollRef.current);
  }, []);

  useLayoutEffect(() => {
    scrollToTop();
    const frame = requestAnimationFrame(() => {
      scrollToTop();
      requestAnimationFrame(scrollToTop);
    });
    return () => cancelAnimationFrame(frame);
  }, [step, scrollToTop]);

  // history.length + 3 == displayStep (apply page covered steps 1-3).
  useEffect(() => {
    trackDisplayStep(history.length + 3);
  }, [history]);

  async function submitApplication() {
    if (submitOverlay) return;
    submitNavRef.current = null;
    const task = (async () => {
      const result = await submitReview(formData);
      if (!result) return;
      submitNavRef.current = result.nextPath;
    })();

    void task.catch(() => {
      /* non-2xx handled inside task; this is for network / parse errors */
    });

    setSubmitOverlay({
      waitUntil: task.finally(() => {}),
      key: Date.now(),
    });
  }

  const handleNext = useCallback(() => {
    if (step === 4) { navigateTo(8); scrollToTop(); return; }
    navigateTo(step + 1);
    scrollToTop();
  }, [step, navigateTo, scrollToTop]);

  const handleBack = useCallback(() => {
    if (history.length > 1) {
      setHistory((h) => h.slice(0, -1));
      scrollToTop();
      return;
    }
    window.history.back();
  }, [history, scrollToTop]);

  // Step 8 (Review) "Yes, I confirm" → create partial lead then go to contact step.
  // The draft endpoint sets a draft_lead cookie server-side - no state update needed.
  const handleReviewConfirm = useCallback(async () => {
    await saveReviewDraft(formData);
    navigateTo(5);
    scrollToTop();
  }, [formData, navigateTo, scrollToTop]);

  // Progress: shared funnel scale (visit = 100%, never shown in-app).
  const progressStep =
    step === 4
      ? APPLY_PROGRESS.verifyOrIdentity
      : step === 8 || step === 6
        ? APPLY_PROGRESS.reviewInfo
        : APPLY_PROGRESS.completeApp;
  const stepMeta = REVIEW_STEP_META[step];

  const handlePrimary = () => {
    if (step === 8) {
      void handleReviewConfirm();
      return;
    }
    if (step === 5) {
      void submitApplication();
      return;
    }
    handleNext();
  };

  const primaryLabel =
    step === 8
      ? "Yes, I confirm"
      : step === 5
        ? submitOverlay
          ? "Submitting…"
          : "Submit Application"
        : "Continue";

  const stepNav = useApplyStepNav("review", {
    onBack: handleBack,
  });

  return (
    <div className="theme-ios flex min-h-[100dvh] flex-col bg-[var(--surface-primary)] lg:flex-row">
      {submitOverlay ? (
        <LoanLoadingScreen
          key={submitOverlay.key}
          waitUntil={submitOverlay.waitUntil}
          onComplete={() => {
            const path = submitNavRef.current;
            if (path) {
              router.push(applyHref(path));
            }
            setSubmitOverlay(null);
          }}
        />
      ) : null}

      <aside className="relative hidden overflow-hidden bg-[var(--accent)] p-12 lg:flex lg:w-[42%] lg:flex-col lg:justify-between xl:w-[38%] xl:p-16">
        <div className="relative z-10">
          <div className="mb-16">
            <Image
              src="/images/crawfort-white.png"
              alt="Crawfort"
              width={1261}
              height={155}
              className="h-6 w-auto"
              priority
            />
          </div>
          <p className="max-w-[420px] text-[44px] font-bold leading-[1.08] tracking-[-0.024em] text-white">
            {stepMeta?.title ?? "Confirm your info"}
          </p>
          <p className="mt-5 max-w-[380px] text-[17px] leading-[1.45] text-white/70">
            {stepMeta?.subtitle ?? "Check your details."}
          </p>
        </div>
        <ApplyProgressPanel current={progressStep} total={APPLY_PROGRESS_TOTAL} />
        <SidebarTrustFeatures />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <div className="flex min-w-0 flex-1 flex-col lg:justify-start lg:px-12 lg:py-10 xl:px-20">
          <div className="flex min-w-0 w-full flex-1 flex-col lg:mx-auto lg:max-w-[520px] lg:flex-none">
            <div className="theme-ios flex h-[100dvh] flex-col overflow-hidden lg:h-auto lg:min-h-[calc(100dvh-5rem)]">
              <MobileGateHeader progressStep={progressStep} />
              <MobileGateSheet>
              {stepMeta && (
                <div className="shrink-0 px-5 pb-6 pt-7">
                  <h1 className="ios-type-title">
                    {stepMeta.title}
                  </h1>
                  <p className="ios-type-subtitle mt-1.5">
                    {stepMeta.subtitle}
                  </p>
                </div>
              )}

              <div
                key={step}
                ref={sheetScrollRef}
                className="flex-1 px-5 pb-8"
              >
                <div className="animate-fade-up">
                  {step === 4 && (
                    <Step4_Identity formData={formData} updateField={updateField} />
                  )}
                  {step === 5 && (
                    <div className="flex flex-col gap-6">
                      <Step6_Contact formData={formData} updateField={updateField} />
                      <Step7_BankruptcyDeclaration
                        formData={formData}
                        updateField={updateField}
                      />
                    </div>
                  )}
                  {step === 6 && (
                    <Step7_Additional formData={formData} updateField={updateField} />
                  )}
                  {step === 7 && (
                    <div className="flex flex-col gap-6">
                      <Step6_Contact formData={formData} updateField={updateField} />
                      <Step7_BankruptcyDeclaration
                        formData={formData}
                        updateField={updateField}
                      />
                    </div>
                  )}
                  {step === 8 && (
                    <Step8_Review
                      formData={formData}
                      updateField={updateField}
                      onModalOpenChange={setIsLegalModalOpen}
                    />
                  )}
                </div>
              </div>

              <StickyFooter nav={stepNav}>
                <PrimaryButton
                  onClick={handlePrimary}
                  disabled={(mounted && !canProceed) || !!submitOverlay}
                >
                  {primaryLabel}
                </PrimaryButton>
              </StickyFooter>
              </MobileGateSheet>
            </div>
          </div>
        </div>

        <IosLegalFooter />
      </main>
    </div>
  );
}

function IosLegalFooter() {
  return (
    <footer className="ios-apply-gutter pb-10 pt-8 text-[13px] leading-[1.5] text-[var(--text-secondary)] lg:hidden">
      <p>
        CF Money Pte. Ltd. (UEN No. 201406595W) is a company incorporated under
        the laws of Singapore. Customers are advised to read the{" "}
        <a
          href="https://crawfort.com/sg/terms/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Terms and Conditions
        </a>{" "}
        and{" "}
        <a
          href="https://crawfort.com/sg/privacy/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Privacy Policy
        </a>{" "}
        carefully.
      </p>
    </footer>
  );
}
