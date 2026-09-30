"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";

import { Card, PrimaryButton } from "@/app/apply-gate/ios-ui";
import { SignaturePad } from "@/app/apply/accept/signature-pad";
import type { IncomeDeclaration } from "@/app/apply/verify-income/use-income-declaration";
import { formatCurrency } from "@/lib/loan-form";

/**
 * Step 3 body: the applicant types what they earn, then signs to confirm it.
 * Signing opens `DeclarationPromptModal`; the amount locks while signed so the
 * signature always matches the figure.
 */
export function DeclareIncomeStep({ declaration }: { declaration: IncomeDeclaration }) {
  const { monthlyIncome, changeIncome, showSignature, isSigned, handleSigned, handleCleared } =
    declaration;
  const prefersReducedMotion = useReducedMotion();

  // The pad's canvas is lost when this step unmounts, so the signed state
  // must not outlive it - otherwise "Continue" would stay enabled on a blank pad.
  useEffect(() => () => handleCleared(), [handleCleared]);

  return (
    <div className="animate-fade-up flex flex-col gap-6">
      <section aria-labelledby="declared-income-heading">
        <h3
          id="declared-income-heading"
          className="mb-2.5 px-1 text-[20px] font-bold leading-tight text-[var(--text-primary)]"
        >
          Monthly income
        </h3>
        <Card className="px-4 pb-4 pt-5">
          <label
            htmlFor="declared-income-input"
            className="ios-display-amount flex items-baseline gap-1"
          >
            <span className="text-[28px] font-bold leading-none tracking-[-0.022em] text-[var(--text-primary)]">
              $
            </span>
            <input
              id="declared-income-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={monthlyIncome > 0 ? monthlyIncome.toLocaleString("en-SG") : ""}
              readOnly={isSigned}
              onChange={(event) => changeIncome(event.target.value)}
              aria-label="Your monthly income in dollars"
              className="ios-display-input w-full min-w-0 border-0 bg-transparent overflow-hidden p-0 text-[36px] font-bold leading-[1.35] tracking-[-0.03em] tabular-nums text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] read-only:opacity-70"
            />
          </label>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
            {isSigned
              ? "Re-sign below if you need to change this amount."
              : "What you earn in an average month, in SGD."}
          </p>
        </Card>
      </section>

      {/* The card always holds its place in the layout so the pane fitter sizes
          the whole step - signature included - on load. Revealing it only
          fades and lifts it; nothing reflows, so the page never rescales. */}
      <motion.div
        aria-hidden={!showSignature}
        inert={!showSignature}
        initial={false}
        animate={
          showSignature
            ? { opacity: 1, y: 0, visibility: "visible" }
            : {
                opacity: 0,
                y: prefersReducedMotion ? 0 : 12,
                transitionEnd: { visibility: "hidden" },
              }
        }
        transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <SignaturePad
          title="Sign to confirm"
          description="Draw your signature to confirm this is your income."
          confirmLabel="Sign"
          headingInBanner
          canvasHeight={120}
          onSigned={handleSigned}
          onCleared={handleCleared}
        />
      </motion.div>
    </div>
  );
}

/**
 * Shown right after signing. Only "Continue" saves the declaration, so
 * backing out leaves nothing stored.
 */
export function DeclarationPromptModal({ declaration }: { declaration: IncomeDeclaration }) {
  const { monthlyIncome, closePrompt, confirm } = declaration;

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePrompt();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePrompt]);

  // Only ever mounted after the applicant signs, so `document` exists.
  return createPortal(
    <div
      className="theme-ios fixed inset-0 z-[200] flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="declaration-prompt-title"
      aria-describedby="declaration-prompt-body"
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={closePrompt}
        className="absolute inset-0 bg-black/35"
      />
      <div className="relative w-full max-w-[360px] rounded-[20px] bg-[var(--surface-elevated)] px-6 pb-6 pt-7 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
        <h2
          id="declaration-prompt-title"
          className="text-[22px] font-bold leading-tight tracking-[-0.022em] text-[var(--text-primary)]"
        >
          Before you continue
        </h2>
        <p
          id="declaration-prompt-body"
          className="mt-2 text-[15px] leading-[1.45] text-[var(--text-secondary)]"
        >
          We&rsquo;ll use your signature and self-declared income of{" "}
          <strong className="font-semibold text-[var(--text-primary)]">
            {formatCurrency(monthlyIncome)} a month
          </strong>{" "}
          to continue. Your loan amount will be limited.
        </p>
        <div className="mt-6 flex flex-col gap-1">
          <PrimaryButton onClick={confirm}>Continue</PrimaryButton>
          <button
            type="button"
            onClick={closePrompt}
            className="flex h-11 items-center justify-center text-[15px] font-semibold text-[var(--accent)]"
          >
            Go back
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
