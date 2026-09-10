"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { File, X } from "@phosphor-icons/react";

import {
  ACCEPTED_TYPES,
  PROCESSING_STATUSES,
  useVerifyIncome,
} from "@/app/apply/verify-income/use-verify-income";
import { useApplyPath } from "@/app/use-apply-path";
import { Pill, Row, Rows } from "@/app/v2/ui/controls";
import { UploadIllustration } from "@/app/v2/ui/illustrations";
import { V2Body, V2Footer, V2Header, V2Illustration, V2Screen, V2Title } from "@/app/v2/ui/screen";
import { markApplyStepVisited, setResumeGateStep } from "@/lib/apply-step-nav";
import { formatCurrency } from "@/lib/loan-form";

export function VerifyIncomeScreen({
  initialShowResults = false,
}: {
  initialShowResults?: boolean;
}) {
  const router = useRouter();
  const applyHref = useApplyPath();
  const {
    files,
    addFiles,
    removeFile,
    isProcessing,
    startProcessing,
    finishProcessing,
    showResults,
    incomeMonths,
    uploadMonthNames,
    averageIncome,
    continueToReview,
  } = useVerifyIncome(initialShowResults);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    markApplyStepVisited("verify");
  }, []);

  const goBack = () => {
    setResumeGateStep(3);
    router.push(applyHref("/"));
  };

  if (showResults) {
    return (
      <V2Screen key="results">
        <V2Header onBack={goBack} progress={{ stage: "verify", fraction: 0.9 }} />
        <V2Body justify="center">
          <V2Title
            title="Your income, confirmed"
            subtitle="Read from the documents you uploaded."
          />
          <div className="v2-enter flex flex-col gap-1" style={{ ["--i" as string]: 1 }}>
            <span className="v2-label">Monthly average</span>
            <span className="v2-hero-num">{formatCurrency(averageIncome)}</span>
          </div>
          <Rows className="v2-enter">
            {incomeMonths.map((month) => (
              <Row
                key={month.label}
                label={`${month.month} ${month.year}`}
                value={formatCurrency(month.amount)}
              />
            ))}
          </Rows>
        </V2Body>
        <V2Footer note="Next, Singpass fills in your personal details.">
          <Pill onClick={continueToReview}>Continue</Pill>
        </V2Footer>
      </V2Screen>
    );
  }

  return (
    <V2Screen key="upload">
      <V2Header onBack={goBack} progress={{ stage: "verify", fraction: 0.4 }} />
      <V2Body justify="between">
        <V2Title
          title="Upload your last 3 payslips"
          subtitle={`${uploadMonthNames}. PDF, JPG or PNG.`}
        />

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
            if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
          }}
          className="v2-dropzone v2-enter flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed shadow-[0_1px_3px_oklch(0.2_0.02_260_/_0.06)] transition-colors"
          style={{
            ["--i" as string]: 1,
            borderColor: isDragOver ? "var(--v2-accent)" : "var(--v2-hairline)",
            background: isDragOver ? "var(--v2-accent-soft)" : "var(--v2-ill-paper)",
          }}
          aria-label="Add income documents"
        >
          <V2Illustration className="!animate-none">
            <UploadIllustration />
          </V2Illustration>
          <span className="text-[15px] font-semibold text-[var(--v2-ink)]">
            {files.length ? "Add another file" : "Tap to add files"}
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
          tabIndex={-1}
        />

        {files.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {files.slice(0, 4).map((file) => (
              <li
                key={file.id}
                className="flex max-w-full items-center gap-2 rounded-full bg-[var(--v2-surface)] py-1.5 pl-3 pr-1.5"
              >
                <File size={16} weight="fill" className="shrink-0 text-[var(--v2-accent)]" />
                <span className="max-w-[160px] truncate text-[13px] font-semibold text-[var(--v2-ink)]">
                  {file.name}
                </span>
                <span className="text-[12px] text-[var(--v2-ink-3)]">{file.size}</span>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  aria-label={`Remove ${file.name}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--v2-bg)] text-[var(--v2-ink-2)]"
                >
                  <X size={11} weight="bold" />
                </button>
              </li>
            ))}
            {files.length > 4 ? (
              <li className="flex items-center rounded-full bg-[var(--v2-surface)] px-3 text-[13px] font-semibold text-[var(--v2-ink-2)]">
                +{files.length - 4} more
              </li>
            ) : null}
          </ul>
        ) : null}
      </V2Body>
      <V2Footer note="Up to 10 MB each. Bank statements work if you're self-employed.">
        <Pill onClick={startProcessing} disabled={isProcessing} loading={isProcessing}>
          {isProcessing ? "Reading documents" : "Upload documents"}
        </Pill>
      </V2Footer>
      {isProcessing ? <ProcessingOverlay onComplete={finishProcessing} /> : null}
    </V2Screen>
  );
}

/** Same three-second simulated pass as production, rendered as a quiet sheet. */
function ProcessingOverlay({ onComplete }: { onComplete: () => void }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    const cycle = window.setInterval(() => {
      setStatusIndex((index) => Math.min(index + 1, PROCESSING_STATUSES.length - 1));
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

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-[var(--v2-bg)]/92 px-8 text-center backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--v2-hairline)] border-t-[var(--v2-accent)]" />
      <p className="v2-title !text-[22px]">Reading your documents</p>
      <p className="v2-sub !mt-0">{PROCESSING_STATUSES[statusIndex]}</p>
    </div>
  );
}
