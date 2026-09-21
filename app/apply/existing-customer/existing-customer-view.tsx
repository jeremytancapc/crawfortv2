"use client";

import Image from "next/image";
import { WhatsappLogo } from "@phosphor-icons/react";

import { AppStoreBadges } from "@/app/app-store-badges";
import { ApplyIosShell } from "@/app/apply-gate/ios-ui";
import { BadCaseNav } from "@/app/apply/bad-case-nav";
import { continueToReview } from "@/app/apply/verify-income/use-verify-income";

const WHATSAPP_URL =
  "https://wa.me/6560279208?text=Hi%2C%20I%20am%20existing%20customer%20applying%20for%20a%20loan";

export function ExistingCustomerView() {
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

        <h1 className="ios-type-title">Existing Crawfort Customers</h1>

        <div
          aria-hidden
          className="h-px w-full bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent"
        />

        <div className="flex flex-col items-center gap-3">
          <p className="ios-type-body text-[var(--text-secondary)]">
            Continue your loan application in our Crawfort app.
            <br />
            Download our app and continue the steps there.
          </p>

          <AppStoreBadges />
        </div>

        <div
          aria-hidden
          className="h-px w-full bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent"
        />

        {/* WhatsApp - for anything the app doesn't answer */}
        <div className="flex w-full flex-col gap-3 text-left">
          <p className="ios-type-option text-[var(--text-primary)]">Any questions?</p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-4 transition-all duration-200 hover:border-[var(--border-medium)] active:scale-[0.98]"
          >
            <WhatsappLogo size={22} weight="duotone" className="shrink-0 text-brand-blue" />
            <div>
              <p className="ios-type-option text-[var(--text-primary)]">WhatsApp us</p>
              <p className="text-xs text-[var(--text-tertiary)]">6027 9208</p>
            </div>
          </a>
        </div>
      </div>

      <BadCaseNav back="/apply/rejected" next={continueToReview} />
    </ApplyIosShell>
  );
}
