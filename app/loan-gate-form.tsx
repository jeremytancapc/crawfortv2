"use client";

import { useState, useCallback, useMemo, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import type { LoanFormData as FormData } from "@/lib/loan-form";
import {
  initialLoanFormData as initialFormData,
  calculateMonthlyRepayment,
  formatCurrency,
} from "@/lib/loan-form";
import { trackDisplayStep } from "@/lib/analytics";
import {
  Step2_SelfDeclaredIncome,
  Step3_SingpassGate,
} from "@/app/loan-application-form";
import { GateStepAmount } from "@/app/apply-gate/gate-step-amount";
import {
  MobileGateHeader,
  MobileGateSheet,
  PrimaryButton,
  StickyFooter,
} from "@/app/apply-gate/ios-ui";
import { useApplyStepNav } from "@/app/apply-gate/use-apply-step-nav";
import { APPLY_PROGRESS, SHOW_INCOME_STEP } from "@/lib/apply-progress";
import { persistGateStep, readPersistedGateStep } from "@/lib/apply-step-nav";

const GATE_LAST_STEP = 3;

const GATE_STEP_META: Record<number, { title: string; subtitle: string }> = {
  1: {
    title: "Choose your loan amount",
    subtitle: "The whole application takes just a few minutes.",
  },
  2: {
    title: "Confirm your monthly income",
    subtitle: "So we can check the loan fits your budget.",
  },
  3: {
    title: "Retrieve your details with Singpass",
    subtitle: "Get approved on the spot.",
  },
};

/**
 * Steps 1-3 only (loan, income, Singpass vs manual).
 * Manual and Singpass both continue on `/apply/review`.
 */
export function LoanGateForm({
  initialApplySession,
}: {
  initialApplySession?: Partial<FormData> | null;
}) {
  const router = useRouter();
  const [history, setHistory] = useState<number[]>([1]);
  const step = history[history.length - 1];

  useLayoutEffect(() => {
    const resumed = readPersistedGateStep();
    if (resumed !== 1) setHistory([resumed]);
  }, []);

  useEffect(() => {
    persistGateStep(step);
  }, [step]);

  const navigateTo = useCallback((next: number) => {
    setHistory((h) => [...h, next]);
  }, []);

  const [formData, setFormData] = useState<FormData>(() => ({
    ...initialFormData,
    ...(initialApplySession ?? {}),
  }));
  const [incomeHighWarningShown, setIncomeHighWarningShown] = useState(false);
  const [incomeConfirmed, setIncomeConfirmed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step3RedirectPending, setStep3RedirectPending] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const updateField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      if (key === "monthlyIncome") { setIncomeHighWarningShown(false); setIncomeConfirmed(false); }
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const monthlyRepayment = useMemo(
    () => calculateMonthlyRepayment(formData.amount, formData.tenure),
    [formData.amount, formData.tenure],
  );

  const canProceed = useMemo(() => {
    const incomeNum = parseInt(formData.monthlyIncome, 10);
    const hasDeclaredIncome =
      formData.monthlyIncome.trim() !== "" &&
      !Number.isNaN(incomeNum) &&
      incomeNum >= 200;

    switch (step) {
      case 1:
        return (
          formData.amount >= 1000 &&
          formData.tenure > 0 &&
          formData.urgency !== ""
        );
      case 2:
        return hasDeclaredIncome && incomeConfirmed;
      default:
        return false;
    }
  }, [step, formData, incomeConfirmed]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    trackDisplayStep(history.length);
  }, [history]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  const leaveAfterSavingGate = useCallback(
    async (
      destination: string,
      patch: Partial<FormData>,
      options?: { setApplyGate?: boolean },
    ) => {
      setStep3RedirectPending(true);
      try {
        const res = await fetch("/api/apply/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            formData: { ...formData, ...patch },
            gate: "apply",
            setApplyGate: options?.setApplyGate ?? true,
          }),
        });
        if (!res.ok) {
          setStep3RedirectPending(false);
          return;
        }
        window.location.assign(destination);
      } catch {
        setStep3RedirectPending(false);
      }
    },
    [formData],
  );

  const handleNext = useCallback(() => {
    if (step === 2) {
      const incomeNum = parseInt(formData.monthlyIncome, 10);
      if (!Number.isNaN(incomeNum) && incomeNum > 20000 && !incomeHighWarningShown) {
        setIncomeHighWarningShown(true);
        return;
      }
    }
    if (step < GATE_LAST_STEP) {
      const next = !SHOW_INCOME_STEP && step + 1 === 2 ? 3 : step + 1;
      navigateTo(next);
      scrollToTop();
    }
  }, [step, formData.monthlyIncome, incomeHighWarningShown, navigateTo, scrollToTop]);

  const stepMeta = GATE_STEP_META[step];
  const gateStepId = step === 1 ? "amount" : step === 2 ? "income" : "singpass";
  const applyNav = useApplyStepNav(gateStepId, {
    onBack: () => {
      if (step === 3) {
        navigateTo(SHOW_INCOME_STEP ? 2 : 1);
        scrollToTop();
        return;
      }
      if (step === 2) {
        navigateTo(1);
        scrollToTop();
      }
    },
    onNext: () => {
      if (step === 1) {
        navigateTo(SHOW_INCOME_STEP ? 2 : 3);
        scrollToTop();
        return;
      }
      if (step === 2) {
        navigateTo(3);
        scrollToTop();
        return;
      }
      if (step === 3) {
        router.push("/apply/verify-income");
      }
    },
  });
  const stepNav = {
    back: {
      ...applyNav.back,
      disabled: step3RedirectPending || applyNav.back?.disabled,
    },
    next: {
      ...applyNav.next,
      disabled: step3RedirectPending || applyNav.next?.disabled,
    },
  };
  const progressStep =
    step === 1
      ? APPLY_PROGRESS.amount
      : step === 2
        ? APPLY_PROGRESS.income
        : APPLY_PROGRESS.singpass;

  return (
    /* Carries its own theme scope so the variant landing pages (/foreigner,
       /vcsa-sg) render the same gate without adopting theme-ios wholesale. */
    <div className="theme-ios flex h-[100dvh] flex-col overflow-hidden lg:h-auto lg:min-h-[calc(100dvh-5rem)]">
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

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        <div key={step} className="animate-fade-up">
          {step === 1 && (
            <GateStepAmount formData={formData} updateField={updateField} />
          )}
          {step === 2 && (
            <Step2_SelfDeclaredIncome
              formData={formData}
              updateField={updateField}
              incomeHighWarningShown={incomeHighWarningShown}
              incomeConfirmed={incomeConfirmed}
              onIncomeConfirmedChange={setIncomeConfirmed}
            />
          )}
          {step === 3 && (
            <Step3_SingpassGate
              onSingpass={() => {
                void leaveAfterSavingGate("/apply/verify-income", { authMethod: "singpass" }, {
                  setApplyGate: false,
                });
              }}
              redirectPending={step3RedirectPending}
            />
          )}
        </div>
      </div>

      <StickyFooter
        nav={stepNav}
        banner={
          step === 3 ? undefined : (
            <div
              className="flex w-full items-center justify-center gap-1.5 px-5 py-2"
              style={{
                background: "color-mix(in srgb, var(--brand-teal-hex) 22%, transparent)",
                boxShadow: "inset 0 -1px 0 0 color-mix(in srgb, var(--brand-teal-hex) 28%, transparent)",
              }}
            >
              <span className="text-[13px] leading-none text-[var(--text-secondary)]">
                Est. monthly repayment
              </span>
              <span className="text-[13px] font-semibold leading-none tabular-nums text-[var(--text-primary)]">
                {formatCurrency(monthlyRepayment)}
              </span>
            </div>
          )
        }
      >
        {step === 3 ? undefined : (
          <>
            <PrimaryButton onClick={handleNext} disabled={mounted && !canProceed}>
              Continue
            </PrimaryButton>
            {step === 1 && formData.urgency === "" ? (
              <p className="mt-2 text-center text-[13px] leading-snug text-[var(--text-secondary)]">
                Select your preferred payout time above to continue
              </p>
            ) : null}
          </>
        )}
      </StickyFooter>
      </MobileGateSheet>
    </div>
  );
}
