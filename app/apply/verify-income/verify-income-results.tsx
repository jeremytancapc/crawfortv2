"use client";

import { useRef, useState } from "react";
import { CheckCircle, File, FileArrowUp } from "@phosphor-icons/react";

import { Card, CardRow, SectionLabel } from "@/app/apply-gate/ios-ui";
import { ACCEPTED_TYPES, type IncomeMonth, type SelectedFile } from "@/app/apply/verify-income/use-verify-income";
import { MAX_INCOME_FILES } from "@/lib/income-add-more";
import type { IncomeTip } from "@/lib/income-tips";
import { formatCurrency } from "@/lib/loan-form";

/**
 * Page two of the income step: what was read, how to strengthen it, and the
 * documents behind it.
 *
 * Documents can be added here but not removed. Adding is the whole of
 * "I have something that would help"; taking one away would change what the
 * figures above were read from, so that stays on the first page.
 */
export function VerifyIncomeResults({
  months,
  missingMonths,
  average,
  advice,
  tips,
  files,
  addNote,
  busy,
  onAdd,
}: {
  months: IncomeMonth[];
  missingMonths: Array<{ month: string; year: string }>;
  average: number;
  advice: string | null;
  tips: IncomeTip[];
  files: SelectedFile[];
  /** Why a document just added did not count, or that some were left out. */
  addNote: string | null;
  /** Saving or reading documents - adding more waits for it. */
  busy: boolean;
  onAdd: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const full = files.length >= MAX_INCOME_FILES;

  return (
    <div key="results" className="ios-income-fit w-full animate-fade-up">
      <section>
        <Card>
          {months.map((month) => (
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
          {missingMonths.map((month) => (
            <CardRow key={`missing-${month.month}-${month.year}`}>
              <span className="min-w-0">
                <span className="ios-income-fit-label block leading-tight text-[var(--text-secondary)]">
                  {month.month} {month.year}
                </span>
                <span className="ios-income-fit-meta mt-0.5 block truncate text-[var(--text-secondary)]">
                  No document - counts as $0
                </span>
              </span>
              <span className="ios-income-fit-label shrink-0 font-semibold tabular-nums text-[var(--text-secondary)]">
                {formatCurrency(0)}
              </span>
            </CardRow>
          ))}
          <div className="ios-income-fit-avg flex items-center justify-between gap-3 bg-brand-teal/14 px-4">
            <span className="ios-income-fit-avg-label font-semibold leading-tight text-[var(--brand-blue-hex)]">
              Monthly average (3 months)
            </span>
            <span className="ios-income-fit-avg-value font-bold tabular-nums leading-none text-[var(--brand-blue-hex)]">
              {formatCurrency(average)}
            </span>
          </div>
        </Card>

        {advice ? (
          <p className="mt-3 px-1 text-[13px] leading-snug text-[var(--text-secondary)]">{advice}</p>
        ) : null}

        {tips.length > 0 ? (
          <div className="mt-3">
            <SectionLabel>Want a higher limit?</SectionLabel>
            <Card>
              {tips.map((tip) => (
                <CardRow key={tip.title}>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold leading-tight text-[var(--text-primary)]">
                      {tip.title}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-[var(--text-secondary)]">
                      {tip.body}
                    </span>
                  </span>
                </CardRow>
              ))}
            </Card>
            <p className="mt-2 px-1 text-[13px] leading-snug text-[var(--text-secondary)]">
              Or carry on with what we have - you can submit now.
            </p>
          </div>
        ) : null}

        <div className="mt-3">
          <SectionLabel>Your documents</SectionLabel>
          <Card>
            {files.map((file) => (
              <CardRow key={file.id}>
                <span className="flex min-w-0 items-center gap-3">
                  <File size={20} weight="fill" className="shrink-0 text-[var(--accent)]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] leading-tight text-[var(--text-primary)]">
                      {file.name}
                    </span>
                    <span
                      className={`mt-0.5 block text-[13px] ${
                        file.status === "failed" ? "text-[var(--danger,#a92d3a)]" : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {file.status === "uploading"
                        ? "Saving…"
                        : file.status === "failed"
                          ? (file.error ?? "We could not save this file.")
                          : file.size}
                    </span>
                  </span>
                </span>
                {file.status === "ready" ? (
                  <CheckCircle size={20} weight="fill" className="shrink-0 text-[var(--accent)]" aria-label="Saved" />
                ) : null}
              </CardRow>
            ))}
            <button
              type="button"
              disabled={busy || full}
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
                if (!busy && !full && event.dataTransfer.files.length) onAdd(event.dataTransfer.files);
              }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors disabled:opacity-50"
              style={{
                background: isDragOver ? "color-mix(in srgb, var(--accent) 6%, white)" : undefined,
              }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunken)]">
                <FileArrowUp size={16} weight="bold" className="text-[var(--accent)]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight text-[var(--accent)]">
                  {full ? "Document limit reached" : "Add another document"}
                </span>
                <span className="mt-0.5 block text-[13px] text-[var(--text-secondary)]">
                  PDF, JPG, or PNG · up to 10 MB each
                </span>
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES.join(",")}
              onChange={(event) => {
                if (event.target.files?.length) onAdd(event.target.files);
                event.target.value = "";
              }}
              className="sr-only"
              aria-label="Add more income documents"
            />
          </Card>
          {addNote ? (
            <p role="status" className="mt-2 px-1 text-[13px] leading-snug text-[var(--text-secondary)]">
              {addNote}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
