"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useInView, useReducedMotion } from "motion/react";

// ── Geometry ──────────────────────────────────────────────────────────────────
// Arc opens downward. t in [0, 1] runs left -> top -> right, so the sweep is
// centred on 90° (straight up) and each end dips a little below horizontal.

const VIEW_W = 320;
const VIEW_H = 182;
const CX = 160;
const CY = 150;
const OUTER_R = 140;
const INNER_R = 124;
const TICK_COUNT = 48;
const SWEEP_DEG = 200;
const START_DEG = 90 + SWEEP_DEG / 2;

const TICK_STROKE = 4.5;
/** Radius the drag handle rides on - the middle of the tick band. */
const KNOB_R = (INNER_R + OUTER_R) / 2;
const KNOB_SIZE = 13;
/** Mid blue for "available today but not chosen" - must stay clearly distinct
 *  from both the lit gradient and the locked grey. */
const AVAILABLE_STROKE = "oklch(0.70 0.13 245)";
const LOCKED_STROKE = "rgba(60, 60, 67, 0.22)";
const TICK_TRANSITION = "opacity 80ms linear";
/** Pause so the empty (all-grey) tank is visible before the fill starts. */
const INTRO_HOLD_MS = 280;
/** Continuous ease-out fill + count-up. */
const INTRO_FILL_MS = 1400;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function angleAt(t: number): number {
  return START_DEG - t * SWEEP_DEG;
}

function polar(radius: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

interface Tick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const TICKS: Tick[] = Array.from({ length: TICK_COUNT }, (_, i) => {
  const deg = angleAt((i + 0.5) / TICK_COUNT);
  const inner = polar(INNER_R, deg);
  const outer = polar(OUTER_R, deg);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x1: r(inner.x), y1: r(inner.y), x2: r(outer.x), y2: r(outer.y) };
});

