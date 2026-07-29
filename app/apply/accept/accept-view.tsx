"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  SealCheck,
  CheckCircle,
  Warning,
  CurrencyCircleDollar,
} from "@phosphor-icons/react";

import { MobileHeader } from "@/app/mobile-header";
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

// ── T&C content ───────────────────────────────────────────────────────────────

const DRAWDOWN_NOTICE =
  "Final drawdown of funds must be completed face to face at our office, as required by anti-money laundering (AML) and know-your-customer (KYC) regulations. If the loan is not drawn down within 3 business days, this loan agreement will be void and a re-application will be required. Every re-application may affect your subsequent approval.";

const DISBURSEMENT_NOTICE =
  "Funds are disbursed via PayNow on the spot at your appointment. Please ensure your PayNow is linked to your NRIC (we will PayNow using your linked NRIC instead of mobile number). Cash disbursement is strongly discouraged.";

const TC_ITEMS = [
  "This loan is granted by CF Money Pte Ltd, a licensed moneylender (Licence No. 86/2025) under the Moneylenders Act (Cap. 188).",
  "Repayment is in equal monthly instalments. Interest is charged at your agreed monthly rate on a reducing-balance basis.",
  "Late payments incur late interest (up to 4%/month) and a late fee of $60 per month. Repayments are applied to late charges first, then interest, then principal.",
  "If you default, the full outstanding balance becomes immediately payable and all recovery costs (including legal costs) are borne by you.",
  "No partial early redemption is allowed. Full early settlement may incur one month's interest at the moneylender's discretion.",
  "You authorise CF Money Pte Ltd to conduct credit checks and disclose your loan information to the Moneylenders Credit Bureau, Credit Bureau (Singapore), and related regulatory agencies.",
];

const TC_CLOSING =
  "The full Note of Contract will be explained and signed at your appointment. You will receive a copy, together with your repayment schedule, before funds are disbursed.";

// ── Plan summary card ─────────────────────────────────────────────────────────

function PlanSummaryCard({ plan }: { plan: SelectedPlanData }) {
  return (
    <div
      className="relative w-full rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 20% 50%, oklch(0.34 0.18 262) 0%, transparent 70%), linear-gradient(145deg, oklch(0.28 0.16 262) 0%, oklch(0.22 0.16 258) 100%)",
        boxShadow:
          "0 0 0 2px #06DEC0, 0 16px 48px oklch(0.24 0.18 258 / 0.40), inset 0 1px 0 oklch(1 0 0 / 0.10)",
      }}
    >
      {/* Shine */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, transparent 35%, oklch(1 0 0 / 0.04) 50%, transparent 65%)",
        }}
      />

      <div className="relative px-5 pt-5 pb-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <SealCheck size={15} weight="fill" style={{ color: "#06DEC0" }} />
              <span
                className="text-[10px] font-bold tracking-[0.16em] uppercase"
                style={{ color: "oklch(1 0 0 / 0.50)" }}
              >
                Selected plan
              </span>
            </div>
            <span
              className="text-2xl font-extrabold leading-tight"
              style={{
                fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                color: "#ffffff",
                letterSpacing: "-0.03em",
              }}
            >
              {plan.planTitle}
            </span>
          </div>

          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5"
            style={{ background: "#06DEC0" }}
            aria-hidden="true"
          >
            <CheckCircle size={18} weight="fill" style={{ color: "#0a1628" }} />
          </span>
        </div>

        {/* Approved amount */}
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[10px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: "oklch(1 0 0 / 0.45)" }}
          >
            Approved loan amount
          </span>
          <span
            className="leading-none tabular-nums"
            style={{
              fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
              fontSize: "clamp(2rem, 9vw, 2.75rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "#ffffff",
            }}
          >
            {formatCurrency(plan.amount)}
          </span>
        </div>

        {/* Stats grid */}
        <div
          className="grid grid-cols-3 gap-3 rounded-[var(--radius-sm)] px-4 py-3"
          style={{ background: "oklch(1 0 0 / 0.07)" }}
        >
          {/* Monthly instalment */}
          <div className="flex flex-col gap-0.5">
            <span
              className="text-[9px] font-semibold tracking-[0.12em] uppercase"
              style={{ color: "oklch(1 0 0 / 0.50)" }}
            >
              Monthly
            </span>
            <span
              className="text-lg font-extrabold tabular-nums leading-none"
              style={{
                fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                color: "#06DEC0",
                letterSpacing: "-0.03em",
              }}
            >
              {formatCurrency(plan.monthlyInstalment)}
            </span>
          </div>

          {/* Tenure */}
          <div className="flex flex-col gap-0.5">
            <span
              className="text-[9px] font-semibold tracking-[0.12em] uppercase"
              style={{ color: "oklch(1 0 0 / 0.50)" }}
            >
              Tenure
            </span>
            <span
              className="text-lg font-extrabold tabular-nums leading-none"
              style={{
                fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                color: "#ffffff",
                letterSpacing: "-0.03em",
              }}
            >
              {plan.tenure} {plan.tenure === 1 ? "month" : "months"}
            </span>
          </div>

          {/* Interest paid */}
          <div className="flex flex-col gap-0.5">
            <span
              className="text-[9px] font-semibold tracking-[0.12em] uppercase"
              style={{ color: "oklch(1 0 0 / 0.50)" }}
            >
              Interest paid
            </span>
            <span
              className="text-lg font-extrabold tabular-nums leading-none"
              style={{
                fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                color: "#ffffff",
                letterSpacing: "-0.03em",
              }}
            >
              {formatCurrency(plan.totalInterest)}
            </span>
          </div>
        </div>

        {/* Rate / total caption */}
        <p
          className="text-[10px] -mt-2"
          style={{ color: "oklch(1 0 0 / 0.35)" }}
        >
          {formatRate(plan.monthlyRate)}/month · Total repayment{" "}
          {formatCurrency(plan.totalRepayment)}
        </p>
      </div>
    </div>
  );
}

