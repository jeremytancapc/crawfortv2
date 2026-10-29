"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Info } from "@phosphor-icons/react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

import { useLocale } from "@/app/i18n/locale-provider";

// One smooth band, no knob - the rounded end of the blue fill is the handle.
// The arc runs from $0 to the Maximum Loan Quantum, but the drawdown only goes
// up to what Ascend approved today, which is usually well short of the end.

// ── Geometry ──────────────────────────────────────────────────────────────────

const VIEW_W = 360;
const CX = 180;
const R = 140;
const STROKE = 26;
const CY = R + STROKE / 2 + 2;
const VIEW_H = CY + STROKE / 2 + 2;
/** Where the centre readout starts, as a fraction of the arc box's height.
 *  Pulled up with a width-relative negative margin, as in credit-gauge.tsx,
 *  so the readout's real height still pushes the rows below it down. */
const READOUT_TOP_FRACTION = 0.38;
const READOUT_MARGIN_TOP_PCT = (READOUT_TOP_FRACTION - 1) * (VIEW_H / VIEW_W) * 100;

/** Grey track: the pre-approved amount not drawn. */
export const GAUGE_TRACK_SWATCH = "oklch(0.91 0.022 262)";
export const GAUGE_FILL_SWATCH = "oklch(0.58 0.21 260)";

/** How long a limit hint stays up after the last push against the limit. */
const LIMIT_HINT_MS = 2200;

const INTRO_HOLD_MS = 240;
const INTRO_UP_MS = 1600;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** t in [0, 1] runs left → top → right. */
function angleAt(t: number): number {
  return 180 - t * 180;
}

