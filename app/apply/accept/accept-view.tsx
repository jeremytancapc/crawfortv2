"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  CaretDown,
  SealCheck,
  Warning,
  CurrencyCircleDollar,
} from "@phosphor-icons/react";

import { MobileHeader } from "@/app/mobile-header";
import { MobileLegalFooter } from "@/app/mobile-legal-footer";
import { SignaturePad } from "./signature-pad";
import type { SelectedPlanData } from "./page";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/** e.g. "22 December 2025 22:30" - matches the reference receipt's plain, formal timestamp. */
function formatReceiptDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getDate();
  const month = date.toLocaleString("en-SG", { month: "long" });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

/** Derives a stable, receipt-style reference number from the lead's UUID. */
function formatReferenceId(leadId: string): string {
  const alphanumeric = leadId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `ID${alphanumeric.slice(0, 9)}`;
}

// ── T&C content ───────────────────────────────────────────────────────────────

const DRAWDOWN_NOTICE =
  "Final drawdown of funds must be completed face to face at our office, as required by anti-money laundering (AML) and know-your-customer (KYC) regulations. If the loan is not drawn down within 3 business days, this loan agreement will be void and a re-application will be required. Every re-application may affect your subsequent approval.";

const DISBURSEMENT_NOTICE =
  "Funds are disbursed via PayNow on the spot at your appointment. Please ensure your PayNow is linked to your NRIC (we will PayNow using your linked NRIC instead of mobile number). Cash disbursement is strongly discouraged.";

const TC_ITEMS = [
  "This loan is granted by CF Money Pte Ltd, a licensed moneylender (Licence No. 86/2026) under the Moneylenders Act (Cap. 188).",
  "Repayment is in equal monthly instalments. Interest is charged at your agreed monthly rate on a reducing-balance basis.",
  "Late payments incur late interest (up to 4%/month) and a late fee of $60 per month. Repayments are applied to late charges first, then interest, then principal.",
  "If you default, the full outstanding balance becomes immediately payable and all recovery costs (including legal costs) are borne by you.",
  "No partial early redemption is allowed. Full early settlement may incur one month's interest at the moneylender's discretion.",
  "You authorise CF Money Pte Ltd to conduct credit checks and disclose your loan information to the Moneylenders Credit Bureau, Credit Bureau (Singapore), and related regulatory agencies.",
  "Additional loan amount and loan tenure requests in previous screen will be discussed with you physically during the loan assessment appointment at our office.",
];

const TC_CLOSING =
  "The full Note of Contract will be explained and signed at your appointment. You will receive a copy, together with your repayment schedule, before funds are disbursed.";

// ── Plan summary card ─────────────────────────────────────────────────────────

/** Hairline rule rendered as short dashes, echoing a printed receipt's tear-off perforation. */
function DashedDivider() {
  return (
    <div
      aria-hidden="true"
      className="h-px w-full shrink-0"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to right, var(--border-medium) 0, var(--border-medium) 5px, transparent 5px, transparent 11px)",
      }}
    />
  );
}

function ReceiptRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span
        className={emphasize ? "text-[13.5px] font-bold" : "text-[13.5px] font-medium"}
        style={{ color: emphasize ? "var(--text-primary)" : "var(--text-tertiary)" }}
      >
        {label}
      </span>
      <span
        className={
          emphasize
            ? "text-[15px] font-semibold tabular-nums text-right"
            : "text-[13.5px] font-semibold tabular-nums text-right"
        }
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

