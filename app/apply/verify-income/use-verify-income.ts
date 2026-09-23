"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useApplyPath } from "@/app/use-apply-path";
import { incomeResultFrom, type ExtractResponse } from "@/lib/income-result";
import { nextPathAfterSubmit } from "@/lib/post-submit-nav";

export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const PROCESSING_STATUSES = [
  "Reading your income statements…",
  "Calculating your last 3 months' average…",
  "Almost done…",
];

/** Shown while the documents go to Ascend and it re-scores the application. */
export const INCOME_SUBMIT_STATUSES = [
  "Sending your documents…",
  "Checking your income…",
  "Reviewing your application…",
  "Almost there…",
] as const;

export type SelectedFile = {
  id: string;
  name: string;
  size: string;
  /**
   * The file itself, kept so it can be uploaded. Previously only the name and
   * size survived selection and the document was discarded - which is why
   * income submission had nothing to send, and Ascend refused it with
   * `600: orderFile is required`.
   */
  file: File;
};

export interface IncomeMonth {
  label: string;
  month: string;
  year: string;
  amount: number;
  employer: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function lastThreeMonthDates(from: Date = new Date()): Date[] {
  return [3, 2, 1].map(
    (offset) => new Date(from.getFullYear(), from.getMonth() - offset, 1),
  );
}

export function lastThreeMonthNames(from: Date = new Date()): string {
  return lastThreeMonthDates(from)
    .map((date) => date.toLocaleDateString("en-SG", { month: "long" }))
    .join(", ");
}

export type SubmitIncomeResult =
  | { ok: true; nextPath: string }
  | { ok: false; message: string };

/**
 * Sends the extracted figures to Ascend, and follows wherever that lands.
 *
 * This used to hand off to Singpass, because the step ran before it. It now
 * runs after submit, reached only when Ascend answered PENDING - "There is no
 * income, please submit income" - so continuing means submitting that income
 * and letting Ascend re-score the order.
 *
 * A failure leaves the applicant here with a message rather than moving them
 * on: they have just uploaded documents, and silently landing them somewhere
 * else would look like the upload was lost.
 */
export async function submitIncome(
  months: IncomeMonth[],
  selected: SelectedFile[],
): Promise<SubmitIncomeResult> {
  if (months.length === 0) {
    console.error("Income submission refused: no months were read");
    return { ok: false, message: "We have no income figures to send. Please upload your payslips again." };
  }

  try {
    // Documents first: Ascend refuses income with nothing behind it
    // (`600: orderFile is required`), so a failed upload must stop here
    // rather than submit figures that will be rejected.
    const files: Array<{ fileType: string; fileName: string; fileUrl: string }> = [];
    for (const item of selected) {
      const form = new FormData();
      form.append("file", item.file);

      const upload = await fetch("/api/apply/income/upload", { method: "POST", body: form });
      if (!upload.ok) {
        console.error("Document upload failed", await upload.text());
        return {
          ok: false,
          message: `We could not send ${item.name}. Your documents are still here - please try again, or contact us if it keeps failing.`,
        };
      }

      const { fileUrl, fileName } = (await upload.json()) as { fileUrl: string; fileName: string };
      files.push({ fileType: "PANEL_PAYSLIP", fileName, fileUrl });
    }

    const res = await fetch("/api/apply/income", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        months: months.map((m) => ({ amount: m.amount })),
        incomeType: "PANEL_PAYSLIP",
        files,
      }),
    });

    if (!res.ok) {
      console.error("Income submission failed", await res.text());
      return {
        ok: false,
        message: "We could not submit your income just now. Please try again in a moment.",
      };
    }

    const result = (await res.json()) as { destination?: string; leadId?: string };
    return {
      ok: true,
      nextPath: nextPathAfterSubmit({ destination: result.destination, leadId: result.leadId ?? null }),
    };
  } catch (err) {
    console.error("Income submission failed", err);
    return {
      ok: false,
      message: "We could not reach our servers. Please check your connection and try again.",
    };
  }
}