/** Map a pointer position (in the SVG's client box) to a 0..1 share of the arc. */
function pointerToFraction(clientX: number, clientY: number, rect: DOMRect): number {
  const scale = rect.width / VIEW_W;
  const dx = clientX - (rect.left + CX * scale);
  const dy = rect.top + CY * scale - clientY;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  // Anything below the centre on the left half belongs to the left end, not
  // to a wrapped-around value past the right end.
  if (deg < -90) deg += 360;
  const t = (START_DEG - deg) / SWEEP_DEG;
  return Math.min(1, Math.max(0, t));
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CreditGaugeProps {
  /** Amount the customer has chosen to withdraw today. */
  value: number;
  /** Most they can withdraw today; ticks past this render locked. */
  maxToday: number;
  /** Total credit limit - the full sweep of the arc. */
  limit: number;
  min: number;
  step: number;
  /** Raw amount from a drag or keypress. The parent clamps and snaps. */
  onChange: (raw: number) => void;
  /** Screen-reader label for the hidden range control. */
  ariaLabel: string;
  disabled?: boolean;
  /** Rendered in the open centre of the arc. Receives the amount currently
   *  shown - which counts up with the intro fill, then tracks `value`. */
  children: (display: { value: number; isIntro: boolean }) => ReactNode;
}

export function CreditGauge({
  value,
  maxToday,
  limit,
  min,
  step,
  onChange,
  ariaLabel,
  disabled = false,
  children,
}: CreditGaugeProps) {
  const prefersReducedMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const isInView = useInView(svgRef, { once: true, amount: 0.2 });
  const gradientId = "credit-gauge-fill";

  // Intro: wait until the card is on screen, hold on an empty tank, then
  // ease one progress value from 0 → 1 so the ticks and the dollar figure
  // rise on the same curve.
  const [progress, setProgress] = useState(0);
  const [isIntro, setIsIntro] = useState(true);
  const [canPlay, setCanPlay] = useState(false);
  const skipIntro = () => {
    setIsIntro(false);
    setCanPlay(true);
    setProgress(1);
  };

  const safeLimit = limit > 0 ? limit : 1;
  const availableCount = clampInt(
    Math.round((maxToday / safeLimit) * TICK_COUNT),
    0,
    TICK_COUNT,
  );
  const liveLitCount =
    value <= 0
      ? 0
      : clampInt(Math.round((value / safeLimit) * TICK_COUNT), 1, availableCount || TICK_COUNT);

  // Prefers-reduced-motion is unknown during SSR, so never branch on it
  // during render - only after mount, or the input's disabled/readOnly
  // attributes hydrate as a mismatch.
  useEffect(() => {
    if (prefersReducedMotion) {
      skipIntro();
      return;
    }
    if (isInView) {
      setCanPlay(true);
      return;
    }
    const fallback = window.setTimeout(() => setCanPlay(true), 1200);
    return () => window.clearTimeout(fallback);
  }, [isInView, prefersReducedMotion]);

  useEffect(() => {
    if (!canPlay || !isIntro || prefersReducedMotion) return;

    let raf = 0;
    let start: number | null = null;

    const frame = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      if (elapsed < INTRO_HOLD_MS) {
        setProgress(0);
        raf = requestAnimationFrame(frame);
        return;
      }
      const t = Math.min(1, (elapsed - INTRO_HOLD_MS) / INTRO_FILL_MS);
      setProgress(easeOutCubic(t));
      if (t < 1) {
        raf = requestAnimationFrame(frame);
        return;
      }
      skipIntro();
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [canPlay, isIntro, prefersReducedMotion]);

  const fillCount = Math.round(progress * availableCount);
  const litCount = isIntro ? fillCount : liveLitCount;
  // During the fill, ticks ahead of the wave stay grey so the blue reads as
  // liquid moving into an empty tank. After the intro, unused-available ticks
  // take the mid-blue.
  const shownAvailable = isIntro ? fillCount : availableCount;
  const displayValue = isIntro ? Math.round(progress * maxToday) : value;

  // Handle rides the crest of the fill, then parks on the chosen amount. It is
  // the main signal that the dial can be dragged at all.
  const knob = polar(KNOB_R, angleAt(Math.min(1, displayValue / safeLimit)));

  const isDraggingRef = useRef(false);

  const applyPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onChange(pointerToFraction(e.clientX, e.clientY, rect) * limit);
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    skipIntro();
    isDraggingRef.current = true;
    // Capture can be refused if the pointer is already gone (or synthetic);
    // the drag still works for as long as the pointer stays over the arc.
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
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="credit-gauge relative mx-auto w-full max-w-[300px]" data-disabled={disabled}>
      <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="credit-gauge-arc block h-auto w-full select-none"
        aria-hidden="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        <defs>
          {/* userSpaceOnUse so every tick samples one gradient laid across the
              whole arc; a per-line bounding box would collapse on the near-
              vertical ticks. */}
          <linearGradient
            id="credit-gauge-fill"
            gradientUnits="userSpaceOnUse"
            x1={CX - OUTER_R}
            y1={CY}
            x2={CX + OUTER_R}
            y2={CY}
          >
            <stop offset="0" style={{ stopColor: "oklch(0.78 0.11 220)" }} />
            <stop offset="0.55" style={{ stopColor: "var(--brand-blue-hex)" }} />
            <stop offset="1" style={{ stopColor: "oklch(0.45 0.2 285)" }} />
          </linearGradient>
        </defs>

        {TICKS.map((tick, i) => {
          const isLit = i < litCount;
          const isAvailable = i < shownAvailable;
          return (
            <g key={i}>
              <line
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                strokeWidth={TICK_STROKE}
                strokeLinecap="round"
                stroke={isAvailable ? AVAILABLE_STROKE : LOCKED_STROKE}
                style={{
                  opacity: isLit ? 0 : isAvailable ? 0.85 : 1,
                  transition: TICK_TRANSITION,
                }}
              />
              <line
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                strokeWidth={TICK_STROKE}
                strokeLinecap="round"
                stroke={`url(#${gradientId})`}
                style={{ opacity: isLit ? 1 : 0, transition: TICK_TRANSITION }}
              />
            </g>
          );
        })}

        {/* Drag handle. pointer-events stay off so the whole arc keeps taking
            the drag, not just this circle. */}
        {!disabled && (
          <g
            className="credit-gauge-knob"
            style={{
              pointerEvents: "none",
              transform: `translate(${knob.x}px, ${knob.y}px)`,
              transition: isIntro ? "none" : "transform 120ms ease-out",
            }}
          >
            <circle r={KNOB_SIZE} fill="#ffffff" />
            <circle
              r={KNOB_SIZE}
              fill="none"
              stroke="var(--brand-blue-hex)"
              strokeWidth={2.5}
            />
            <circle r={3.5} fill="var(--brand-blue-hex)" />
          </g>
        )}
      </svg>

      {/* Centre readout. Everything here lets pointer events fall through to
          the arc except the controls themselves - a full-width wrapper that
          caught them would kill dragging across the middle of the dial. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[40%] flex flex-col items-center justify-start text-center [&_button]:pointer-events-auto [&_input]:pointer-events-auto">
        {children({ value: displayValue, isIntro })}
      </div>

      </div>

      <input
        type="range"
        className="credit-gauge-range sr-only"
        min={min}
        max={maxToday}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          skipIntro();
          onChange(parseInt(e.target.value, 10));
        }}
        aria-label={ariaLabel}
        aria-valuetext={`$${value.toLocaleString("en-SG")} of $${maxToday.toLocaleString("en-SG")} approved`}
      />
    </div>
  );
}