function PlanSummaryCard({
  plan,
  leadId,
  acceptedAt,
}: {
  plan: SelectedPlanData;
  leadId: string;
  acceptedAt: string;
}) {
  const referenceId = formatReferenceId(leadId);
  const dateTimeLabel = formatReceiptDateTime(acceptedAt);

  return (
    <div
      className="w-full rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        background: "var(--surface-elevated)",
        boxShadow:
          "0 0 0 1px var(--border-subtle), 0 8px 28px oklch(0.24 0.06 260 / 0.07)",
      }}
    >
      {/* Approval header - shown here on desktop only; mobile shows the
          equivalent heading in the blue hero band above this card. */}
      <div className="hidden lg:flex flex-col items-center gap-2.5 px-6 pt-9 pb-6 text-center">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "oklch(0.94 0.06 152)" }}
          aria-hidden="true"
        >
          <SealCheck size={28} weight="fill" style={{ color: "#16a34a" }} />
        </span>
        <h2 className="font-display text-xl font-semibold tracking-tight leading-snug" style={{ color: "var(--text-primary)" }}>
          Your Loan Is Approved
        </h2>
        <p
          className="text-[13px] leading-relaxed max-w-[300px]"
          style={{ color: "var(--text-secondary)" }}
        >
          Review your plan details and accept the terms below to proceed.
        </p>
      </div>

      <div className="px-5 pb-6 pt-5 lg:pt-0 flex flex-col gap-4">
        {/* Meta row */}
        <div
          className="flex items-center justify-between text-[12px] font-medium"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span>{dateTimeLabel}</span>
          <span className="font-semibold tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {referenceId}
          </span>
        </div>

        {/* Loan amount highlight */}
        <div
          className="flex items-center justify-between rounded-[var(--radius-sm)] px-4 py-3.5"
          style={{ background: "oklch(0.95 0.025 258)" }}
        >
          <span className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>
            Loan amount
          </span>
          <span className="font-display text-lg font-semibold tracking-tight tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatCurrency(plan.amount)}
          </span>
        </div>

        <DashedDivider />

        {/* Key-value breakdown */}
        <div className="flex flex-col gap-3">
          <ReceiptRow label="Plan" value={plan.planTitle} />
          <ReceiptRow
            label="Loan term"
            value={`${plan.tenure} ${plan.tenure === 1 ? "month" : "months"}`}
          />
          <ReceiptRow label="Monthly rate" value={`${formatRate(plan.monthlyRate)}/month`} />
          <ReceiptRow
            label="Total amount you'll pay"
            value={formatCurrency(plan.totalRepayment)}
          />
          {plan.additionalRequests.length > 0 && (
            <ReceiptRow
              label="Additional requests"
              value={plan.additionalRequests.join(", ")}
            />
          )}
          <ReceiptRow
            label="Monthly payment (fixed)"
            value={formatCurrency(plan.monthlyInstalment)}
            emphasize
          />
        </div>

        <DashedDivider />

        {/* Next steps */}
        <div className="flex flex-col gap-1.5">
          <span
            className="text-[11px] font-bold tracking-[0.12em] uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            Next steps
          </span>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Complete the acknowledgements and signature below, then book an
            appointment to collect your funds in person.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Terms section ─────────────────────────────────────────────────────────────

