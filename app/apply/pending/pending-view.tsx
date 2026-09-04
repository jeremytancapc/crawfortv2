"use client";

import {
  HourglassMedium,
  WhatsappLogo,
  Info,
  CheckCircle,
} from "@phosphor-icons/react";
import { ApplyIosShell } from "@/app/apply-gate/ios-ui";
import { ApplyStepNavFooter } from "@/app/apply-gate/use-apply-step-nav";
import { APPLY_PROGRESS } from "@/lib/apply-progress";
import type { PendingDisplay } from "@/lib/pending-display";

interface Props {
  pending: PendingDisplay;
}

/** Shorten a UUID to the last 8 characters for display as a reference number. */
function shortRef(leadId: string): string {
  return leadId.slice(-8).toUpperCase();
}

const NEXT_STEPS = [
  "Our team will review your application within 1-2 business days.",
  "We may contact you to request supporting documents.",
  "WhatsApp us if you need to follow up.",
];

export function PendingView({ pending }: Props) {
  const { leadId, amount, idType } = pending;
  const cfh5Ref = leadId ? `CFH5-${shortRef(leadId)}` : null;

  const isForeigner = idType === "foreigner";

  return (
    <ApplyIosShell
      sidebarTitle="Wait for our review"
      sidebarSubtitle="We've received your application and our team will be in touch with you shortly."
      progressStep={APPLY_PROGRESS.completeApp}
    >
      <div className="flex flex-1 flex-col gap-8 px-5 pb-8 pt-7 animate-fade-up">

            {/* Status badge */}
            <div className="flex items-center gap-2">
              <HourglassMedium
                size={18}
                weight="duotone"
                className="text-[var(--text-tertiary)] shrink-0"
                style={{ color: "#e07b4a" }}
              />
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                Application Pending Review
              </span>
            </div>

            {/* Heading */}
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                Wait for our review
              </h2>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                Your application for a loan of{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  S${amount.toLocaleString()}
                </span>{" "}
                has been received and is pending review by our team.
              </p>
            </div>

            {/* Application reference */}
            {cfh5Ref && (
              <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-5 py-4">
                <div>
                  <p className="text-xs text-[var(--text-tertiary)]">Application reference</p>
                  <p className="mt-0.5 font-display text-lg font-bold tracking-tight text-[var(--text-primary)]">
                    {cfh5Ref}
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
                  <HourglassMedium size={18} weight="duotone" style={{ color: "#e07b4a" }} />
                </div>
              </div>
            )}

            {/* What happens next */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">What happens next</p>
              <ul className="flex flex-col gap-2.5">
                {NEXT_STEPS.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle
                      size={15}
                      weight="duotone"
                      className="mt-0.5 shrink-0"
                      style={{ color: "#e07b4a" }}
                    />
                    <span className="text-sm leading-snug text-[var(--text-secondary)]">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Foreigner income note */}
            {isForeigner && (
              <div className="flex gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-secondary)] px-4 py-3">
                <Info size={15} weight="duotone" className="mt-0.5 shrink-0 text-[var(--text-tertiary)]" />
                <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
                  For foreigners, a minimum annual income of S$40,000 is required. If your income has changed recently, please contact us with your latest payslips.
                </p>
              </div>
            )}

            <div className="h-px bg-[var(--border-subtle)]" />

            {/* WhatsApp - official channel for follow-up */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Get in touch</p>
              <a
                href="https://wa.me/6560119380?text=Hi%20My%20application%20is%20pending%20review"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-4 transition-all duration-200 hover:border-[var(--border-medium)] active:scale-[0.98]"
              >
                <WhatsappLogo size={22} weight="duotone" className="shrink-0 text-brand-blue" />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">WhatsApp us</p>
                  <p className="text-xs text-[var(--text-tertiary)]">6011 9380 · Mon - Sat, 10:30am - 7:30pm</p>
                </div>
              </a>
            </div>

            {/* Footer note */}
            <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
              Office hours: Mon - Sat, 10:30am - 7:30pm. Closed on Sundays and Public Holidays.
            </p>

      </div>
      <ApplyStepNavFooter id="pending" />
    </ApplyIosShell>
  );
}
