"use client";

import Image from "next/image";
import {
  Handshake,
  PhoneCall,
  WhatsappLogo,
  CheckCircle,
} from "@phosphor-icons/react";
import { MobileHeader } from "@/app/mobile-header";
import { MobileLegalFooter } from "@/app/mobile-legal-footer";
import type { CustomOfferDisplay } from "@/lib/custom-offer-display";

interface Props {
  offer: CustomOfferDisplay;
}

/** Shorten a UUID to the last 8 characters for display as a reference number. */
function shortRef(leadId: string): string {
  return leadId.slice(-8).toUpperCase();
}

const NEXT_STEPS = [
  "Our team will call and WhatsApp you within 1 business day to confirm the exact terms.",
  "We'll walk you through the final amount, tenure and rate before anything is signed.",
  "Nothing has been signed or finalized yet - this is a request, not an approval.",
];

export function CustomOfferReceivedView({ offer }: Props) {
  const { fullName, leadId, amount, tenure } = offer;
  const firstName = fullName ? fullName.split(" ")[0] : null;
  const cfh5Ref = leadId ? `CFH5-${shortRef(leadId)}` : null;

  return (
    <div className="theme-fresh flex flex-col lg:flex-row min-h-dvh bg-[var(--surface-primary)]">
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
            Request received.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[var(--text-on-brand)] opacity-75 max-w-[380px]">
            Our team will call and WhatsApp you shortly to confirm your custom offer.
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-col flex-1 overflow-x-clip">
        <MobileHeader />

        <div className="flex flex-col items-center justify-start px-5 pb-8 pt-6 sm:px-8 flex-1 lg:justify-center lg:px-12 lg:pt-10 lg:pb-10 xl:px-20">
          <div className="w-full max-w-[520px] flex flex-col gap-8 animate-fade-up">

            {/* Status badge */}
            <div className="flex items-center gap-2">
              <Handshake
                size={18}
                weight="duotone"
                className="shrink-0"
                style={{ color: "#e07b4a" }}
              />
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                Custom Offer Requested
              </span>
            </div>

            {/* Heading */}
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                {firstName ? `Thanks, ${firstName}.` : "Thanks for your request."}
              </h2>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                We&apos;ve received your request for{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  S${amount.toLocaleString()}
                </span>{" "}
                over{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {tenure} {tenure === 1 ? "month" : "months"}
                </span>
                . This isn&apos;t a final approval - our team will be in touch to confirm the exact terms.
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
                  <PhoneCall size={18} weight="duotone" style={{ color: "#e07b4a" }} />
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

            <div className="h-px bg-[var(--border-subtle)]" />

            {/* WhatsApp - official channel for follow-up */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Get in touch</p>
              <a
                href="https://wa.me/6560119380?text=Hi%20I%20just%20requested%20a%20custom%20loan%20offer"
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
        </div>

        <MobileLegalFooter />
      </main>
    </div>
  );
}