// ── Terms section ─────────────────────────────────────────────────────────────

function TermsSection() {
  return (
    <div
      className="w-full rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        background: "var(--surface-elevated)",
        boxShadow: "0 0 0 1px var(--border-subtle)",
      }}
    >
      <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
        {/* Section header */}
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "oklch(0.32 0.14 260 / 0.08)" }}
          >
            <Warning size={14} weight="duotone" style={{ color: "var(--brand-blue-hex, #0033AA)" }} />
          </span>
          <span
            className="text-[10px] font-bold tracking-[0.16em] uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            Loan acceptance terms
          </span>
        </div>

        {/* Drawdown notice */}
        <div
          className="rounded-[var(--radius-sm)] px-3.5 py-3"
          style={{
            background: "oklch(0.97 0.03 85)",
            boxShadow: "0 0 0 1px oklch(0.88 0.06 85)",
          }}
        >
          <p
            className="text-[11px] leading-relaxed font-medium"
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
                  color: "var(--text-tertiary)",
                }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {item}
              </p>
            </li>
          ))}
        </ul>

        {/* Closing note */}
        <p
          className="text-[11px] leading-relaxed italic"
          style={{ color: "var(--text-tertiary)" }}
        >
          {TC_CLOSING}
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
        </div>

        {/* Funds disbursement — callout */}
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
            className="text-[12px] leading-relaxed font-semibold"
            style={{ color: "#115e59" }}
          >
            {DISBURSEMENT_NOTICE}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface AcceptViewProps {
  plan: SelectedPlanData;
}

export function AcceptView({ plan }: AcceptViewProps) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="approval-theme flex flex-col lg:flex-row min-h-dvh">
      {/* Sidebar */}
      <aside className="relative hidden lg:flex lg:w-[42%] xl:w-[38%] flex-col justify-between overflow-hidden bg-brand-blue p-12 xl:p-16">
        <div className="relative z-10">
          <div className="mb-16">
            <Image
              src="/images/cf-money-white.png"
              alt="CF Money"
              width={160}
              height={48}
              className="h-6 w-auto"
              priority
            />
          </div>
          <h1 className="font-display text-4xl xl:text-5xl font-extrabold leading-[1.08] tracking-[-0.04em] text-[var(--text-on-brand)] max-w-[420px]">
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

        <div className="flex flex-col items-center justify-start px-5 pb-8 pt-6 sm:px-8 flex-1 lg:justify-center lg:px-12 lg:pt-10 lg:pb-10 xl:px-20">
          <div className="w-full max-w-[520px] flex flex-col gap-5">
            {/* Page heading */}
            <div className="flex flex-col gap-1.5">
              <h2
                style={{
                  fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
                  fontSize: "clamp(1.35rem, 4.5vw, 1.75rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.1,
                  color: "var(--text-primary)",
                }}
              >
                Review &amp; accept your loan
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                Confirm your plan details and agree to the terms below.
              </p>
            </div>

            {/* Plan summary card */}
            <PlanSummaryCard plan={plan} />

            {/* Terms */}
            <TermsSection />

            {/* Agree checkbox */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <button
                type="button"
                role="checkbox"
                aria-checked={agreed}
                onClick={() => setAgreed((v) => !v)}
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all duration-150"
                style={{
                  border: agreed
                    ? "2px solid #06DEC0"
                    : "2px solid var(--border-medium)",
                  background: agreed ? "#06DEC0" : "transparent",
                }}
              >
                {agreed && (
                  <svg
                    width="11"
                    height="8"
                    viewBox="0 0 11 8"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 4L4 7L10 1"
                      stroke="#0a1628"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <span
                className="text-sm leading-snug"
                style={{ color: "var(--text-primary)" }}
              >
                I have read and agree to all the terms above
              </span>
            </label>

            {/* CTA */}
            <button
              type="button"
              disabled={!agreed}
              onClick={() => router.push("/apply/book")}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand-teal text-sm font-semibold text-[var(--text-primary)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
            >
              Secure My Offer Now
              <ArrowRight size={16} weight="bold" />
            </button>

            {!agreed && (
              <p
                className="text-center text-[11px] -mt-2"
                style={{ color: "var(--text-tertiary)" }}
              >
                Please agree to the terms above to continue.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
