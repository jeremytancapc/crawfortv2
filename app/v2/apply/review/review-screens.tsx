"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  isValidNric,
  isValidSgMobile,
  saveReviewDraft,
  submitReview,
} from "@/app/apply/review/submit-review";
import { LoanLoadingScreen } from "@/app/loan-loading-screen";
import { useApplyPath } from "@/app/use-apply-path";
import { Pill, Row, Rows, Segmented, Tabs, TextField } from "@/app/v2/ui/controls";
import { IdentityIllustration } from "@/app/v2/ui/illustrations";
import { V2Body, V2Footer, V2Header, V2Illustration, V2Screen, V2Title } from "@/app/v2/ui/screen";
import { trackDisplayStep } from "@/lib/analytics";
import { SHOW_BANKRUPTCY_DECLARATION } from "@/lib/apply-progress";
import { markApplyStepVisited } from "@/lib/apply-step-nav";
import { buildDemoReviewMyInfo } from "@/lib/demo-review-myinfo";
import { formatCurrency, type LoanFormData } from "@/lib/loan-form";

const ID_TYPE_OPTIONS = [
  { value: "singaporean", label: "Singaporean" },
  { value: "pr", label: "PR" },
  { value: "foreigner", label: "Foreigner" },
] as const;

type IdType = (typeof ID_TYPE_OPTIONS)[number]["value"];

const MARITAL_OPTIONS = ["Single", "Married", "Divorced", "Widowed"] as const;
type Marital = (typeof MARITAL_OPTIONS)[number];

type Screen = "identity" | "income" | "contact";

function maskNric(nric: string): string {
  return nric ? `${nric.slice(0, 1)}****${nric.slice(-1)}` : "-";
}

