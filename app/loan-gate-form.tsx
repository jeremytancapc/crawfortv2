"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
import { GateProgressNav, MobileGateHeader, MobileGateSheet, PrimaryButton, StickyFooter } from "@/app/apply-gate/ios-ui";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

const GATE_LAST_STEP = 3;
const GATE_TOTAL_STEPS = 8;
/** Flip to true to put the self-declared income step back between amount and Singpass. */
const SHOW_INCOME_STEP = false;

const GATE_STEP_META: Record<number, { title: string; subtitle: string }> = {
  1: {
    title: "Start with your loan amount",
    subtitle: "The whole application takes just a few minutes.",
  },
  2: {
    title: "What do you earn a month?",
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
  const [history, setHistory] = useState<number[]>([1]);
  const step = history[history.length - 1];

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
          formData.amount >= 500 &&
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

  const handleBack = useCallback(() => {
    window.history.back();
  }, []);

  const stepMeta = GATE_STEP_META[step];
  const canGoBack = !step3RedirectPending;
  const canGoForward = Boolean(canProceed) && step < GATE_LAST_STEP;
  const isFirstStep = step === 1;
  const showActionBar = step !== 3;

  return (
    /* Carries its own theme scope so the variant landing pages (/foreigner,
       /vcsa-sg) render the same gate without adopting theme-ios wholesale. */
    <div className="theme-ios flex min-h-[100svh] flex-col lg:min-h-[calc(100dvh-5rem)]">
      <MobileGateHeader />
      <MobileGateSheet>
      {!isFirstStep && (
        <GateProgressNav
          current={history.length}
          total={GATE_TOTAL_STEPS}
          leading={
            <button
              type="button"
              onClick={handleBack}
              disabled={!canGoBack}
              aria-label="Previous step"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
          }
          trailing={
            <button
              type="button"
              onClick={handleNext}
              disabled={mounted && !canGoForward}
              aria-label="Next step"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
            >
              <CaretRight size={16} weight="bold" />
            </button>
          }
        />
      )}

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

      {showActionBar && (
        <StickyFooter>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-[var(--text-secondary)]">
              Est. monthly repayment
            </span>
            <span className="text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">
              {formatCurrency(monthlyRepayment)}
            </span>
          </div>
          <PrimaryButton onClick={handleNext} disabled={mounted && !canProceed}>
            Continue
          </PrimaryButton>
        </StickyFooter>
      )}
      </MobileGateSheet>
    </div>
  );
}
