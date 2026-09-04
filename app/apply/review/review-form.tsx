"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
} from "@/app/apply-gate/ios-ui";
import { useApplyStepNav } from "@/app/apply-gate/use-apply-step-nav";
import { SidebarTrustFeatures } from "@/app/sidebar-trust-features";
import type { LoanFormData } from "@/lib/loan-form";
import { trackDisplayStep, trackEvent } from "@/lib/analytics";
import { postSubmitUrl } from "@/lib/post-submit-nav";
import { LoanLoadingScreen } from "@/app/loan-loading-screen";
import { APPLY_PROGRESS, APPLY_PROGRESS_TOTAL } from "@/lib/apply-progress";

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
    title: "Complete your application",
    subtitle: "Get your application status sent to you.",
  },
  6: {
    title: "Confirm extra details",
    subtitle: "Almost done. This helps us finalise your application.",
  },
  7: {
    title: "Complete your application",
    subtitle: "Get your application status sent to you.",
  },
  8: {
    title: "Confirm your info",
    subtitle: "Make sure everything looks right before you continue.",
  },
};

export function ReviewForm({ initialData }: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState<LoanFormData>(initialData);
  const [submitOverlay, setSubmitOverlay] = useState<{
    waitUntil: Promise<unknown>;
    key: number;
  } | null>(null);
  const submitNavRef = useRef<string | null>(null);
  const submitLeadIdRef = useRef<string | null>(null);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Singpass users skip identity (already filled); manual users start at 4.
  const firstStep = initialData.authMethod === "singpass" ? 8 : 4;
  const [history, setHistory] = useState<number[]>([firstStep]);
  const step = history[history.length - 1];

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
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  // history.length + 3 == displayStep (apply page covered steps 1-3).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    trackDisplayStep(history.length + 3);
  }, [history]);

  async function submitApplication() {
    if (submitOverlay) return;
    submitNavRef.current = null;
    submitLeadIdRef.current = null;
    const task = (async () => {
      const res = await fetch("/api/apply/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        console.error("Submit failed", await res.text());
        return;
      }
      const result = (await res.json()) as { isEligible: boolean; leadId?: string };
      submitNavRef.current = result.isEligible ? "/apply/approval" : "/apply/pending";
      submitLeadIdRef.current = typeof result.leadId === "string" ? result.leadId : null;
      if (result.isEligible) trackEvent("step_09_offer_presented");
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
    try {
      await fetch("/api/apply/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formData),
      });
    } catch {
      // Non-blocking - submit falls back to INSERT if draft failed.
    }
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
            const leadId = submitLeadIdRef.current;
            if (path) {
              router.push(postSubmitUrl(path, leadId));
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
            {stepMeta?.subtitle ?? "Make sure everything looks right before you continue."}
          </p>
        </div>
        <ApplyProgressPanel current={progressStep} total={APPLY_PROGRESS_TOTAL} />
        <SidebarTrustFeatures />
      </aside>

      <main className="flex flex-1 flex-col overflow-x-clip">
        <div className="flex flex-1 flex-col lg:justify-start lg:px-12 lg:py-10 xl:px-20">
          <div className="flex w-full flex-1 flex-col lg:mx-auto lg:max-w-[520px] lg:flex-none">
            <div className="theme-ios flex min-h-[100svh] flex-col lg:min-h-[calc(100dvh-5rem)]">
              <MobileGateHeader progressStep={progressStep} />
              <MobileGateSheet>
              {stepMeta && (
                <div className="shrink-0 px-5 pb-6 pt-7">
                  <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.022em] text-[var(--text-primary)]">
                    {stepMeta.title}
                  </h1>
                  <p className="mt-1.5 text-[17px] leading-[1.4] text-[var(--text-secondary)]">
                    {stepMeta.subtitle}
                  </p>
                </div>
              )}

              <div className="flex-1 px-5 pb-8">
                <div key={step} className="animate-fade-up">
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
