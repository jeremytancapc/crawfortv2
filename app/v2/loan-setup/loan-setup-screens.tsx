"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react";

import { TENURE_OPTIONS, URGENCY_OPTIONS, type UrgencyValue } from "@/app/loan-application-form";
import { useApplyPath } from "@/app/use-apply-path";
import { AmountInput, Pill, Row, Rows, Segmented, Stepper } from "@/app/v2/ui/controls";
import { SingpassIllustration } from "@/app/v2/ui/illustrations";
import { V2_STAGES, V2_STAGE_HREF } from "@/app/v2/ui/progress";
import { useV2VisitedStages } from "@/app/v2/ui/progress-store";
import { V2Body, V2Footer, V2Header, V2Illustration, V2Screen, V2Title } from "@/app/v2/ui/screen";
import { useClientValue } from "@/app/v2/ui/use-client-value";
import { trackDisplayStep } from "@/lib/analytics";
import { markApplyStepVisited, persistGateStep, readGateResumeStep } from "@/lib/apply-step-nav";
import {
  calculateMonthlyRepayment,
  formatCurrency,
  initialLoanFormData,
  type LoanFormData,
} from "@/lib/loan-form";

const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 100000;
const AMOUNT_STEP = 100;

const URGENCY_SHORT_LABELS: Record<UrgencyValue, string> = {
  today: "24 hours",
  this_week: "7 days",
  not_sure: "Flexible",
};

type GateStep = 1 | 3;

function nearestTenureIndex(tenure: number): number {
  let best = 0;
  for (let i = 1; i < TENURE_OPTIONS.length; i++) {
    if (Math.abs(TENURE_OPTIONS[i] - tenure) < Math.abs(TENURE_OPTIONS[best] - tenure)) {
      best = i;
    }
  }
  return best;
}

/**
 * The /v2 gate: one screen to size the loan, one to hand off to Singpass.
 * Shares session persistence with the production gate (`/api/apply/session`,
 * `persistGateStep`) so a customer can move between variants mid-flow.
 */
