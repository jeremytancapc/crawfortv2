"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApplyPath } from "@/app/use-apply-path";
import { afterReread, canRemoveOnResults, pendingNote, roomForMore } from "@/lib/income-add-more";
import { uploadWindowLabel } from "@/lib/income-periods";
import { incomeResultFrom, type ExtractResponse } from "@/lib/income-result";
import { improveLimitTips } from "@/lib/income-tips";
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
  /** Local key for the list; the server's id for the document is `documentId`. */
  id: string;
  name: string;
  size: string;
  /**
   * uploading  on its way to storage
   * ready      stored - it can be read, and it is what will be submitted
   * failed     did not reach storage; `error` says why
   *
   * A document is stored the moment it is added, and everything after - the
   * reading, the submission - works from that stored copy by id. The browser
   * never holds the only copy, and what was read can never differ from what
   * is kept.
   */
  status: "uploading" | "ready" | "failed";
  documentId?: string;
  error?: string;
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
export async function submitIncome(readingId: string | null): Promise<SubmitIncomeResult> {
  if (!readingId) {
    console.error("Income submission refused: nothing has been read");
    return { ok: false, message: "We have no income figures to send. Please add your documents again." };
  }

  try {
    // The figures and the files are the ones recorded when the documents were
    // read; the server takes only this id.
    const res = await fetch("/api/apply/income", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ readingId }),
    });

    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { error?: string } | null;
      console.error("Income submission failed", res.status, detail);
      return {
        ok: false,
        message:
          res.status === 409 && detail?.error
            ? detail.error
            : "We could not submit your income just now. Please try again in a moment.",
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
  /** Months with no document - counted as S$0 and shown as such. */
  const [missingMonths, setMissingMonths] = useState<Array<{ label: string; month: string; year: string }>>([]);
  /** What the documents were, in Ascend's words - set with the figures. */
  const [incomeType, setIncomeType] = useState("NON_PANEL_PAYSLIP");
  const [fileTypes, setFileTypes] = useState<string[]>([]);
  /** The server's record of what was read - the only thing submit needs. */
  const [readingId, setReadingId] = useState<string | null>(null);
  const removedWhileUploading = useRef(new Set<string>());
  /** Which months would confirm the figure, when fewer than three were read. */
  const [incomeAdvice, setIncomeAdvice] = useState<string | null>(null);
  const [extractionAsk, setExtractionAsk] = useState<string | null>(null);
  /**
   * Said beside the figures on the results page: why a document just added
   * did not count, or that some were left out. The figures themselves stay.
   */
  const [limitNote, setLimitNote] = useState<string | null>(null);
  const [readNote, setReadNote] = useState<string | null>(null);
  /** Documents added on the results page that are not yet read. */
  const [awaitingRead, setAwaitingRead] = useState<string[]>([]);
  /** The stored documents the figures on screen were read from. */
  const [countedIds, setCountedIds] = useState<string[]>([]);
  const uploadWindow = useMemo(() => uploadWindowLabel(), []);

  // Everything read off the documents describes the documents that were read.
  // Any change to them, or a failed re-read, drops it all together, so a
  // figure, an income type and a reading id can never describe different
  // sets of files.
  const clearReading = useCallback(() => {
    setIncomeMonths([]);
    setAverageIncome(0);
    setMissingMonths([]);
    setIncomeType("NON_PANEL_PAYSLIP");
    setFileTypes([]);
    setIncomeAdvice(null);
    setReadingId(null);
    setCountedIds([]);
  }, []);

  /** Asks the server to delete a stored document. Failures are logged there. */
  const deleteStored = useCallback((documentId: string) => {
    void fetch(`/api/apply/income/documents/${documentId}`, { method: "DELETE" }).catch((err) =>
      console.error("Could not delete a removed document", err),
    );
  }, []);

  const uploadOne = useCallback(
    async (localId: string, file: File) => {
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/apply/income/documents", { method: "POST", body: form });
        const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };

        if (!res.ok || !json.id) {
          setFiles((prev) =>
            prev.map((item) =>
              item.id === localId
                ? { ...item, status: "failed", error: json.error ?? "We could not save that file." }
                : item,
            ),
          );
          return;
        }

        // Removed while it was still uploading: it has just landed in
        // storage with nothing left to use it, so it goes straight back out.
        if (removedWhileUploading.current.delete(localId)) {
          deleteStored(json.id);
          return;
        }
        setFiles((prev) =>
          prev.map((item) =>
            item.id === localId ? { ...item, status: "ready", documentId: json.id } : item,
          ),
        );
      } catch (err) {
        console.error("Document upload failed", err);
        setFiles((prev) =>
          prev.map((item) =>
            item.id === localId
              ? { ...item, status: "failed", error: "We could not reach our servers. Please try again." }
              : item,
          ),
        );
      }
    },
    [deleteStored],
  );

  /**
   * Validates and stores the files. `keepReading` is for the results page,
   * where the figures stay on screen while the new documents are saved and
   * read; on the upload page any change to the documents drops the reading.
   * Returns the local ids it started uploading.
   */
  const stageFiles = useCallback(
    (incoming: FileList | File[], keepReading: boolean): string[] => {
      const accepted: Array<{ entry: SelectedFile; file: File }> = [];
      for (const file of Array.from(incoming)) {
        if (!ACCEPTED_TYPES.includes(file.type)) continue;
        if (file.size > MAX_FILE_SIZE) continue;
        accepted.push({
          file,
          entry: {
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            size: formatFileSize(file.size),
            status: "uploading",
          },
        });
      }
      if (!accepted.length) return [];

      if (!keepReading) clearReading();
      setFiles((prev) => [...prev, ...accepted.map((a) => a.entry)]);
      for (const { entry, file } of accepted) void uploadOne(entry.id, file);
      return accepted.map((a) => a.entry.id);
    },
    [clearReading, uploadOne],
  );

  const addFiles = useCallback((incoming: FileList | File[]) => void stageFiles(incoming, false), [stageFiles]);

  /**
   * Adding from the results page: the figures stay, the new documents are
   * saved and then read together with the old ones, and nothing is removed.
   * Files beyond the limit are left out and the applicant is told.
   */
  const addMoreFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      const { accept, message } = roomForMore(files.length, list.length);
      setLimitNote(message);
      if (accept === 0) return;
      const ids = stageFiles(list.slice(0, accept), true);
      if (ids.length) setAwaitingRead((prev) => [...prev, ...ids]);
    },
    [files.length, stageFiles],
  );

  // Saved, but the figures on screen were read without them. A file that
  // failed to save is not counted: it can never be read, so it is not "new".
  const unreadNew = files.filter((file) => awaitingRead.includes(file.id) && file.status === "ready").length;
  const addNote =
    [readNote, limitNote, pendingNote(unreadNew)].filter(Boolean).join(" ") || null;

  const removeFile = useCallback(
    (id: string) => {
      // Decided from the current list, not inside the state updater: React may
      // run an updater twice, and a request sent from one would go out twice.
      const target = files.find((file) => file.id === id);
      if (!target) return;
      clearReading();
      if (target.documentId) deleteStored(target.documentId);
      else if (target.status === "uploading") removedWhileUploading.current.add(id);
      setFiles((prev) => prev.filter((file) => file.id !== id));
    },
    [files, clearReading, deleteStored],
  );

  /**
   * Reads the stored documents. From the upload page a failure shows what is
   * missing; from the results page (`hadReading`) it leaves the earlier
   * figures standing and says why the new documents did not count.
   */
  const readDocuments = useCallback(() => {
    setIsProcessing(true);
    setIsReading(true);
    setExtractionAsk(null);
    setReadNote(null);
    // Whatever was added is read now, whether or not it turns out to count.
    setAwaitingRead([]);
    const hadReading = readingId !== null;

    // Reading runs while the processing sheet is up, and the sheet stays up
    // until it has finished. It used to close on its own 3-second timer: a
    // slower read left the results view up with nothing in it, reading "We
    // need a bit more" with an Add documents button, until the figures
    // landed and replaced it - a failure the applicant never actually had.
    void (async () => {
      try {
        const documentIds = files.flatMap((item) =>
          item.status === "ready" && item.documentId ? [item.documentId] : [],
        );
        const res = await fetch("/api/apply/income/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ documentIds }),
        });
        const response = (await res.json()) as ExtractResponse;
        const outcome = incomeResultFrom(response);
        const next = afterReread({ hadReading, readUsable: outcome.kind === "read" });

        if (outcome.kind === "read" && next === "replace") {
          setReadingId(response.readingId ?? null);
          setIncomeMonths(outcome.months);
          setAverageIncome(outcome.average);
          setMissingMonths(outcome.missing);
          setIncomeType(outcome.incomeType);
          setFileTypes(outcome.fileTypes);
          setIncomeAdvice(outcome.advice);
          setCountedIds(documentIds);
          return;
        }

        // Read, but not enough of it to put into a credit decision - or not
        // attempted at all. The ask names the payslip that would finish it.
        const ask = outcome.kind === "not_read" ? outcome.ask : null;
        if (next === "keep_previous") {
          setReadNote(ask ?? "We could not use the documents you just added.");
          return;
        }
        clearReading();
        setExtractionAsk(ask);
      } catch (err) {
        console.error("Income extraction failed", err);
        const message = "We could not read those documents just now. Please try uploading them again.";
        if (hadReading) {
          setReadNote(message);
        } else {
          clearReading();
          setExtractionAsk(message);
        }
      } finally {
        setIsReading(false);
      }
    })();
  }, [files, readingId, clearReading]);

  const startProcessing = readDocuments;

  /**
   * Removing from the results page, which keeps the figures: only a document
   * that did not count can go (see canRemoveOnResults), so nothing the figures
   * are read from changes. Without this a refused document stayed in the list
   * and was read again with everything added after it, so no later reading
   * could ever succeed.
   */
  const removeUnusedFile = useCallback(
    (id: string) => {
      const target = files.find((file) => file.id === id);
      if (!target || !canRemoveOnResults(target, new Set(countedIds))) return;
      if (target.documentId) deleteStored(target.documentId);
      else if (target.status === "uploading") removedWhileUploading.current.add(id);
      setFiles((prev) => prev.filter((file) => file.id !== id));
      setAwaitingRead((prev) => prev.filter((awaiting) => awaiting !== id));
      // The note was about this document.
      setReadNote(null);
      setLimitNote(null);
    },
    [files, countedIds, deleteStored],
  );

  const finishProcessing = useCallback(() => {
    setIsProcessing(false);
    // Already on the results page (documents added there): read again in
    // place, without stacking another history entry for Back to walk through.
    if (showResults) return;
    setShowResults(true);
    window.history.pushState({ view: "results" }, "", applyHref(RESULTS_PATH));
  }, [applyHref, showResults]);

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
    addMoreFiles,
    /** Why a document just added did not count, or that some were left out. */
    addNote,
    /** Ids of the stored documents the figures on screen were read from. */
    countedIds,
    /** Ids of documents added on the results page and not yet read. */
    pendingIds: awaitingRead,
    removeUnusedFile,
    /** Saved documents the figures on screen were not read from. */
    unreadNew,
    removeFile,
    isProcessing,
    isReading,
    startProcessing,
    finishProcessing,
    showResults,
    incomeMonths,
    /** The months that can be uploaded, e.g. "June to August, or July to September". */
    uploadWindow,
    averageIncome,
    missingMonths,
    submitIncome: () => submitIncome(readingId),
    /** True while any document is still on its way to storage. */
    isUploading: files.some((file) => file.status === "uploading"),
    /** True when at least one document is stored and can be read. */
    hasReadyFiles: files.some((file) => file.status === "ready"),
    incomeAdvice,
    /** How to strengthen the income just read. Empty when nothing would help. */
    improveTips: incomeMonths.length > 0 ? improveLimitTips(incomeType, fileTypes) : [],
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