function formatDob(dob: string): string {
  if (!dob) return "";
  return new Date(`${dob}T00:00:00`).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Review in two screens: who you are, then how to reach you. Singpass users
 * confirm retrieved details; manual users type them. Income data retrieved
 * via Singpass sits one tap away on its own screen rather than stacked below.
 */
export function ReviewScreens({ initialData }: { initialData: LoanFormData }) {
  const router = useRouter();
  const applyHref = useApplyPath();
  const isSingpass = initialData.authMethod === "singpass";

  const [formData, setFormData] = useState<LoanFormData>(() => ({
    ...initialData,
    bankruptcyDeclaration:
      !SHOW_BANKRUPTCY_DECLARATION && initialData.bankruptcyDeclaration === ""
        ? "clear"
        : initialData.bankruptcyDeclaration,
  }));
  const [screen, setScreen] = useState<Screen>("identity");
  const [touched, setTouched] = useState(false);
  const [submitOverlay, setSubmitOverlay] = useState<{
    waitUntil: Promise<unknown>;
    key: number;
  } | null>(null);
  const submitNavRef = useRef<string | null>(null);

  useEffect(() => {
    markApplyStepVisited("review");
  }, []);

  useEffect(() => {
    trackDisplayStep(screen === "contact" ? 5 : 4);
  }, [screen]);

  const updateField = useCallback(
    <K extends keyof LoanFormData>(key: K, value: LoanFormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const demo = useMemo(() => buildDemoReviewMyInfo(), []);
  const dob = formData.dob || (isSingpass ? demo.dob : "");
  const noaRecords = useMemo(() => {
    const rows = formData.noaHistory.length > 0 ? formData.noaHistory : demo.noaHistory;
    return [...rows].sort((a, b) => b.yearOfAssessment.localeCompare(a.yearOfAssessment));
  }, [formData.noaHistory, demo.noaHistory]);
  const cpfRecords = useMemo(() => {
    const rows =
      formData.cpfContributions.length > 0 ? formData.cpfContributions : demo.cpfContributions;
    return [...rows].sort((a, b) => {
      const byPaid = b.paidOn.localeCompare(a.paidOn);
      return byPaid !== 0 ? byPaid : b.month.localeCompare(a.month);
    });
  }, [formData.cpfContributions, demo.cpfContributions]);

  const identityValid =
    formData.idType !== "" &&
    formData.fullName.trim().length > 1 &&
    isValidNric(formData.nric);
  const contactValid =
    isValidSgMobile(formData.mobile) &&
    formData.bankruptcyDeclaration !== "" &&
    formData.bankruptcyDeclaration !== "active";

  const handleIdentityContinue = async () => {
    if (isSingpass) {
      await saveReviewDraft(formData);
    } else if (!identityValid) {
      setTouched(true);
      return;
    }
    setTouched(false);
    setScreen("contact");
  };

  const submitApplication = () => {
    if (submitOverlay) return;
    if (!contactValid) {
      setTouched(true);
      return;
    }
    submitNavRef.current = null;
    const task = (async () => {
      const result = await submitReview(formData);
      if (result) submitNavRef.current = result.nextPath;
    })();
    void task.catch(() => {});
    setSubmitOverlay({ waitUntil: task.finally(() => {}), key: Date.now() });
  };

  const overlay = submitOverlay ? (
    <LoanLoadingScreen
      key={submitOverlay.key}
      waitUntil={submitOverlay.waitUntil}
      onComplete={() => {
        const path = submitNavRef.current;
        if (path) router.push(applyHref(path));
        setSubmitOverlay(null);
      }}
    />
  ) : null;

  if (screen === "income") {
    return (
      <IncomeDataScreen
        noaRecords={noaRecords}
        cpfRecords={cpfRecords}
        onBack={() => setScreen("identity")}
      />
    );
  }

  if (screen === "contact") {
    return (
      <V2Screen key="contact">
        {overlay}
        <V2Header
          onBack={() => setScreen("identity")}
          progress={{ stage: "review", fraction: 0.8 }}
        />
        <V2Body justify="start">
          <V2Title
            title="How do we reach you?"
            subtitle="We'll WhatsApp you the moment there's news."
          />
          <div className="v2-enter flex flex-col pt-2" style={{ ["--i" as string]: 1 }}>
            <TextField
              label="Mobile"
              prefix="+65"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="9123 4567"
              value={formData.mobile}
              onChange={(event) => updateField("mobile", event.target.value.replace(/[^0-9 ]/g, ""))}
              invalid={touched && !isValidSgMobile(formData.mobile)}
              hint={
                touched && !isValidSgMobile(formData.mobile)
                  ? "Enter an 8-digit Singapore mobile number."
                  : undefined
              }
            />
            <TextField
              label="Email (optional)"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(event) => updateField("email", event.target.value)}
            />
          </div>
        </V2Body>
        <V2Footer
          note={
            <>
              By submitting you agree to our{" "}
              <a href="https://crawfort.com/sg/terms/" target="_blank" rel="noopener noreferrer">
                Terms
              </a>{" "}
              and{" "}
              <a href="https://crawfort.com/sg/privacy/" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              . Protected under Singapore&apos;s PDPA.
            </>
          }
        >
          <Pill onClick={submitApplication} loading={!!submitOverlay}>
            {submitOverlay ? "Submitting" : "Submit application"}
          </Pill>
        </V2Footer>
      </V2Screen>
    );
  }

  if (isSingpass) {
    return (
      <V2Screen key="identity-singpass">
        {overlay}
        <V2Header
          backHref={applyHref("/apply/verify-income")}
          progress={{ stage: "review", fraction: 0.4 }}
        />
        <V2Body justify="between">
          <V2Title title="Is this you?" subtitle="Retrieved from Singpass just now." />
          <div className="v2-enter" style={{ ["--i" as string]: 1 }}>
            <Rows>
              <Row label="Name" value={formData.fullName || "-"} />
              <Row label="NRIC / FIN" value={maskNric(formData.nric)} />
              {dob ? <Row label="Date of birth" value={formatDob(dob)} /> : null}
              {formData.address ? <Row label="Address" value={formData.address} wrap /> : null}
              <Row
                label="Marital status"
                action={
                  <select
                    value={
                      MARITAL_OPTIONS.includes(formData.maritalStatus as Marital)
                        ? formData.maritalStatus
                        : "Single"
                    }
                    onChange={(event) => updateField("maritalStatus", event.target.value)}
                    aria-label="Marital status"
                    className="v2-row-value appearance-none bg-transparent pr-4 outline-none"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%23636366' stroke-width='1.5' stroke-linecap='round'/></svg>\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right center",
                    }}
                  >
                    {MARITAL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                }
              />
            </Rows>
            {noaRecords.length > 0 || cpfRecords.length > 0 ? (
              <button
                type="button"
                onClick={() => setScreen("income")}
                className="v2-link mt-4 inline-flex min-h-11 items-center"
              >
                View income data from IRAS and CPF
              </button>
            ) : null}
          </div>
          <div aria-hidden="true" />
        </V2Body>
        <V2Footer>
          <Pill onClick={() => void handleIdentityContinue()}>Yes, that&apos;s me</Pill>
        </V2Footer>
      </V2Screen>
    );
  }

  return (
    <V2Screen key="identity-manual">
      {overlay}
      <V2Header
        backHref={applyHref("/apply/verify-income")}
        progress={{ stage: "review", fraction: 0.4 }}
      />
      <V2Body justify="start">
        <V2Title title="Tell us who you are" subtitle="Exactly as it appears on your NRIC." />
        <V2Illustration className="max-h-[14dvh]">
          <IdentityIllustration />
        </V2Illustration>
        <div className="v2-enter flex flex-col gap-2" style={{ ["--i" as string]: 1 }}>
          <Segmented<IdType>
            options={ID_TYPE_OPTIONS}
            value={formData.idType as IdType | ""}
            onChange={(value) => updateField("idType", value)}
            ariaLabel="Residency status"
            invalid={touched && formData.idType === ""}
          />
          <TextField
            label="Full name"
            autoComplete="name"
            placeholder="Tan Wei Ming"
            value={formData.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
            invalid={touched && formData.fullName.trim().length <= 1}
          />
          <TextField
            label="NRIC / FIN"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="S1234567D"
            value={formData.nric}
            onChange={(event) => updateField("nric", event.target.value.toUpperCase())}
            invalid={touched && !isValidNric(formData.nric)}
            hint={touched && !isValidNric(formData.nric) ? "Check the NRIC / FIN format." : undefined}
          />
        </div>
      </V2Body>
      <V2Footer>
        <Pill onClick={() => void handleIdentityContinue()}>Continue</Pill>
      </V2Footer>
    </V2Screen>
  );
}

const CPF_ROWS_SHOWN = 6;

function IncomeDataScreen({
  noaRecords,
  cpfRecords,
  onBack,
}: {
  noaRecords: LoanFormData["noaHistory"];
  cpfRecords: LoanFormData["cpfContributions"];
  onBack: () => void;
}) {
  type Tab = "noa" | "cpf";
  const tabs: { value: Tab; label: string }[] = [];
  if (noaRecords.length) tabs.push({ value: "noa", label: "Notice of Assessment" });
  if (cpfRecords.length) tabs.push({ value: "cpf", label: "CPF" });
  const [tab, setTab] = useState<Tab>(tabs[0]?.value ?? "noa");
  const shownCpf = cpfRecords.slice(0, CPF_ROWS_SHOWN);

  return (
    <V2Screen key="income">
      <V2Header onBack={onBack} progress={{ stage: "review", fraction: 0.5 }} />
      <V2Body>
        <V2Title
          title="Your income on record"
          subtitle="Retrieved via Singpass. Read-only."
        />
        {tabs.length > 1 ? (
          <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Income source" />
        ) : null}
        {tab === "noa" ? (
          <Rows className="v2-enter">
            <Row label={<span className="v2-label">Year</span>} value={<span className="v2-label">Assessable income</span>} className="!min-h-8 !py-1" />
            {noaRecords.slice(0, 4).map((rec) => (
              <Row
                key={rec.yearOfAssessment}
                label={
                  <span className="flex flex-col">
                    <span className="font-semibold text-[var(--v2-ink)]">YA {rec.yearOfAssessment}</span>
                    <span className="text-[12px] text-[var(--v2-ink-3)]">
                      {rec.taxClearance === "Y" ? `${rec.type} clearance` : rec.type}
                      {" · "}
                      {formatCurrency(Math.round((rec.employmentIncome + rec.tradeIncome) / 12))}/mo
                    </span>
                  </span>
                }
                value={formatCurrency(rec.assessableIncome)}
              />
            ))}
          </Rows>
        ) : (
          <div className="v2-enter flex flex-col gap-2">
            <Rows>
              <Row label={<span className="v2-label">Month · employer</span>} value={<span className="v2-label">Contribution</span>} className="!min-h-8 !py-1" />
              {shownCpf.map((c) => (
                <Row
                  key={`${c.paidOn}-${c.month}`}
                  label={
                    <span className="flex flex-col">
                      <span className="font-semibold text-[var(--v2-ink)]">{c.month}</span>
                      <span className="max-w-[180px] truncate text-[12px] text-[var(--v2-ink-3)]">
                        {c.employer || "-"}
                      </span>
                    </span>
                  }
                  value={formatCurrency(c.amount)}
                />
              ))}
            </Rows>
            {cpfRecords.length > shownCpf.length ? (
              <p className="v2-note">
                Latest {shownCpf.length} of {cpfRecords.length} months.
              </p>
            ) : null}
          </div>
        )}
      </V2Body>
      <V2Footer>
        <Pill variant="ghost" onClick={onBack}>
          Done
        </Pill>
      </V2Footer>
    </V2Screen>
  );
}
