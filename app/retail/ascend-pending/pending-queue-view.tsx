"use client";

import { useMemo, useState } from "react";
import {
  ArrowsClockwise,
  CheckCircle,
  Clock,
  FileArrowUp,
  Prohibit,
  Repeat,
  Sparkle,
  Warning,
} from "@phosphor-icons/react";

import {
  MOCK_PENDING,
  PENDING_REASON_LABELS,
  type AscendPendingApplication,
} from "./mock-pending";

/** Age of a submission in whole hours, for the "waiting" column. */
function waitingHours(submittedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(submittedAt).getTime()) / 3_600_000));
}

function formatWaiting(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function money(n: number): string {
  return `S$${n.toLocaleString()}`;
}

function shortRef(leadId: string): string {
  return `CFH5-${leadId.slice(-8).toUpperCase()}`;
}

/** Anything waiting beyond this is surfaced as breaching the review window. */
const SLA_HOURS = 24;

function ApplicationCard({ app }: { app: AscendPendingApplication }) {
  const hours = waitingHours(app.submittedAt);
  const breached = hours >= SLA_HOURS;

  // The constraint that actually held the offer down - staff need this to
  // explain the number, and it is not derivable from a single merged figure.
  const binding =
    app.mlcbMaxLoanAmount <= app.acardLimit ? "MLCB quantum" : "A-Card limit";

  return (
    <article className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5">
      {/* Identity row */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="ios-type-option text-[var(--text-primary)]">{app.fullName}</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                app.newCustomer
                  ? "bg-brand-blue/10 text-brand-blue"
                  : "bg-orange-500/10 text-[#e07b4a]"
              }`}
            >
              {app.newCustomer ? <Sparkle size={11} weight="fill" /> : <Repeat size={11} weight="bold" />}
              {app.newCustomer ? "New" : "Reloan"}
            </span>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            ****{app.nricLast4} · {app.mobile} · {shortRef(app.leadId)}
          </p>
        </div>

        <div
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            breached
              ? "bg-red-500/10 text-red-600"
              : "bg-[var(--surface-secondary)] text-[var(--text-tertiary)]"
          }`}
        >
          {breached ? <Warning size={13} weight="duotone" /> : <Clock size={13} weight="duotone" />}
          {formatWaiting(hours)}
        </div>
      </header>

      {/* Why Ascend held it */}
      <div className="flex gap-3 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] px-4 py-3">
        <Warning size={15} weight="duotone" className="mt-0.5 shrink-0 text-[#e07b4a]" />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
            {PENDING_REASON_LABELS[app.reason]}
          </p>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{app.riskMsg}</p>
        </div>
      </div>

      {/* The four amounts, never collapsed into one */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {[
          { label: "Asked for", value: money(app.desiredAmount), muted: true },
          { label: "A-Card limit", value: money(app.acardLimit), muted: false },
          { label: "MLCB quantum", value: money(app.mlcbMaxLoanAmount), muted: false },
          { label: "Our estimate", value: money(app.underwrittenCap), muted: true },
        ].map((cell) => (
          <div key={cell.label} className="flex flex-col gap-0.5">
            <dt className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              {cell.label}
            </dt>
            <dd
              className={`font-display text-base font-bold tracking-tight ${
                cell.muted ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
              }`}
            >
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-[var(--text-tertiary)]">
        Offer is bound by <span className="font-semibold text-[var(--text-secondary)]">{binding}</span>
        {" · "}Ascend order {app.orderId}
      </p>

      <div className="h-px bg-[var(--border-subtle)]" />

      {/* Resolutions. Each writes back to Ascend against the existing orderId -
          no action here creates a second application. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
        >
          <CheckCircle size={16} weight="duotone" />
          Approve at {money(Math.min(app.acardLimit, app.mlcbMaxLoanAmount))}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-all duration-200 hover:border-[var(--border-medium)] active:scale-[0.98]"
        >
          <FileArrowUp size={16} weight="duotone" />
          Request documents
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-tertiary)] transition-all duration-200 hover:border-[var(--border-medium)] active:scale-[0.98]"
        >
          <Prohibit size={16} weight="duotone" />
          Decline
        </button>
      </div>
    </article>
  );
}

export function AscendPendingQueueView() {
  const [showBreachedOnly, setShowBreachedOnly] = useState(false);

  const apps = useMemo(() => {
    const rows = [...MOCK_PENDING].sort(
      (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
    );
    return showBreachedOnly
      ? rows.filter((a) => waitingHours(a.submittedAt) >= SLA_HOURS)
      : rows;
  }, [showBreachedOnly]);

  const breachedCount = MOCK_PENDING.filter(
    (a) => waitingHours(a.submittedAt) >= SLA_HOURS,
  ).length;
  const reloanCount = MOCK_PENDING.filter((a) => !a.newCustomer).length;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8">
      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--border-medium)] px-4 py-2.5">
        <ArrowsClockwise size={14} weight="duotone" className="shrink-0 text-[var(--text-tertiary)]" />
        <p className="text-xs text-[var(--text-tertiary)]">
          Example screen with mock data — nothing here is wired to Ascend yet.
        </p>
      </div>

      <header className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
          Credit review
        </span>
        <h1 className="ios-type-title">Applications on hold</h1>
        <p className="ios-type-body text-[var(--text-secondary)]">
          Ascend returned <span className="font-semibold text-[var(--text-primary)]">PENDING</span>{" "}
          for these applications — it made no decision, so a credit officer resolves them. The
          applicant is waiting and has been told we will be in touch.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        {[
          { label: "On hold", value: MOCK_PENDING.length },
          { label: `Past ${SLA_HOURS}h`, value: breachedCount },
          { label: "Reloan", value: reloanCount },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex min-w-[104px] flex-col gap-0.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-3"
          >
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              {stat.label}
            </span>
            <span className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {stat.value}
            </span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setShowBreachedOnly((v) => !v)}
          className={`ml-auto self-end rounded-[var(--radius-md)] border px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
            showBreachedOnly
              ? "border-transparent bg-brand-blue text-white"
              : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-medium)]"
          }`}
        >
          {showBreachedOnly ? "Showing overdue" : "Show overdue only"}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {apps.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-5 py-8 text-center text-sm text-[var(--text-tertiary)]">
            Nothing overdue. Every application is inside the {SLA_HOURS}-hour window.
          </p>
        ) : (
          apps.map((app) => <ApplicationCard key={app.leadId} app={app} />)
        )}
      </div>
    </main>
  );
}
