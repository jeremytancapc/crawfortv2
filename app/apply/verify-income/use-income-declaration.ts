"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  MAX_DECLARED_INCOME,
  saveDeclaredIncome,
  useDeclaredIncome,
} from "@/lib/declared-income";

/** How long the amount must sit untouched before the signature box appears. */
const TYPING_PAUSE_MS = 700;

/** Keeps digits only, so "$4,200" and "4200" both become 4200. */
function parseIncomeInput(text: string): number {
  const digits = text.replace(/\D/g, "").slice(0, String(MAX_DECLARED_INCOME).length);
  return digits ? Number(digits) : 0;
}

/**
 * State for the self-declared income step: the amount typed, the drawn
 * signature, and the confirmation prompt that follows signing. Saving happens
 * only once the applicant accepts the prompt.
 */
export function useIncomeDeclaration(onDeclared: () => void) {
  const saved = useDeclaredIncome();
  // null = untouched, so a previously saved amount shows until they edit it.
  const [typedIncome, setTypedIncome] = useState<number | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef<number | null>(null);

  const monthlyIncome = typedIncome ?? saved?.monthlyIncome ?? 0;
  const isSigned = signature !== null;
  // Appears once an amount is in and the applicant has paused typing, and
  // stays put while a signature exists.
  const showSignature = isSigned || (monthlyIncome > 0 && !isTyping);

  const changeIncome = useCallback((text: string) => {
    setTypedIncome(parseIncomeInput(text));
    setIsTyping(true);
    if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      typingTimerRef.current = null;
      setIsTyping(false);
    }, TYPING_PAUSE_MS);
  }, []);

  useEffect(
    () => () => {
      if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
    },
    [],
  );

  const handleSigned = useCallback((dataUrl: string) => {
    setSignature(dataUrl);
    setIsPromptOpen(true);
  }, []);

  const handleCleared = useCallback(() => {
    setSignature(null);
  }, []);

  /** Footer "Continue": reopens the prompt if it was dismissed after signing. */
  const openPrompt = useCallback(() => {
    if (signature && monthlyIncome > 0) setIsPromptOpen(true);
  }, [signature, monthlyIncome]);

  const closePrompt = useCallback(() => {
    setIsPromptOpen(false);
  }, []);

  const confirm = useCallback(() => {
    if (!signature || monthlyIncome <= 0) return;
    saveDeclaredIncome({
      monthlyIncome,
      signature,
      signedAt: new Date().toISOString(),
    });
    setIsPromptOpen(false);
    onDeclared();
  }, [signature, monthlyIncome, onDeclared]);

  return {
    monthlyIncome,
    changeIncome,
    showSignature,
    isSigned,
    handleSigned,
    handleCleared,
    isPromptOpen,
    openPrompt,
    closePrompt,
    confirm,
  };
}

export type IncomeDeclaration = ReturnType<typeof useIncomeDeclaration>;
