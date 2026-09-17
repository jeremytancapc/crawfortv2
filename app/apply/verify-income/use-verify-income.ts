"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useApplyPath } from "@/app/use-apply-path";
import { nextPathAfterSubmit } from "@/lib/post-submit-nav";

export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const PROCESSING_STATUSES = [
  "Reading your income statements…",
  "Calculating your last 3 months' average…",
  "Almost done…",
];

/** Demo figures - the OCR pipeline is not wired up yet. */
const DUMMY_MONTHLY_INCOMES = [4280, 4150, 4200];
const DEMO_EMPLOYER = "Grab Holdings Limited";

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

export function lastThreeMonths(from: Date = new Date()): IncomeMonth[] {
  return lastThreeMonthDates(from)
    .reverse()
    .map((date, index) => ({
      label: date.toLocaleDateString("en-SG", { month: "long", year: "numeric" }),
      month: date.toLocaleDateString("en-SG", { month: "long" }),
      year: date.toLocaleDateString("en-SG", { year: "numeric" }),
      amount: DUMMY_MONTHLY_INCOMES[index],
      employer: DEMO_EMPLOYER,
    }));
}

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
): Promise<string | null> {
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
        return null;
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
      return null;
    }

    const result = (await res.json()) as { destination?: string };
    return nextPathAfterSubmit({ destination: result.destination, leadId: null });
  } catch (err) {
    console.error("Income submission failed", err);
    return null;
  }
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
  const [showResults, setShowResults] = useState(initialShowResults);

  const incomeMonths = useMemo(() => lastThreeMonths(), []);
  const uploadMonthNames = useMemo(() => lastThreeMonthNames(), []);
  const averageIncome = useMemo(
    () =>
      Math.round(
        incomeMonths.reduce((sum, month) => sum + month.amount, 0) / incomeMonths.length,
      ),
    [incomeMonths],
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
  }, []);

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
    startProcessing,
    finishProcessing,
    showResults,
    incomeMonths,
    uploadMonthNames,
    averageIncome,
    submitIncome,
  };
}
