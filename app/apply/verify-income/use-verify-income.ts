"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useApplyPath } from "@/app/use-apply-path";
import {
  INCOME_DOC_STEP_COUNT,
  parseIncomeDocStep,
  parseIncomeSource,
  type IncomeDocStep,
  type IncomeSource,
} from "@/app/apply/verify-income/income-doc-steps";

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

const VERIFY_PATH = "/apply/verify-income";

/** Upload steps live at `?step=2|3` (step 1 is bare); results at `?view=results`. */
function verifyIncomeHref(
  view: { step: IncomeDocStep } | { results: IncomeSource },
): string {
  if ("results" in view) {
    return view.results === "declared"
      ? `${VERIFY_PATH}?view=results&source=declared`
      : `${VERIFY_PATH}?view=results`;
  }
  return view.step > 1 ? `${VERIFY_PATH}?step=${view.step}` : VERIFY_PATH;
}

function readUrlState(url = window.location.href) {
  const params = new URL(url, window.location.origin).searchParams;
  return {
    showResults: params.get("view") === "results",
    step: parseIncomeDocStep(params.get("step")),
    source: parseIncomeSource(params.get("source")),
  };
}

type FilesByStep = Record<IncomeDocStep, SelectedFile[]>;

const EMPTY_FILES: FilesByStep = { 1: [], 2: [], 3: [] };

/**
 * State for the income-verification step: which upload step is showing, its
 * file selection, the simulated processing pass, and the history entries
 * (`?step=`, `?view=results`) that let the browser back button walk back
 * through them.
 */
export function useVerifyIncome(
  initialShowResults = false,
  initialStep: IncomeDocStep = 1,
  initialSource: IncomeSource = "documents",
) {
  const applyHref = useApplyPath();
  const [docStep, setDocStep] = useState<IncomeDocStep>(initialStep);
  const [filesByStep, setFilesByStep] = useState<FilesByStep>(EMPTY_FILES);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(initialShowResults);
  const [resultsSource, setResultsSource] = useState<IncomeSource>(initialSource);

  const files = filesByStep[docStep];

  const incomeMonths = useMemo(() => lastThreeMonths(), []);
  const uploadMonthNames = useMemo(() => lastThreeMonthNames(), []);
  const averageIncome = useMemo(
    () =>
      Math.round(
        incomeMonths.reduce((sum, month) => sum + month.amount, 0) / incomeMonths.length,
      ),
    [incomeMonths],
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
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
      if (!next.length) return;
      setFilesByStep((prev) => ({ ...prev, [docStep]: [...prev[docStep], ...next] }));
    },
    [docStep],
  );

  const removeFile = useCallback(
    (id: string) => {
      setFilesByStep((prev) => ({
        ...prev,
        [docStep]: prev[docStep].filter((file) => file.id !== id),
      }));
    },
    [docStep],
  );

  const openResults = useCallback(
    (source: IncomeSource = "documents") => {
      setResultsSource(source);
      setShowResults(true);
      window.history.pushState(
        { view: "results", source },
        "",
        applyHref(verifyIncomeHref({ results: source })),
      );
    },
    [applyHref],
  );

  const goToDocStep = useCallback(
    (step: IncomeDocStep) => {
      setShowResults(false);
      setDocStep(step);
      window.history.pushState({ view: "upload", step }, "", applyHref(verifyIncomeHref({ step })));
    },
    [applyHref],
  );

  const startProcessing = useCallback(() => {
    setIsProcessing(true);
  }, []);

  const finishProcessing = useCallback(() => {
    setIsProcessing(false);
    openResults("documents");
  }, [openResults]);

  /** The signed self-declaration is in; carry on to Confirm your income. */
  const finishDeclaration = useCallback(() => {
    openResults("declared");
  }, [openResults]);

  /** Skips the current upload step: on to the next, or to results after the last. */
  const skipStep = useCallback(() => {
    if (docStep < INCOME_DOC_STEP_COUNT) {
      goToDocStep((docStep + 1) as IncomeDocStep);
      return;
    }
    openResults("documents");
  }, [docStep, goToDocStep, openResults]);

  /** One step back inside this page, or undefined on the first upload step. */
  const stepBack = useMemo(() => {
    // A declared income can only have come from the last step, even when the
    // results URL was opened directly and no step was remembered.
    if (showResults) {
      return () => goToDocStep(resultsSource === "declared" ? INCOME_DOC_STEP_COUNT : docStep);
    }
    if (docStep > 1) return () => goToDocStep((docStep - 1) as IncomeDocStep);
    return undefined;
  }, [showResults, resultsSource, docStep, goToDocStep]);

  useEffect(() => {
    const syncFromUrl = () => {
      const url = readUrlState();
      setIsProcessing(false);
      setShowResults(url.showResults);
      setResultsSource(url.source);
      // The results URL carries no step; keep the one the applicant came from.
      if (!url.showResults) setDocStep(url.step);
    };
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("pageshow", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("pageshow", syncFromUrl);
    };
  }, []);

  return {
    docStep,
    files,
    addFiles,
    removeFile,
    isProcessing,
    startProcessing,
    finishProcessing,
    finishDeclaration,
    skipStep,
    stepBack,
    showResults,
    resultsSource,
    incomeMonths,
    uploadMonthNames,
    averageIncome,
    continueToReview,
  };
}