export function LoanSetupScreens({
  initialApplySession,
}: {
  initialApplySession?: Partial<LoanFormData> | null;
}) {
  const applyHref = useApplyPath();
  const router = useRouter();
  const visitedStages = useV2VisitedStages();
  // The furthest real stage (beyond this one) reached so far this session -
  // e.g. the customer clicked the logo, or backed all the way out, after
  // already getting to Review or further. `visitedStages` only survives
  // client-side navigation (not the Singpass hand-off's hard reload), so
  // this is naturally `null` whenever there is nowhere useful to jump back
  // to.
  const furthestAheadStage = useMemo(() => {
    for (let i = V2_STAGES.length - 1; i > 0; i--) {
      if (visitedStages.has(V2_STAGES[i])) return V2_STAGES[i];
    }
    return null;
  }, [visitedStages]);
  // A plain visit to `/v2` always opens on the amount screen. The Singpass
  // step is only re-entered via an explicit one-shot signal set right before
  // an in-app "back" from verify-income - never from a leftover last-known
  // step, or a page refresh would keep reopening wherever the customer last
  // scrolled to instead of the funnel's actual entry point.
  const resumedStep = useClientValue(() => readGateResumeStep() ?? 1, 1);
  const [stepOverride, setStep] = useState<GateStep | null>(null);
  const step: GateStep = stepOverride ?? (resumedStep === 3 ? 3 : 1);
  const [formData, setFormData] = useState<LoanFormData>(() => ({
    ...initialLoanFormData,
    ...(initialApplySession ?? {}),
  }));
  const [urgencyNeedsInput, setUrgencyNeedsInput] = useState(false);
  const [redirectPending, setRedirectPending] = useState(false);

  useEffect(() => {
    persistGateStep(step);
    markApplyStepVisited(step === 1 ? "amount" : "singpass");
    trackDisplayStep(step === 1 ? 1 : 2);
  }, [step]);

  const updateField = useCallback(
    <K extends keyof LoanFormData>(key: K, value: LoanFormData[K]) => {
      if (key === "urgency" && value) setUrgencyNeedsInput(false);
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const monthlyRepayment = useMemo(
    () => calculateMonthlyRepayment(formData.amount, formData.tenure),
    [formData.amount, formData.tenure],
  );
  const tenureIndex = useMemo(() => nearestTenureIndex(formData.tenure), [formData.tenure]);
  const tenure = TENURE_OPTIONS[tenureIndex];

  const urgencyOptions = useMemo(
    () =>
      URGENCY_OPTIONS.map(({ value }) => ({
        value,
        label: URGENCY_SHORT_LABELS[value],
      })),
    [],
  );

  const handleContinue = () => {
    if (formData.urgency === "") {
      setUrgencyNeedsInput(true);
      return;
    }
    if (formData.amount < MIN_AMOUNT || formData.tenure <= 0) return;
    setStep(3);
  };

  const leaveForSingpass = useCallback(async () => {
    setRedirectPending(true);
    try {
      const res = await fetch("/api/apply/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          formData: { ...formData, authMethod: "singpass" },
          gate: "apply",
          setApplyGate: false,
        }),
      });
      if (!res.ok) {
        setRedirectPending(false);
        return;
      }
      window.location.assign(applyHref("/apply/verify-income"));
    } catch {
      setRedirectPending(false);
    }
  }, [applyHref, formData]);

  if (step === 3) {
    return (
      <V2Screen key="singpass">
        <V2Header onBack={() => setStep(1)} progress={{ stage: "setup", fraction: 0.7 }} />
        <V2Body justify="center">
          <V2Illustration>
            <SingpassIllustration />
          </V2Illustration>
          <V2Title
            title="Retrieve your details with Singpass"
            subtitle="Under a minute. Used only for this application."
          />
          <p className="v2-note v2-enter" style={{ ["--i" as string]: 2 }}>
            {formatCurrency(formData.amount)} over {tenure} {tenure === 1 ? "month" : "months"}
            {" · "}approval rates of up to 90%
          </p>
        </V2Body>
        <V2Footer>
          <button
            type="button"
            onClick={() => void leaveForSingpass()}
            disabled={redirectPending}
            aria-label="Retrieve Myinfo with Singpass"
            className={
              redirectPending
                ? "v2-pill v2-pill-singpass"
                : "flex min-h-[var(--v2-cta-height)] w-full items-center justify-center transition-transform duration-150 active:scale-[0.98]"
            }
          >
            {redirectPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Please wait…
              </>
            ) : (
              <Image
                src="/images/singpass-myinfo-red.webp"
                alt="Retrieve Myinfo with Singpass"
                width={1272}
                height={192}
                className="h-12 w-auto max-w-full object-contain"
                sizes="(max-width: 520px) 100vw, 318px"
                priority
              />
            )}
          </button>
        </V2Footer>
      </V2Screen>
    );
  }

  return (
    <V2Screen key="setup">
      <V2Header
        onBack={() => router.back()}
        progress={{ stage: "setup", fraction: 0.3 }}
        // Two reasons a forward control might belong here: the customer
        // reached a screen further ahead this session and came back to the
        // start (via the logo, or backing all the way out) - jump them to
        // that furthest point. Otherwise, `stepOverride` is only ever set
        // to 1 by the Singpass screen's own back button, never on first
        // mount - so its presence alone means "return to Singpass" (mirrors
        // a browser's forward button lighting up only after you go back).
        right={
          furthestAheadStage ? (
            <Link
              href={applyHref(V2_STAGE_HREF[furthestAheadStage])}
              className="v2-icon-button"
              aria-label="Continue where you left off"
            >
              <CaretRight size={22} weight="bold" />
            </Link>
          ) : stepOverride === 1 ? (
            <button
              type="button"
              onClick={() => setStep(3)}
              className="v2-icon-button"
              aria-label="Forward to Singpass"
            >
              <CaretRight size={22} weight="bold" />
            </button>
          ) : undefined
        }
      />
      <V2Body justify="between">
        <V2Title title="How much do you need?" />

        <div className="v2-enter flex flex-col gap-2" style={{ ["--i" as string]: 1 }}>
          <AmountInput
            value={formData.amount}
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
            step={AMOUNT_STEP}
            onChange={(value) => updateField("amount", value)}
            ariaLabel="Loan amount"
            plusAtMax
          />
          <p className="text-[15px] text-[var(--v2-ink-2)]">
            About{" "}
            <span className="font-bold tabular-nums text-[var(--v2-ink)]">
              {formatCurrency(monthlyRepayment)}
            </span>{" "}
            a month over {tenure} {tenure === 1 ? "month" : "months"}
          </p>
        </div>

        <div className="v2-enter" style={{ ["--i" as string]: 2 }}>
          <Rows>
            <Row
              label="Loan term"
              action={
                <Stepper
                  value={`${tenure} ${tenure === 1 ? "month" : "months"}`}
                  onDecrement={() => updateField("tenure", TENURE_OPTIONS[tenureIndex - 1])}
                  onIncrement={() => updateField("tenure", TENURE_OPTIONS[tenureIndex + 1])}
                  canDecrement={tenureIndex > 0}
                  canIncrement={tenureIndex < TENURE_OPTIONS.length - 1}
                  decrementLabel="Shorter loan term"
                  incrementLabel="Longer loan term"
                />
              }
            />
          </Rows>
          <div className="flex flex-col gap-2 pt-4">
            <span className="v2-row-label">When do you need it?</span>
            <Segmented<UrgencyValue>
              options={urgencyOptions}
              value={formData.urgency as UrgencyValue | ""}
              onChange={(value) => updateField("urgency", value)}
              ariaLabel="When do you need the funds"
              invalid={urgencyNeedsInput}
            />
            {urgencyNeedsInput ? (
              <p className="text-[13px] font-semibold text-[var(--v2-danger)]" role="alert">
                Pick a payout time to continue.
              </p>
            ) : null}
          </div>
        </div>
      </V2Body>
      <V2Footer
        note={
          <>
            Estimate at 3.92% a month. Licensed moneylender, CF Money Pte. Ltd.{" "}
            <a href="https://crawfort.com/sg/terms/" target="_blank" rel="noopener noreferrer">
              Terms
            </a>
            {" · "}
            <a href="https://crawfort.com/sg/privacy/" target="_blank" rel="noopener noreferrer">
              Privacy
            </a>
          </>
        }
      >
        <Pill onClick={handleContinue}>Continue</Pill>
      </V2Footer>
    </V2Screen>
  );
}
