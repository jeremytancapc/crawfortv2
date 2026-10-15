"use client";

import Image from "next/image";
import { WhatsappLogo } from "@phosphor-icons/react";

import { AppStoreBadges } from "@/app/app-store-badges";
import { ApplyIosShell } from "@/app/apply-gate/ios-ui";

interface Props {
  reloan: { fullName: string | null };
}

/**
 * Where a Reloan Customer lands.
 *
 * Ascend reports `newCustomer: false` straight after MyInfo, so a returning
 * borrower arrives here before any credit pull is spent on them (ADR-0001).
 * That makes this a redirection, not a rejection - and the page has to read
 * that way, because the applicant did nothing wrong and is still a customer.
 *
 * Same layout as the staging existing-customer screen (`/apply/existing-
 * customer`) - one visual language for "you belong in the app", whether the
 * applicant is real (here) or a demo walkthrough (there). No `progressStep`,
 * matching that page: a returning customer isn't partway through a funnel
 * step, so there is no progress to show.
 */
export function ReloanView({ reloan }: Props) {
  const { fullName } = reloan;
  const firstName = fullName?.trim().split(/\s+/)[0] ?? null;

  return (
    <ApplyIosShell>
      <div className="flex flex-1 flex-col items-center gap-8 px-5 pb-8 pt-7 text-center animate-fade-up">
        <Image
          src="/images/crawfort-app-logo.png"
          alt="Crawfort app"
          width={1000}
          height={1000}
          className="h-16 w-16 shrink-0"
        />

        <h1 className="ios-type-title">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>

        <div
          aria-hidden
          className="h-px w-full bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent"
        />

        <div className="flex flex-col items-center gap-3">
          <p className="ios-type-body text-[var(--text-secondary)]">
            You have borrowed from Crawfort before, so your next loan is handled in the app
            rather than here.
            <br />
            It already knows your details, so there is nothing to fill in again.
          </p>

          <AppStoreBadges />
        </div>

        <div
          aria-hidden
          className="h-px w-full bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent"
        />

        <div className="flex w-full flex-col gap-3 text-left">
          <p className="ios-type-option text-[var(--text-primary)]">Prefer to talk to someone?</p>
          <a
            href="https://wa.me/6560119380?text=Hi%2C%20I%27m%20an%20existing%20customer%20and%20would%20like%20to%20apply%20again"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-4 transition-all duration-200 hover:border-[var(--border-medium)] active:scale-[0.98]"
          >
            <WhatsappLogo size={22} weight="duotone" className="shrink-0 text-brand-blue" />
            <div>
              <p className="ios-type-option text-[var(--text-primary)]">WhatsApp us</p>
              <p className="text-xs text-[var(--text-tertiary)]">6011 9380 · Mon - Sat, 10:30am - 7:30pm</p>
            </div>
          </a>
        </div>
      </div>
    </ApplyIosShell>
  );
}
