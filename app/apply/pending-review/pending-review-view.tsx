"use client";

import { HourglassMedium, WhatsappLogo } from "@phosphor-icons/react";

import { ApplyIosShell } from "@/app/apply-gate/ios-ui";
import { BadCaseNav } from "@/app/apply/bad-case-nav";
import { APPLY_PROGRESS } from "@/lib/apply-progress";

const WHATSAPP_URL =
  "https://wa.me/6560119380?text=Hi%2C%20my%20application%20is%20pending";

export function PendingReviewView() {
  return (
    <ApplyIosShell progressStep={APPLY_PROGRESS.completeApp}>
      <div className="flex flex-1 flex-col gap-8 px-5 pb-8 pt-7 animate-fade-up">
        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1 className="ios-type-title">We&apos;re reviewing your application</h1>
          <p className="ios-type-subtitle mt-1.5">
            Pending Manual Verification
          </p>
        </div>

        {/* Status card */}
        <div
          className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border px-5 py-4 text-center"
          style={{
            borderColor: "var(--ios-warning-soft)",
            background: "var(--ios-warning-soft)",
          }}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/60 lg:h-20 lg:w-20">
            <HourglassMedium
              size={36}
              weight="duotone"
              className="h-7 w-7 animate-hourglass-flip lg:h-9 lg:w-9"
              style={{ color: "var(--ios-warning)" }}
            />
          </div>
          <p className="ios-type-body" style={{ color: "var(--ios-warning)" }}>
            Thank you for your interest, your application is currently
            pending for manual verification. This will take up to 3 business
            days.
          </p>
        </div>

        <div
          aria-hidden
          className="h-px w-full bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent"
        />

        {/* WhatsApp - alternative way to reach us */}
        <p className="ios-type-body text-[var(--text-primary)]">
          Alternatively, you may also{" "}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            <WhatsappLogo size={17} weight="fill" className="shrink-0" style={{ color: "#25D366" }} />
            WhatsApp us
          </a>
        </p>
      </div>

      <BadCaseNav back="/apply/verify-income?view=results" next="/apply/rejected" />
    </ApplyIosShell>
  );
}
