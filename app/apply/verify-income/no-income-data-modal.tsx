"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { FileText } from "@phosphor-icons/react";

import { AnimatedIconBadge } from "@/app/animated-icon-badge";

const subscribeNever = () => () => {};

/**
 * Shown once before the upload screen: Singpass returned no CPF/NOA record, so
 * the applicant is told why they are being asked for documents. Same shell as
 * the appointment reminder on the accept step.
 */
export function NoIncomeDataModal({ onContinue }: { onContinue: () => void }) {
  // The portal needs `document`; false on the server, true once hydrated.
  const isClient = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isClient) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    continueRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isClient]);

  if (!isClient) return null;

  // Portal to body so the overlay covers the sidebar, header, and footer -
  // `fixed` inside the scaled apply pane only paints that column.
  return createPortal(
    <div
      className="theme-ios fixed inset-0 z-[200] flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="no-income-data-title"
      aria-describedby="no-income-data-description"
    >
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="relative w-full max-w-[440px] rounded-[20px] bg-[var(--surface-elevated)] px-6 pb-7 pt-8 shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
      >
        <div className="flex flex-col items-center text-center">
          <AnimatedIconBadge
            background="oklch(0.32 0.14 260 / 0.12)"
            ringColor="var(--brand-blue-hex, #0033AA)"
          >
            <FileText size={26} weight="fill" style={{ color: "var(--brand-blue-hex, #0033AA)" }} />
          </AnimatedIconBadge>
          <h2
            id="no-income-data-title"
            className="mt-5 text-[clamp(18px,5vw,22px)] font-bold leading-tight tracking-[-0.03em] text-[var(--text-primary)]"
          >
            No CPF/NOA detected
          </h2>
          <p
            id="no-income-data-description"
            className="mt-2 text-[14.5px] font-medium leading-snug text-[var(--text-secondary)]"
          >
            We need you to upload your latest 3 months of income documents on the next screen.
          </p>
        </div>

        <button
          ref={continueRef}
          type="button"
          onClick={onContinue}
          className="ios-type-cta mt-6 flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-brand-blue px-3 text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
        >
          Continue
        </button>
      </motion.div>
    </div>,
    document.body,
  );
}
