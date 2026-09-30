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
  const [incomeNeedsInput, setIncomeNeedsInput] = useState(false);
  const [signatureNeedsInput, setSignatureNeedsInput] = useState(false);
  const [attentionNonce, setAttentionNonce] = useState(0);
  const typingTimerRef = useRef<number | null>(null);

  const monthlyIncome = typedIncome ?? saved?.monthlyIncome ?? 0;
  const isSigned = signature !== null;
  // Appears once an amount is in and the applicant has paused typing, and
  // stays put while a signature exists.
  const showSignature = isSigned || (monthlyIncome > 0 && !isTyping);

  const changeIncome = useCallback((text: string) => {
    const amount = parseIncomeInput(text);
    setTypedIncome(amount);
    if (amount > 0) setIncomeNeedsInput(false);
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
    setSignatureNeedsInput(false);
    setIsPromptOpen(true);
  }, []);

  const handleCleared = useCallback(() => {
    setSignature(null);
  }, []);

  /**
   * Footer "Continue" is always tappable. A missing amount or signature is
   * painted red instead of greying the button; the prompt opens only once both
   * are present.
   */
  const requestContinue = useCallback(() => {
    if (monthlyIncome <= 0) {
      setIncomeNeedsInput(true);
      setSignatureNeedsInput(false);
      setAttentionNonce((nonce) => nonce + 1);
      return;
    }
    if (!signature) {
      setIncomeNeedsInput(false);
      setIsTyping(false);
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      setSignatureNeedsInput(true);
      setAttentionNonce((nonce) => nonce + 1);
      return;
    }
    setIncomeNeedsInput(false);
    setSignatureNeedsInput(false);
    setIsPromptOpen(true);
  }, [monthlyIncome, signature]);

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
    incomeNeedsInput,
    signatureNeedsInput,
    attentionNonce,
    handleSigned,
    handleCleared,
    isPromptOpen,
    requestContinue,
    closePrompt,
    confirm,
  };
}

export type IncomeDeclaration = ReturnType<typeof useIncomeDeclaration>;