function polar(radius: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

function arcPath(t0: number, t1: number): string {
  const a = polar(R, angleAt(t0));
  const b = polar(R, angleAt(t1));
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`;
}

function pointerToFraction(svg: SVGSVGElement, clientX: number, clientY: number): number {
  const inverse = svg.getScreenCTM()?.inverse();
  if (!inverse) return 0;
  const x = inverse.a * clientX + inverse.c * clientY + inverse.e;
  const y = inverse.b * clientX + inverse.d * clientY + inverse.f;
  let deg = (Math.atan2(CY - y, x - CX) * 180) / Math.PI;
  // Below the centre on the left half belongs to the left end.
  if (deg < -90) deg += 360;
  return Math.min(1, Math.max(0, (180 - deg) / 180));
}

export function formatSgd(amount: number): string {
  return `S$${Math.round(amount).toLocaleString("en-SG")}`;
}

const END_LABEL_CLASS =
  "absolute top-full mt-2 -translate-x-1/2 whitespace-nowrap text-[14px] font-semibold leading-none tabular-nums text-[var(--text-primary)]";

// ── Component ─────────────────────────────────────────────────────────────────

interface CreditGaugeProps {
  /** Amount being drawn down today. */
  value: number;
  /** Most that can be drawn today - the drag stops here. */
  max: number;
  /** Pre-approved amount - the full sweep of the arc. Never drawable past `max`. */
  total: number;
  min: number;
  step: number;
  /** Raw amount from a drag or keypress. The parent clamps and snaps. */
  onChange: (raw: number) => void;
  ariaLabel: string;
  disabled?: boolean;
  /** Centre readout. Receives the amount currently shown - counting up with
   *  the intro, then tracking the drag. */
  children: (display: { value: number; isIntro: boolean }) => ReactNode;
  onInteract?: () => void;
}

export function CreditGauge({
  value,
  max,
  total,
  min,
  step,
  onChange,
  ariaLabel,
  disabled = false,
  children,
  onInteract,
}: CreditGaugeProps) {
  const { t } = useLocale();
  const prefersReducedMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const isInView = useInView(svgRef, { once: true, amount: 0.2 });
  const onChangeRef = useRef(onChange);
  const onInteractRef = useRef(onInteract);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onInteractRef.current = onInteract;
  }, [onInteract]);

  const [displayAmount, setDisplayAmount] = useState(0);
  const [isIntro, setIsIntro] = useState(true);
  const [canPlay, setCanPlay] = useState(false);
  const [dragAmount, setDragAmount] = useState<number | null>(null);
  const skipIntro = () => {
    setIsIntro(false);
    setCanPlay(true);
  };

  const scale = Math.max(total, max, 1);
  const amountToT = (amount: number) => Math.min(1, Math.max(0, amount / scale));

  // The drawdown starts at the pre-approved amount (or a figure already
  // chosen this session) and only comes down from there, so the intro fills
  // to that starting value and leaves it as it is.
  const startValueRef = useRef(value);
  useEffect(() => {
    if (isIntro) startValueRef.current = value;
  }, [isIntro, value]);

  // Intro: hold empty, then fill to the starting drawdown.
  useEffect(() => {
    if (prefersReducedMotion || disabled) {
      skipIntro();
      return;
    }
    if (isInView) {
      setCanPlay(true);
      return;
    }
    const fallback = window.setTimeout(() => setCanPlay(true), 1200);
    return () => window.clearTimeout(fallback);
  }, [isInView, prefersReducedMotion, disabled]);

  useEffect(() => {
    if (!canPlay || !isIntro || prefersReducedMotion || disabled) return;

    let raf = 0;
    let start: number | null = null;

    const frame = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;

      if (elapsed < INTRO_HOLD_MS) {
        setDisplayAmount(0);
        raf = requestAnimationFrame(frame);
        return;
      }

      const target = clampInt(startValueRef.current, min, max);
      const afterHold = elapsed - INTRO_HOLD_MS;
      if (afterHold < INTRO_UP_MS) {
        setDisplayAmount(target * easeInOutCubic(afterHold / INTRO_UP_MS));
        raf = requestAnimationFrame(frame);
        return;
      }

      setDisplayAmount(target);
      skipIntro();
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [canPlay, isIntro, prefersReducedMotion, disabled, max, min]);

  const shownAmount = isIntro ? displayAmount : (dragAmount ?? value);
  const displayValue = Math.round(shownAmount);
  const fillT = amountToT(shownAmount);

  const isDraggingRef = useRef(false);
  const pendingAmountRef = useRef<number | null>(null);
  const commitRafRef = useRef(0);

  // A band that just stops reads as broken, so running past either end of
  // what can be drawn names that end for a moment.
  const [limitHint, setLimitHint] = useState<string | null>(null);
  const limitHintTimerRef = useRef(0);
  useEffect(() => () => window.clearTimeout(limitHintTimerRef.current), []);
  const flagLimit = (hint: string) => {
    setLimitHint(hint);
    window.clearTimeout(limitHintTimerRef.current);
    limitHintTimerRef.current = window.setTimeout(() => setLimitHint(null), LIMIT_HINT_MS);
  };

  const applyPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    e.preventDefault();
    const raw = pointerToFraction(svg, e.clientX, e.clientY) * scale;
    if (raw < min - step / 2 && min < max) {
      flagLimit(t("The minimum is {amount}").replace("{amount}", formatSgd(min)));
    }
    if (raw > max + step / 2) {
      flagLimit(t("You can draw up to {amount} today").replace("{amount}", formatSgd(max)));
    }
    const next = Math.min(max, Math.max(min, raw));
    setDragAmount(next);
    pendingAmountRef.current = next;
    if (commitRafRef.current) return;
    commitRafRef.current = requestAnimationFrame(() => {
      commitRafRef.current = 0;
      const pending = pendingAmountRef.current;
      if (pending != null) onChange(pending);
    });
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    onInteractRef.current?.();
    skipIntro();
    isDraggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no capture */
    }
    applyPointer(e);
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    applyPointer(e);
  };

  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (commitRafRef.current) {
      cancelAnimationFrame(commitRafRef.current);
      commitRafRef.current = 0;
    }
    const pending = pendingAmountRef.current;
    if (pending != null) onChange(pending);
    pendingAmountRef.current = null;
    setDragAmount(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const showMin = min > 0 && min < max;

  return (
    <div
      className="credit-gauge relative mx-auto w-full min-w-0 max-w-full"
      data-disabled={disabled}
    >
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="credit-gauge-arc block h-auto w-full max-w-full min-w-0 select-none"
          aria-hidden="true"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        >
          <defs>
            {/* Deep at the base, brighter towards the tip - the tip is the handle. */}
            <linearGradient
              id="credit-gauge-fill"
              gradientUnits="userSpaceOnUse"
              x1={CX}
              y1={CY}
              x2={CX}
              y2={CY - R}
            >
              <stop offset="0" style={{ stopColor: "oklch(0.52 0.23 262)" }} />
              <stop offset="1" style={{ stopColor: "oklch(0.65 0.18 254)" }} />
            </linearGradient>
          </defs>

          <path
            d={arcPath(0, 1)}
            fill="none"
            stroke={GAUGE_TRACK_SWATCH}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {fillT > 0.001 && (
            <path
              d={arcPath(0, fillT)}
              fill="none"
              stroke="url(#credit-gauge-fill)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 2px 4px oklch(0.52 0.23 262 / 0.28))" }}
            />
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <span className={END_LABEL_CLASS} style={{ left: `${(polar(R, 180).x / VIEW_W) * 100}%` }}>
            {formatSgd(showMin ? min : 0)}
          </span>
          <span className={END_LABEL_CLASS} style={{ left: `${(polar(R, 0).x / VIEW_W) * 100}%` }}>
            {formatSgd(scale)}
          </span>
        </div>
      </div>

      <div
        className="pointer-events-none mx-auto flex w-[68%] flex-col items-center text-center"
        style={{ marginTop: `${READOUT_MARGIN_TOP_PCT}%` }}
      >
        {children({ value: displayValue, isIntro })}
      </div>

      {/* Space held even while hidden, so a hint never shifts the card under
          a finger that is mid-drag. The chip rises in on a soft spring and
          leaves faster than it came, so it never lingers in the way. */}
      <div
        className="mt-3 flex min-h-[2.125rem] items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence mode="wait" initial={false}>
          {limitHint ? (
            <motion.span
              key={limitHint}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold leading-none"
              style={{
                background: "oklch(0.97 0.05 92)",
                color: "oklch(0.40 0.09 70)",
                boxShadow:
                  "inset 0 0 0 1px oklch(0.86 0.11 88 / 0.7), 0 4px 12px oklch(0.55 0.12 80 / 0.14)",
              }}
              initial={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }
              }
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: prefersReducedMotion
                  ? { duration: 0.2 }
                  : { type: "spring", stiffness: 420, damping: 34, mass: 0.8 },
              }}
              exit={{
                opacity: 0,
                y: prefersReducedMotion ? 0 : -3,
                scale: prefersReducedMotion ? 1 : 0.98,
                transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
              }}
            >
              <Info size={15} weight="fill" className="shrink-0" style={{ color: "oklch(0.72 0.15 80)" }} />
              {limitHint}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <p className="sr-only">
        Scale from $0 up to the pre-approved {formatSgd(scale)}. You can draw between{" "}
        {formatSgd(min)} and {formatSgd(max)} today.
      </p>

      <input
        type="range"
        className="credit-gauge-range sr-only"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onInteractRef.current?.();
          skipIntro();
          onChange(parseInt(e.target.value, 10));
        }}
        aria-label={ariaLabel}
        aria-valuetext={`${formatSgd(value)}, up to ${formatSgd(max)} today`}
      />
    </div>
  );
}
