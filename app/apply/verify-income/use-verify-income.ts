"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useApplyPath } from "@/app/use-apply-path";

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

/** Hands off to Singpass; the callback lands on the review step. */
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
    continueToReview,
  };
}
