"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Lead, LeadTags } from "@/lib/airconnect/types";
import {
  ELIGIBILITY_OPTIONS,
  EMPLOYMENT_OPTIONS,
  INCOME_DOC_OPTIONS,
  RESIDENCY_OPTIONS,
  formatOutstandingLabel,
  outstandingAmountLabel,
  selectedTagLabels,
  toggleExclusive,
  toggleIncomeDoc,
} from "@/lib/airconnect/tags";
import { useAirConnect } from "../airconnect-store";

const TRACK = "rounded-lg bg-slate-200 p-0.5 ring-1 ring-slate-300/80";
const SEGMENT_ON = "bg-white text-[var(--brand-blue-hex)] shadow-sm ring-1 ring-slate-200";
const SEGMENT_OFF = "text-slate-600 hover:bg-white/50 hover:text-slate-800";

function Category({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="min-w-0">
      <p className="mb-1 text-[9px] font-bold tracking-[0.14em] text-slate-500 uppercase">{label}</p>
      {children}
    </div>
  );
}

function SegmentTrack({ children }: { children: ReactNode }) {
  return <div className={`grid grid-cols-2 gap-0.5 ${TRACK}`}>{children}</div>;
}

function Segment({
  pressed,
  title,
  onClick,
  children,
}: {
  pressed: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className={[
        "h-7 rounded-md px-1 text-[10px] font-semibold tracking-tight transition-colors",
        pressed ? SEGMENT_ON : SEGMENT_OFF,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function DocTrack({ children }: { children: ReactNode }) {
  return <div className={`flex flex-wrap gap-0.5 ${TRACK}`}>{children}</div>;
}

function DocChip({
  pressed,
  title,
  onClick,
  children,
}: {
  pressed: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className={[
        "h-7 min-w-[2.75rem] flex-1 rounded-md px-1.5 text-[10px] font-semibold tracking-tight transition-colors",
        pressed ? SEGMENT_ON : SEGMENT_OFF,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function LeadTagsPicker({ lead, className }: { lead: Lead; className?: string }) {
  const { setLeadTags } = useAirConnect();
  const tags = lead.tags;
  const [amountDraft, setAmountDraft] = useState(outstandingAmountLabel(tags.outstanding));

  useEffect(() => {
    setAmountDraft(outstandingAmountLabel(lead.tags.outstanding));
  }, [lead.id, lead.tags.outstanding]);

  function patch(next: Partial<LeadTags>) {
    setLeadTags(lead.id, next);
  }

  function commitAmount(raw: string) {
    const label = formatOutstandingLabel(raw);
    setAmountDraft(label);
    patch({ outstanding: label ? { kind: "amount", label } : null });
  }

  const amountActive = tags.outstanding?.kind === "amount";

  return (
    <div className={["flex flex-col gap-2.5", className].filter(Boolean).join(" ")}>
      <Category label="Residency">
        <SegmentTrack>
          {RESIDENCY_OPTIONS.map((option) => (
            <Segment
              key={option.id}
              pressed={tags.residency === option.id}
              onClick={() => patch({ residency: toggleExclusive(tags.residency, option.id) })}
            >
              {option.label}
            </Segment>
          ))}
        </SegmentTrack>
      </Category>

      <Category label="Work">
        <SegmentTrack>
          {EMPLOYMENT_OPTIONS.map((option) => (
            <Segment
              key={option.id}
              pressed={tags.employment === option.id}
              onClick={() => patch({ employment: toggleExclusive(tags.employment, option.id) })}
            >
              {option.shortLabel ?? option.label}
            </Segment>
          ))}
        </SegmentTrack>
      </Category>

      <Category label="Docs">
        <DocTrack>
          {INCOME_DOC_OPTIONS.map((option) => (
            <DocChip
              key={option.id}
              title={option.title}
              pressed={tags.incomeDocs.includes(option.id)}
              onClick={() => patch({ incomeDocs: toggleIncomeDoc(tags.incomeDocs, option.id) })}
            >
              {option.shortLabel ?? option.label}
            </DocChip>
          ))}
        </DocTrack>
      </Category>

      <Category label="Outstanding">
        <SegmentTrack>
          <Segment
            pressed={tags.outstanding?.kind === "none"}
            onClick={() => {
              const next = tags.outstanding?.kind === "none" ? null : { kind: "none" as const };
              setAmountDraft("");
              patch({ outstanding: next });
            }}
          >
            No OS
          </Segment>
          <label className="relative">
            <span className="sr-only">Loan outstanding amount</span>
            <input
              value={amountDraft}
              onChange={(event) => {
                const value = event.target.value;
                setAmountDraft(value);
                const trimmed = value.trim();
                patch({ outstanding: trimmed ? { kind: "amount", label: trimmed } : null });
              }}
              onBlur={() => commitAmount(amountDraft)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  (event.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Amt"
              title="Loan outstanding amount"
              className={[
                "h-7 w-full rounded-md px-1 text-center text-[10px] font-semibold outline-none",
                amountActive ? SEGMENT_ON : SEGMENT_OFF,
                "placeholder:text-slate-400 focus:bg-white focus:text-[var(--brand-blue-hex)] focus:shadow-sm focus:ring-1 focus:ring-slate-200",
              ].join(" ")}
            />
          </label>
        </SegmentTrack>
      </Category>
    </div>
  );
}

function EligibilityColumn({
  title,
  options,
}: {
  title: string;
  options: typeof ELIGIBILITY_OPTIONS;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[9px] font-bold tracking-[0.14em] text-slate-500 uppercase">{title}</p>
      <div className="flex flex-col items-start gap-1">
        {options.map((option) => (
          <span
            key={option.id}
            className={[
              "inline-flex max-w-full rounded-md px-1.5 py-1 text-[10px] font-semibold leading-snug",
              option.className,
            ].join(" ")}
          >
            {option.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EligibilityDisplay({
  className,
  flush,
}: {
  className?: string;
  flush?: boolean;
}) {
  const ascend = ELIGIBILITY_OPTIONS.filter((option) => option.id.startsWith("ascend-"));
  const h5 = ELIGIBILITY_OPTIONS.filter((option) => option.id.startsWith("h5-"));

  return (
    <div className={["mt-2", className].filter(Boolean).join(" ")}>
      <div className={flush ? "bg-[var(--brand-blue-hex)] px-3 py-1" : "rounded-md bg-[var(--brand-blue-hex)] px-2 py-1"}>
        <p className="text-center text-[9px] font-bold tracking-[0.16em] text-white uppercase">Eligibility</p>
      </div>
      <div className={flush ? "grid grid-cols-2 gap-1.5 px-3 pt-2" : "mt-1.5 grid grid-cols-2 gap-3"}>
        <EligibilityColumn title="Ascend" options={ascend} />
        <div className="min-w-0 border-l border-[var(--border-subtle)] pl-1.5">
          <EligibilityColumn title="H5" options={h5} />
        </div>
      </div>
    </div>
  );
}

export function LeadTagSummary({ tags }: { tags: LeadTags }) {
  const labels = selectedTagLabels(tags);
  if (labels.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {labels.map((label) => (
        <span
          key={label}
          className="inline-flex h-5 items-center rounded-md bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
