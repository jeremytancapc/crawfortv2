"use client";

import { AppleLogo, ArrowSquareOut, GooglePlayLogo, WhatsappLogo } from "@phosphor-icons/react";

import { ApplyIosShell } from "@/app/apply-gate/ios-ui";
import { APPLY_PROGRESS } from "@/lib/apply-progress";
import type { ReloanDisplay } from "@/lib/reloan-display";

interface Props {
  reloan: ReloanDisplay;
}

/**
 * Where a Reloan Customer lands.
 *
 * Ascend reports `newCustomer: false` straight after MyInfo, so a returning
 * borrower arrives here before any credit pull is spent on them (ADR-0001).
 * That makes this a redirection, not a rejection - and the page has to read
 * that way, because the applicant did nothing wrong and is still a customer.
 */
export function ReloanView({ reloan }: Props) {
  const { fullName, iosUrl, androidUrl } = reloan;
  const firstName = fullName?.trim().split(/\s+/)[0] ?? null;

  return (
    <ApplyIosShell progressStep={APPLY_PROGRESS.reviewInfo}>
      <div className="flex flex-1 flex-col gap-8 px-5 pb-8 pt-7 animate-fade-up">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
            Welcome back
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="ios-type-title">
            {firstName ? `${firstName}, you're already with us` : "You're already with us"}
          </h1>
          <p className="ios-type-body text-[var(--text-secondary)]">
            You have borrowed from Crawfort before, so your next loan is handled in the
            app rather than here. It already knows your details, so there is nothing to
            fill in again.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="ios-type-option text-[var(--text-primary)]">Continue in the app</p>

          {!iosUrl && !androidUrl ? (
            // No store link configured. Rather than render a dead button, send
            // them to a person - they are an existing customer, not a lead.
            <p className="ios-type-body text-[var(--text-secondary)]">
              Message us below and we will send you the download link.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {iosUrl && <StoreLink href={iosUrl} label="Download for iPhone" store="App Store" icon="ios" />}
              {androidUrl && (
                <StoreLink href={androidUrl} label="Download for Android" store="Google Play" icon="android" />
              )}
            </div>
          )}
        </div>

        <div className="h-px bg-[var(--border-subtle)]" />

        <div className="flex flex-col gap-3">
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

function StoreLink({
  href,
  label,
  store,
  icon,
}: {
  href: string;
  label: string;
  store: string;
  icon: "ios" | "android";
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-4 transition-all duration-200 hover:border-[var(--border-medium)] active:scale-[0.98]"
    >
      {icon === "ios" ? (
        <AppleLogo size={22} weight="duotone" className="shrink-0 text-brand-blue" />
      ) : (
        <GooglePlayLogo size={22} weight="duotone" className="shrink-0 text-brand-blue" />
      )}
      <div className="flex-1">
        <p className="ios-type-option text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-tertiary)]">{store}</p>
      </div>
      <ArrowSquareOut size={15} weight="duotone" className="shrink-0 text-[var(--text-tertiary)]" />
    </a>
  );
}
