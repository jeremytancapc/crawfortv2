"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight, File, FileArrowUp, X } from "@phosphor-icons/react";

import {
  Card,
  CardRow,
  PrimaryButton,
  SectionLabel,
  StickyFooter,
} from "@/app/apply-gate/ios-ui";
import { CircleLoader } from "@/components/ui/circle-loader";
import { formatCurrency } from "@/lib/loan-form";

const GATE_TOTAL_STEPS = 8;
const VERIFY_STEP = 4;

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const PROCESSING_STATUSES = [
  "Reading your income statements…",
  "Calculating your last 3 months' average…",
  "Almost done…",
];

const DUMMY_MONTHLY_INCOMES = [4280, 4150, 4200];

type SelectedFile = {
  id: string;
  name: string;
  size: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function lastThreeMonths(from: Date = new Date()): { label: string; amount: number }[] {
  return DUMMY_MONTHLY_INCOMES.map((amount, index) => {
    const date = new Date(from.getFullYear(), from.getMonth() - (index + 1), 1);
    return {
      label: date.toLocaleDateString("en-SG", { month: "long", year: "numeric" }),
      amount,
    };
  });
}

function continueToReview() {
  window.location.assign("/api/auth");
}

const RESULTS_PATH = "/apply/verify-income?view=results";

function isResultsUrl(url = window.location.href): boolean {
  return new URL(url, window.location.origin).searchParams.get("view") === "results";
}

export function VerifyIncomeForm({
  initialShowResults = false,
}: {
  initialShowResults?: boolean;
}) {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(initialShowResults);
  const inputRef = useRef<HTMLInputElement>(null);
  const incomeMonths = lastThreeMonths();
  const averageIncome = Math.round(
    incomeMonths.reduce((sum, month) => sum + month.amount, 0) / incomeMonths.length,
  );

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const next: SelectedFile[] = [];
    for (const file of Array.from(incoming)) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue;
      if (file.size > MAX_FILE_SIZE) continue;
      next.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: formatFileSize(file.size),
      });
    }
    if (next.length) setFiles((prev) => [...prev, ...next]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const handleBack = useCallback(() => {
    window.history.back();
  }, []);

  const handleUpload = useCallback(() => {
    setIsProcessing(true);
  }, []);

  const handleProcessingDone = useCallback(() => {
    setIsProcessing(false);
    setShowResults(true);
    window.history.pushState({ view: "results" }, "", RESULTS_PATH);
  }, []);

  useEffect(() => {
    const syncFromUrl = () => {
      setIsProcessing(false);
      setShowResults(isResultsUrl());
    };
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("pageshow", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("pageshow", syncFromUrl);
    };
  }, []);

  const progressPercentage = (VERIFY_STEP / GATE_TOTAL_STEPS) * 100;

  return (
    <div className="theme-ios flex min-h-[100svh] flex-col lg:min-h-0">
      <header className="relative flex h-14 shrink-0 items-center justify-center px-5 lg:hidden">
        <Link href="/" className="flex h-11 items-center" aria-label="Crawfort home">
          <span className="flex h-8 items-center rounded-[10px] bg-[var(--accent)] px-3">
            <Image
              src="/images/crawfort-white.png"
              alt="Crawfort"
              width={1261}
              height={155}
              className="h-[15px] w-auto"
              priority
            />
          </span>
        </Link>
      </header>

      <div className="flex shrink-0 items-center gap-3 px-5">
        <button
          type="button"
          onClick={handleBack}
          disabled={isProcessing}
          aria-label="Previous step"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
        >
          <CaretLeft size={16} weight="bold" />
        </button>
        <div
          className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]"
          role="progressbar"
          aria-valuenow={VERIFY_STEP}
          aria-valuemin={1}
          aria-valuemax={GATE_TOTAL_STEPS}
          aria-label={`Step ${VERIFY_STEP} of ${GATE_TOTAL_STEPS}`}
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-400 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <button
          type="button"
          disabled
          aria-label="Next step"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:pointer-events-none disabled:opacity-30"
        >
          <CaretRight size={16} weight="bold" />
        </button>
      </div>

      <div className="shrink-0 px-5 pb-6 pt-7">
        <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.022em] text-[var(--text-primary)]">
          {showResults ? "Does this look right?" : "Let's verify your income"}
        </h1>
        <p className="mt-1.5 text-[17px] leading-[1.4] text-[var(--text-secondary)]">
          {showResults
            ? "Check the last 3 months we read from your documents."
            : "Upload your latest payslips or bank statements so we can confirm your offer."}
        </p>
      </div>

      <div className="flex-1 px-5 pb-8">
        {showResults ? (
          <div key="results" className="animate-fade-up flex flex-col gap-6">
            <section>
              <SectionLabel>Last 3 months</SectionLabel>
              <Card>
                {incomeMonths.map((month) => (
                  <CardRow key={month.label}>
                    <span className="text-[17px] leading-tight text-[var(--text-primary)]">
                      {month.label}
                    </span>
                    <span className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">
                      {formatCurrency(month.amount)}
                    </span>
                  </CardRow>
                ))}
                <CardRow>
                  <span className="text-[17px] leading-tight text-[var(--text-secondary)]">
                    Monthly average
                  </span>
                  <span className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatCurrency(averageIncome)}
                  </span>
                </CardRow>
              </Card>
            </section>
          </div>
        ) : (
        <div className="animate-fade-up flex flex-col gap-6">
          <section>
            <SectionLabel>Income documents</SectionLabel>
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

      <StickyFooter>
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
    </div>
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
