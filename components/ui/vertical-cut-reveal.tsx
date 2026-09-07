"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { motion, useReducedMotion, type AnimationOptions } from "motion/react";

import { cn } from "@/lib/utils";

interface VerticalCutRevealProps {
  children: React.ReactNode;
  /** Slide down into place instead of up out of the cut. */
  reverse?: boolean;
  transition?: AnimationOptions;
  splitBy?: "words" | "characters" | "lines" | string;
  staggerDuration?: number;
  staggerFrom?: "first" | "last" | "center" | "random" | number;
  containerClassName?: string;
  wordLevelClassName?: string;
  elementLevelClassName?: string;
  onClick?: () => void;
  onComplete?: () => void;
  /** Off hands the start over to the ref's `startAnimation`. */
  autoStart?: boolean;
}

export interface VerticalCutRevealRef {
  startAnimation: () => void;
  reset: () => void;
}

interface WordObject {
  characters: string[];
  needsSpace: boolean;
}

/** Locale-safe character split - keeps emoji and combining marks whole. */
function splitIntoCharacters(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
}

/**
 * Reveals text as if it were rising out of a cut in the page: each word (or
 * character) sits in its own overflow-hidden slot and slides up into it on a
 * stagger.
 */
const VerticalCutReveal = forwardRef<VerticalCutRevealRef, VerticalCutRevealProps>(
  (
    {
      children,
      reverse = false,
      transition = { type: "spring", stiffness: 190, damping: 22 },
      splitBy = "words",
      staggerDuration = 0.2,
      staggerFrom = "first",
      containerClassName,
      wordLevelClassName,
      elementLevelClassName,
      onClick,
      onComplete,
      autoStart = true,
      ...props
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLSpanElement>(null);
    const text = typeof children === "string" ? children : (children?.toString() ?? "");
    /* Motion runs initial -> animate on mount by itself, so autoplay is the
       starting value here rather than an effect that fires after first paint. */
    const [isAnimating, setIsAnimating] = useState(autoStart);
    /* Pivot for staggerFrom="random", drawn once: redrawing it per element
       would scatter the delays instead of staggering out from one point. */
    const [randomPivot] = useState(Math.random);
    const prefersReducedMotion = useReducedMotion();

    const elements = (() => {
      const words = text.split(" ");
      if (splitBy === "characters") {
        return words.map((word, i) => ({
          characters: splitIntoCharacters(word),
          needsSpace: i !== words.length - 1,
        }));
      }
      if (splitBy === "words") return words;
      if (splitBy === "lines") return text.split("\n");
      return text.split(splitBy);
    })();

    const getStaggerDelay = (index: number) => {
      const total =
        splitBy === "characters"
          ? (elements as WordObject[]).reduce(
              (acc, word) => acc + word.characters.length + (word.needsSpace ? 1 : 0),
              0,
            )
          : elements.length;
      if (staggerFrom === "first") return index * staggerDuration;
      if (staggerFrom === "last") return (total - 1 - index) * staggerDuration;
      if (staggerFrom === "center") {
        return Math.abs(Math.floor(total / 2) - index) * staggerDuration;
      }
      if (staggerFrom === "random") {
        return Math.abs(Math.floor(randomPivot * total) - index) * staggerDuration;
      }
      return Math.abs(staggerFrom - index) * staggerDuration;
    };

    useImperativeHandle(ref, () => ({
      startAnimation: () => setIsAnimating(true),
      reset: () => setIsAnimating(false),
    }));

    /* The text is only readable once it has slid into its slot, so anyone who
       has asked for less motion gets it sitting there from the start rather
       than a heading that waits on an animation to become legible. */
    const variants = {
      hidden: { y: prefersReducedMotion ? 0 : reverse ? "-100%" : "100%" },
      visible: (i: number) => ({
        y: 0,
        transition: prefersReducedMotion
          ? { duration: 0 }
          : {
              ...transition,
              delay: ((transition?.delay as number) ?? 0) + getStaggerDelay(i),
            },
      }),
    };

    const words: WordObject[] =
      splitBy === "characters"
        ? (elements as WordObject[])
        : (elements as string[]).map((el, i) => ({
            characters: [el],
            needsSpace: i !== elements.length - 1,
          }));

    return (
      <span
        className={cn(
          containerClassName,
          "flex flex-wrap whitespace-pre-wrap",
          splitBy === "lines" && "flex-col",
        )}
        onClick={onClick}
        ref={containerRef}
        {...props}
      >
        <span className="sr-only">{text}</span>

        {words.map((wordObj, wordIndex, array) => {
          const previousCharsCount = array
            .slice(0, wordIndex)
            .reduce((sum, word) => sum + word.characters.length, 0);

          return (
            <span
              key={wordIndex}
              aria-hidden="true"
              className={cn("inline-flex overflow-hidden", wordLevelClassName)}
            >
              {wordObj.characters.map((char, charIndex) => (
                <span
                  key={charIndex}
                  className={cn(elementLevelClassName, "relative whitespace-pre-wrap")}
                >
                  <motion.span
                    custom={previousCharsCount + charIndex}
                    initial="hidden"
                    animate={isAnimating ? "visible" : "hidden"}
                    variants={variants}
                    onAnimationComplete={
                      wordIndex === words.length - 1 &&
                      charIndex === wordObj.characters.length - 1
                        ? onComplete
                        : undefined
                    }
                    className="inline-block"
                  >
                    {char}
                  </motion.span>
                </span>
              ))}
              {wordObj.needsSpace && <span> </span>}
            </span>
          );
        })}
      </span>
    );
  },
);

VerticalCutReveal.displayName = "VerticalCutReveal";

export { VerticalCutReveal };
