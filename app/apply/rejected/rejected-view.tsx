"use client";

import Link from "next/link";
import { XCircle } from "@phosphor-icons/react";

import { ApplyIosShell } from "@/app/apply-gate/ios-ui";
import { BadCaseNav } from "@/app/apply/bad-case-nav";
import { useApplyPath } from "@/app/use-apply-path";
import { APPLY_PROGRESS } from "@/lib/apply-progress";

export function RejectedView() {
  const applyHref = useApplyPath();

  return (
    <ApplyIosShell progressStep={APPLY_PROGRESS.completeApp}>
      <div className="flex flex-1 flex-col gap-8 px-5 pb-8 pt-7 animate-fade-up">
        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1 className="ios-type-title">Application Rejected</h1>
        </div>

        {/* Status card */}
        <div
          className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border px-5 py-4 text-center"
          style={{
            borderColor: "var(--ios-danger-soft)",
            background: "var(--ios-danger-soft)",
          }}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/60 lg:h-20 lg:w-20">
            <XCircle
              size={36}
              weight="duotone"
              className="h-9 w-9"
              style={{ color: "var(--ios-danger)" }}
            />
          </div>
          <div className="flex flex-col gap-3">
            <p className="ios-type-body" style={{ color: "var(--ios-danger)" }}>
              Thank you for your interest, however your application is
              rejected.
            </p>
            <p className="ios-type-body" style={{ color: "var(--ios-danger)" }}>
              We are unable to disclose the confidential credit scoring used
              for this evaluation.
            </p>
          </div>
        </div>

        <div
          aria-hidden
          className="h-px w-full bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent"
        />

        <p className="ios-type-body text-[var(--text-primary)]">
          To submit a new loan application,{" "}
          <Link
            href={applyHref("/")}
            className="underline underline-offset-2"
          >
            click here
          </Link>
        </p>
      </div>

      <BadCaseNav back="/apply/pending-review" next="/apply/existing-customer" />
    </ApplyIosShell>
  );
}
