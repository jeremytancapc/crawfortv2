"use client";

import { useEffect, useRef, useState } from "react";
import { File, FileArrowUp, Info, X } from "@phosphor-icons/react";

import {
  Card,
  CardRow,
  MobileGateHeader,
  MobileGateSheet,
  PrimaryButton,
  SectionLabel,
  StickyFooter,
} from "@/app/apply-gate/ios-ui";
import { useApplyStepNav } from "@/app/apply-gate/use-apply-step-nav";
import { CircleLoader } from "@/components/ui/circle-loader";
import { formatCurrency } from "@/lib/loan-form";
import { APPLY_PROGRESS } from "@/lib/apply-progress";
import {
  ACCEPTED_TYPES,
  PROCESSING_STATUSES,
  useVerifyIncome,
} from "@/app/apply/verify-income/use-verify-income";

export function VerifyIncomeForm({
  initialShowResults = false,
}: {
  initialShowResults?: boolean;
}) {
  const {
    files,
    addFiles,
    removeFile,
    isProcessing,
    startProcessing: handleUpload,
    finishProcessing: handleProcessingDone,
    showResults,
    incomeMonths,
    uploadMonthNames,
    averageIncome,
    continueToReview,
  } = useVerifyIncome(initialShowResults);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const applyNav = useApplyStepNav("verify");

  const stepNav = {
    back: {
      ...applyNav.back,
      disabled: isProcessing || applyNav.back?.disabled,
    },
    next: {
      ...applyNav.next,
      disabled: isProcessing || applyNav.next?.disabled,
    },
  };

  return (
    <div className="theme-ios flex h-[100dvh] flex-col overflow-hidden lg:h-auto lg:min-h-[calc(100dvh-5rem)]">
      <MobileGateHeader progressStep={APPLY_PROGRESS.verifyOrIdentity} />
      <MobileGateSheet>
      <div className="shrink-0 px-5 pb-6 pt-7">
        <h1 className="ios-type-title">
          {showResults ? "Confirm your income" : "Upload your income proof"}
        </h1>
        <p className="ios-type-subtitle mt-1.5">
          {showResults
            ? "Check the last 3 months we read from your documents."
            : "Payslips, income statements and bank statements."}
        </p>
      </div>

      <div
        className={
          showResults
            ? "ios-apply-fit flex min-h-0 flex-1 flex-col justify-center px-5"
            : "flex-1 px-5 pb-8"
        }
      >
        {showResults ? (
          <div key="results" className="ios-income-fit w-full animate-fade-up">
            <section>
              <Card>
                {incomeMonths.map((month) => (
                  <CardRow key={month.label}>
                    <span className="min-w-0">
                      <span className="ios-income-fit-label block leading-tight text-[var(--text-primary)]">
                        {month.month} {month.year}
                      </span>
                      <span className="ios-income-fit-meta mt-0.5 block truncate text-[var(--text-secondary)]">
                        {month.employer}
                      </span>
                    </span>
                    <span className="ios-income-fit-label shrink-0 font-semibold tabular-nums text-[var(--text-primary)]">
                      {formatCurrency(month.amount)}
                    </span>
                  </CardRow>
                ))}
                <div className="ios-income-fit-avg flex items-center justify-between gap-3 bg-brand-teal/14 px-4">
                  <span className="ios-income-fit-avg-label font-semibold leading-tight text-[var(--brand-blue-hex)]">
                    Monthly average
                  </span>
                  <span className="ios-income-fit-avg-value font-bold tabular-nums leading-none text-[var(--brand-blue-hex)]">
                    {formatCurrency(averageIncome)}
                  </span>
                </div>
              </Card>
            </section>
          </div>
        ) : (
        <div className="animate-fade-up flex flex-col gap-6">
          <section>
            <div className="mb-2 flex items-center gap-0.5 px-1">
              <p className="text-[13px] font-semibold leading-none text-[var(--text-secondary)]">
                Upload documents ({uploadMonthNames})
              </p>
              <IncomeDocsHint />
            </div>
            <Card>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragOver(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragOver(false);
                  if (event.dataTransfer.files.length) {
                    addFiles(event.dataTransfer.files);
                  }
                }}
                className="flex w-full flex-col items-center gap-3 px-5 py-8 text-center transition-colors"
                style={{
                  background: isDragOver
                    ? "color-mix(in srgb, var(--accent) 6%, white)"
                    : undefined,
                }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-sunken)]">
                  <FileArrowUp
                    size={20}
                    weight="bold"
                    className="text-[var(--accent)]"
                  />
                </span>
                <span className="text-[17px] font-semibold text-[var(--text-primary)]">
                  Tap to add files
                </span>
                <span className="text-[13px] text-[var(--text-secondary)]">
                  PDF, JPG, or PNG · up to 10 MB each
                </span>
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(",")}
                onChange={(event) => {
                  if (event.target.files?.length) addFiles(event.target.files);
                  event.target.value = "";
                }}
                className="sr-only"
                aria-label="Upload income documents"
              />
            </Card>
          </section>

          {files.length > 0 && (
            <section>
              <SectionLabel>
                {files.length} {files.length === 1 ? "file" : "files"} added
              </SectionLabel>
              <Card>
                {files.map((file) => (
                  <CardRow key={file.id}>
                    <span className="flex min-w-0 items-center gap-3">
                      <File
                        size={20}
                        weight="fill"
                        className="shrink-0 text-[var(--accent)]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[17px] leading-tight text-[var(--text-primary)]">
                          {file.name}
                        </span>
                        <span className="mt-0.5 block text-[13px] text-[var(--text-secondary)]">
                          {file.size}
                        </span>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      aria-label={`Remove ${file.name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)]"
                    >
                      <X size={12} weight="bold" />
                    </button>
                  </CardRow>
                ))}
              </Card>
            </section>
          )}
        </div>
        )}
      </div>

      <StickyFooter nav={stepNav}>
        {showResults ? (
          <PrimaryButton onClick={continueToReview}>Review Application</PrimaryButton>
        ) : (
          <PrimaryButton onClick={handleUpload}>
            Upload documents
          </PrimaryButton>
        )}
      </StickyFooter>

      {isProcessing && (
        <ProcessingDocumentsModal onComplete={handleProcessingDone} />
      )}
      </MobileGateSheet>
    </div>
  );
}

const INCOME_DOC_HINTS = [
  "Payslips for full-time employees",
  "Monthly statements for PHV drivers",
  "Bank statements for all other employment types",
] as const;

function IncomeDocsHint() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const canHover =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover)").matches;

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex shrink-0 self-center"
      onMouseEnter={() => {
        if (canHover) setOpen(true);
      }}
      onMouseLeave={() => {
        if (canHover) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label="Accepted income documents"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors duration-150 hover:text-[var(--accent)]"
      >
        <Info size={18} weight="fill" />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-2 w-[min(18rem,100%)] rounded-[var(--radius-md)] bg-gray-900 px-3.5 py-3 text-left shadow-2xl"
        >
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[12px] leading-snug text-white">
            {INCOME_DOC_HINTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </span>
      ) : null}
    </span>
  );
}

function ProcessingDocumentsModal({ onComplete }: { onComplete: () => void }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const [domReady, setDomReady] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    setDomReady(true);
  }, []);

  useEffect(() => {
    const cycle = window.setInterval(() => {
      setStatusIndex((index) =>
        Math.min(index + 1, PROCESSING_STATUSES.length - 1),
      );
    }, 1000);
    const close = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onComplete();
    }, 3000);
    return () => {
      window.clearInterval(cycle);
      window.clearTimeout(close);
    };
  }, [onComplete]);

  if (!domReady) return null;

  return (
    <div
      className="theme-ios fixed inset-0 z-[200] flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="processing-docs-title"
    >
      <div className="absolute inset-0 bg-black/35" />
      <div className="relative w-full max-w-[360px] rounded-[20px] bg-[var(--surface-elevated)] px-6 pb-8 pt-8 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
        <div className="flex flex-col items-center text-center">
          <CircleLoader size={48} />
          <h2
            id="processing-docs-title"
            className="mt-5 text-[22px] font-bold leading-tight tracking-[-0.022em] text-[var(--text-primary)]"
          >
            Processing documents
          </h2>
          <p
            className="mt-1.5 min-h-[1.4em] text-[15px] leading-[1.4] text-[var(--text-secondary)]"
            aria-live="polite"
          >
            {PROCESSING_STATUSES[statusIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
