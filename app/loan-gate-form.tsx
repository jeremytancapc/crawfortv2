"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { LoanFormData as FormData } from "@/lib/loan-form";
import { initialLoanFormData as initialFormData, calculateMonthlyRepayment } from "@/lib/loan-form";
import { trackDisplayStep } from "@/lib/analytics";
import { APPLY_CONTINUE_PATH } from "@/lib/apply-flow-guard";
import {
  Step1_LoanDetails,
  Step2_SelfDeclaredIncome,
  Step3_SingpassGate,
} from "@/app/loan-application-form";
import { ArrowRight, ArrowLeft } from "@phosphor-icons/react";

const GATE_LAST_STEP = 3;
const GATE_TOTAL_STEPS = 8;

const GATE_STEP_META: Record<number, { title: string; subtitle: string }> = {
  1: {
    title: "How much do you need?",
    subtitle: "Your personalised limit is confirmed on the next step.",
  },
  2: {
    title: "What is your monthly income?",
    subtitle: "This helps us confirm the loan is within your budget.",
  },
  3: {
    title: "Get approved quicker",
    subtitle: "Verify with Singpass for higher approval rates and faster processing.",
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
  const bottomCtaRef = useRef<HTMLDivElement>(null);

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

  const continueManualAfterGate = useCallback(async () => {
    setStep3RedirectPending(true);
    try {
      const res = await fetch("/api/apply/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          formData: { ...formData, authMethod: "manual" },
          gate: "apply",
        }),
      });
      if (!res.ok) return;
      window.location.assign(APPLY_CONTINUE_PATH);
    } catch {
      // ignore
    } finally {
      setStep3RedirectPending(false);
    }
  }, [formData]);

  const handleNext = useCallback(() => {
    if (step === 2) {
      const incomeNum = parseInt(formData.monthlyIncome, 10);
      if (!Number.isNaN(incomeNum) && incomeNum > 20000 && !incomeHighWarningShown) {
        setIncomeHighWarningShown(true);
        return;
      }
    }
    if (step < GATE_LAST_STEP) {
      navigateTo(step + 1);
      scrollToTop();
    }
  }, [step, formData.monthlyIncome, incomeHighWarningShown, navigateTo, scrollToTop]);

  const handleBack = useCallback(() => {
    if (history.length > 1) {
      setHistory((h) => h.slice(0, -1));
      scrollToTop();
    }
  }, [history, scrollToTop]);

  const sliderPercentage = useMemo(() => {
    return ((formData.amount - 500) / (20000 - 500)) * 100;
  }, [formData.amount]);

  const scrollToBottomCta = useCallback(() => {
    bottomCtaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const stepMeta = GATE_STEP_META[step];

  return (
    <div>
      {/* Full-bleed blue hero band on mobile/tablet.
          Absolute w-screen layer guarantees edge-to-edge even if a parent
          ever re-constrains width; content stays in a centered 520px column. */}
      <div className="lg:hidden relative w-full">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2"
          style={{ background: "var(--hero-blue-hex)" }}
        />
        <div className="relative mx-auto w-full max-w-[520px] px-5 pt-5 pb-16 sm:px-8">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: GATE_TOTAL_STEPS }, (_, i) => {
              const s = i + 1;
              const filled = s <= history.length;
              const active = s === history.length;
              return (
                <span
                  key={s}
                  className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: active ? 22 : 8,
                    background: filled ? "#fff" : "rgba(255,255,255,0.3)",
                  }}
                />
              );
            })}
            <span className="ml-auto text-xs font-medium text-white/70 tabular-nums">
              {history.length} / {GATE_TOTAL_STEPS}
            </span>
          </div>

          {stepMeta && (
            <div className="mt-6">
              <h2 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-white">
                {stepMeta.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/75 max-w-[36ch]">
                {stepMeta.subtitle}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating white card - overlaps the band on mobile, plain card on desktop */}
      <div className="relative z-10 mx-auto w-full max-w-[520px] px-5 sm:px-8 lg:px-0">
        <div className="-mt-10 lg:mt-0 rounded-[28px] bg-[var(--surface-elevated)] p-5 sm:p-7 lg:p-8 shadow-[0_20px_40px_-24px_rgba(20,30,70,0.25),0_2px_10px_-2px_rgba(20,30,70,0.08)] lg:shadow-[0_1px_3px_rgba(16,24,64,0.06)] lg:border lg:border-[var(--border-subtle)]">
          <div key={step} className="animate-slide-in">
            {step === 1 && (
              <Step1_LoanDetails
                formData={formData}
                updateField={updateField}
                monthlyRepayment={monthlyRepayment}
                sliderPercentage={sliderPercentage}
                onUrgencySelect={scrollToBottomCta}
              />
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
                onBack={() => {
                  setStep3RedirectPending(false);
                  setHistory((h) => h.slice(0, -1));
                  scrollToTop();
                }}
                onSingpass={() => {
                  void leaveAfterSavingGate("/api/auth", { authMethod: "singpass" }, {
                    setApplyGate: false,
                  });
                }}
                onManual={() => {
                  void continueManualAfterGate();
                }}
                redirectPending={step3RedirectPending}
              />
            )}
          </div>

          {step !== 3 && (
            <div ref={bottomCtaRef} className="mt-8 flex items-center gap-3 relative z-20">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex h-14 items-center gap-2 rounded-full border border-[var(--border-subtle)] px-6 text-sm font-medium text-[var(--text-secondary)] transition-all duration-200 hover:border-[var(--border-medium)] hover:text-[var(--text-primary)] active:scale-[0.98]"
                >
                  <ArrowLeft size={16} weight="bold" />
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                disabled={mounted && !canProceed}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-brand-blue text-[15px] font-semibold text-[var(--text-on-brand)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                Continue
                <ArrowRight size={16} weight="bold" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