/**
 * Hands off to Singpass; the callback lands on the review step.
 *
 * Used by the existing-customer screen at the end of the staging bad-case
 * chain. Kept as its own export rather than folded into the hook because that
 * screen is outside the funnel and holds none of its state.
 */
export function continueToReview() {
  window.location.assign("/api/auth");
}

const RESULTS_PATH = "/apply/verify-income?view=results";

function isResultsUrl(url = window.location.href): boolean {
  return new URL(url, window.location.origin).searchParams.get("view") === "results";
}

/**
 * State for the income-verification step: file selection, the simulated
 * processing pass, and the `?view=results` history entry that lets the
 * browser back button return to the upload view.
 */
export function useVerifyIncome(initialShowResults = false) {
  const applyHref = useApplyPath();
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  /** True while the documents are actually being read - the sheet waits on it. */
  const [isReading, setIsReading] = useState(false);
  const [showResults, setShowResults] = useState(initialShowResults);

  // Empty until the documents have actually been read. Nothing is seeded:
  // a figure on this screen means a figure off a payslip.
  const [incomeMonths, setIncomeMonths] = useState<IncomeMonth[]>([]);
  const [averageIncome, setAverageIncome] = useState(0);
  const [extractionAsk, setExtractionAsk] = useState<string | null>(null);
  const uploadMonthNames = useMemo(() => lastThreeMonthNames(), []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const next: SelectedFile[] = [];
    for (const file of Array.from(incoming)) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue;
      if (file.size > MAX_FILE_SIZE) continue;
      next.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: formatFileSize(file.size),
        file,
      });
    }
    if (next.length) setFiles((prev) => [...prev, ...next]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const startProcessing = useCallback(() => {
    setIsProcessing(true);
    setIsReading(true);
    setExtractionAsk(null);

    // Reading runs while the processing sheet is up, and the sheet stays up
    // until it has finished. It used to close on its own 3-second timer: a
    // slower read left the results view up with nothing in it, reading "We
    // need a bit more" with an Add documents button, until the figures
    // landed and replaced it - a failure the applicant never actually had.
    void (async () => {
      try {
        const body = new FormData();
        for (const item of files) body.append("files", item.file);

        const res = await fetch("/api/apply/income/extract", { method: "POST", body });
        const outcome = incomeResultFrom((await res.json()) as ExtractResponse);

        if (outcome.kind === "read") {
          setIncomeMonths(outcome.months);
          setAverageIncome(outcome.average);
          return;
        }

        // Read, but not enough of it to put into a credit decision - or not
        // attempted at all. The ask names the payslip that would finish it.
        setIncomeMonths([]);
        setAverageIncome(0);
        setExtractionAsk(outcome.ask);
      } catch (err) {
        console.error("Income extraction failed", err);
        setIncomeMonths([]);
        setAverageIncome(0);
        setExtractionAsk(
          "We could not read those documents just now. Please try uploading them again.",
        );
      } finally {
        setIsReading(false);
      }
    })();
  }, [files]);

  const finishProcessing = useCallback(() => {
    setIsProcessing(false);
    setShowResults(true);
    window.history.pushState({ view: "results" }, "", applyHref(RESULTS_PATH));
  }, [applyHref]);

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

  return {
    files,
    addFiles,
    removeFile,
    isProcessing,
    isReading,
    startProcessing,
    finishProcessing,
    showResults,
    incomeMonths,
    uploadMonthNames,
    averageIncome,
    submitIncome,
    /**
     * What to ask the applicant for, when the documents did not yield three
     * months. Null once they have. Exactly one of this and `incomeMonths` is
     * ever populated.
     */
    extractionAsk,
    /** False whenever there is nothing read to submit. */
    canSubmit: incomeMonths.length > 0,
  };
}