function TermsSection() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="w-full rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        background: "var(--surface-elevated)",
        boxShadow: "0 0 0 1px var(--border-subtle)",
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="loan-terms-content"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-5 py-4 text-left"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5"
          style={{ background: "oklch(0.32 0.14 260 / 0.08)" }}
        >
          <Warning size={16} weight="duotone" style={{ color: "var(--brand-blue-hex, #0033AA)" }} />
        </span>
        <span className="flex-1 flex flex-col gap-0.5">
          <span
            className="text-sm font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Loan acceptance terms
          </span>
          <span
            className="text-[12.5px] leading-snug"
            style={{ color: "var(--text-secondary)" }}
          >
            Fees, repayment and disbursement info
          </span>
        </span>
        <CaretDown
          size={16}
          weight="bold"
          className="mt-1.5 shrink-0"
          style={{
            color: "var(--text-tertiary)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        />
      </button>

      {open && (
        <div id="loan-terms-content" className="px-5 pb-4 flex flex-col gap-4">
          {/* Drawdown notice */}
          <div
            className="rounded-[var(--radius-sm)] px-3.5 py-3"
            style={{
              background: "oklch(0.97 0.03 85)",
              boxShadow: "0 0 0 1px oklch(0.88 0.06 85)",
            }}
          >
            <p
              className="text-[13px] leading-relaxed font-semibold"
              style={{ color: "#78350f" }}
            >
              {DRAWDOWN_NOTICE}
            </p>
          </div>

          {/* Contract digest */}
          <ul className="flex flex-col gap-3">
            {TC_ITEMS.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    background: "var(--surface-secondary)",
                    color: "var(--text-secondary)",
                  }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <p
                  className="text-[13px] leading-relaxed font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item}
                </p>
              </li>
            ))}
          </ul>

          {/* Closing note */}
          <p
            className="text-[13px] leading-relaxed font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {TC_CLOSING}
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
          </div>

          {/* Funds disbursement - callout */}
          <div
            className="rounded-[var(--radius-sm)] px-3.5 py-3.5 flex flex-col gap-2"
            style={{
              background: "oklch(0.96 0.04 190)",
              boxShadow: "0 0 0 1.5px oklch(0.78 0.16 178 / 0.45)",
            }}
          >
            <div className="flex items-center gap-2">
              <CurrencyCircleDollar size={15} weight="fill" style={{ color: "#0d9488" }} />
              <span
                className="text-[10px] font-bold tracking-[0.14em] uppercase"
                style={{ color: "#0f766e" }}
              >
                Funds disbursement method
              </span>
            </div>
            <p
              className="text-[13px] leading-relaxed font-semibold"
              style={{ color: "#115e59" }}
            >
              {DISBURSEMENT_NOTICE}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agree checkbox ────────────────────────────────────────────────────────────

function AgreeCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all duration-150"
        style={{
          border: checked ? "2px solid #16a34a" : "2px solid var(--border-medium)",
          background: checked ? "#16a34a" : "transparent",
        }}
      >
        {checked && (
          <svg width="11" height="8" viewBox="0 0 11 8" fill="none" aria-hidden="true">
            <path
              d="M1 4L4 7L10 1"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <span className="text-sm leading-snug" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
    </label>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface AcceptViewProps {
  plan: SelectedPlanData;
  leadId: string;
  /** ISO timestamp captured server-side so SSR and hydration render identical text. */
  acceptedAt: string;
}

export function AcceptView({ plan, leadId, acceptedAt }: AcceptViewProps) {
  const router = useRouter();
  const [checks, setChecks] = useState({
    readTerms: false,
    repaySchedule: false,
    paynowNric: false,
  });
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const allChecked = checks.readTerms && checks.repaySchedule && checks.paynowNric;
  const canProceed = allChecked && signatureDataUrl !== null;

  function toggleCheck(key: keyof typeof checks) {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="theme-fresh approval-theme flex flex-col lg:flex-row min-h-dvh bg-[var(--surface-primary)]">
      {/* Sidebar */}
      <aside
        className="hero-chrome relative hidden lg:flex lg:w-[42%] xl:w-[38%] flex-col justify-between overflow-hidden p-12 xl:p-16"
      >
        <div className="relative z-10">
          <div className="mb-16">
            <Image
              src="/images/crawfort-white.png"
              alt="Crawfort"
              width={151}
              height={20}
              className="h-6 w-auto"
              priority
            />
          </div>
          <h1 className="font-display text-4xl xl:text-5xl font-semibold leading-[1.1] tracking-tight text-[var(--text-on-brand)] max-w-[420px]">
            One last step.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[var(--text-on-brand)] opacity-75 max-w-[380px]">
            Review your selected plan and accept the loan terms to secure your
            funds.
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-col flex-1 overflow-x-clip">
        <MobileHeader />

        {/* Match home page: full-bleed blue hero on mobile + floating white card. */}
        <div className="flex flex-col items-center justify-start pb-8 flex-1 lg:justify-center lg:px-12 lg:pt-10 lg:pb-10 xl:px-20">
          <div className="flex w-full flex-col lg:max-w-[520px]">
            {/* Mobile/tablet blue hero band */}
            <div className="relative w-full lg:hidden">
              <div
                aria-hidden
                className="hero-chrome pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2"
              />
              <div className="relative mx-auto flex w-full max-w-[520px] flex-col items-center gap-2.5 px-5 pt-6 pb-16 text-center sm:px-8">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "rgba(255,255,255,0.16)" }}
                  aria-hidden="true"
                >
                  <SealCheck size={28} weight="fill" className="text-white" />
                </span>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
                  Your Loan Is Approved
                </h1>
                <p className="text-sm leading-relaxed text-white/75 max-w-[300px]">
                  Review your plan details and accept the terms below to proceed.
                </p>
              </div>
            </div>

            <div className="relative z-10 mx-auto -mt-10 flex w-full max-w-[520px] flex-1 flex-col gap-5 px-5 sm:px-8 lg:mt-0 lg:px-0">
              {/* Plan summary card - carries the page's heading and subtitle */}
              <PlanSummaryCard plan={plan} leadId={leadId} acceptedAt={acceptedAt} />

              {/* Terms */}
              <TermsSection />

              {/* Agree checkboxes */}
              <div className="flex flex-col gap-3">
                <AgreeCheckbox
                  checked={checks.readTerms}
                  onToggle={() => toggleCheck("readTerms")}
                  label="I have read the terms above and accept this offer"
                />
                <AgreeCheckbox
                  checked={checks.repaySchedule}
                  onToggle={() => toggleCheck("repaySchedule")}
                  label="I agree to repay as per the payment schedule stated above"
                />
                <AgreeCheckbox
                  checked={checks.paynowNric}
                  onToggle={() => toggleCheck("paynowNric")}
                  label="I acknowledge that my paynow is linked to my NRIC number to have the funds disbursed to me"
                />
              </div>

              {/* Signature — the closing act of the contract, unlocked once all boxes are ticked */}
              <SignaturePad
                disabled={!allChecked}
                onSigned={(dataUrl) => setSignatureDataUrl(dataUrl)}
                onCleared={() => setSignatureDataUrl(null)}
              />

              {/* CTA */}
              <button
                type="button"
                disabled={!canProceed}
                onClick={() => router.push("/apply/book")}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-blue text-[15px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                Next: Get your funds
                <ArrowRight size={16} weight="bold" />
              </button>

              {!canProceed && (
                <p
                  className="text-center text-[11px] -mt-2"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {allChecked
                    ? "Please sign above to continue."
                    : "Please tick all three acknowledgements and sign above to continue."}
                </p>
              )}
            </div>
          </div>
        </div>

        <MobileLegalFooter />
      </main>
    </div>
  );
}
