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
// True 180° semicircle. t in [0, 1] runs left → top → right, and both ends
// sit on the same horizontal through the centre so the dial reads as a flat
// baseline, not a horseshoe that dips past it.

const VIEW_W = 360;
const VIEW_H = 200;
const VIEW_PAD_X = 38;
const VIEW_PAD_TOP = 14;
const CX = 180;
const CY = 178;
const OUTER_R = 160;
const INNER_R = 142;
const TICK_COUNT = 49;
const SWEEP_DEG = 180;
const START_DEG = 180;

const TICK_STROKE = 4.5;
/** Radius the drag handle rides on - the middle of the tick band. */
const KNOB_R = (INNER_R + OUTER_R) / 2;
const KNOB_SIZE = 13;
/** Mid blue for "available today but not chosen" - must stay clearly distinct
 *  from both the lit gradient and the locked grey. */
const AVAILABLE_STROKE = "oklch(0.70 0.13 245)";
const LOCKED_STROKE = "rgba(60, 60, 67, 0.22)";
const TICK_TRANSITION = "opacity 120ms linear";
/** Pause so the empty (all-grey) tank is visible before the fill starts. */
const INTRO_HOLD_MS = 240;
/** Rise to the visual middle of the arc. */
const INTRO_UP_MS = 1600;
/** Brief rest at the crest so the turnaround reads as a choice, not a bounce. */
const INTRO_CREST_MS = 220;
/** Ease back down to halfway along the approved side. */
const INTRO_DOWN_MS = 1500;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
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
  const deg = angleAt(i / (TICK_COUNT - 1));
  const inner = polar(INNER_R, deg);
  const outer = polar(OUTER_R, deg);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x1: r(inner.x), y1: r(inner.y), x2: r(outer.x), y2: r(outer.y) };
});

/** Map a pointer position (in the SVG's client box) to a 0..1 share of the arc. */
function pointerToFraction(clientX: number, clientY: number, rect: DOMRect): number {
  const boxW = VIEW_W + VIEW_PAD_X * 2;
  const scale = rect.width / boxW;
  const dx = clientX - (rect.left + (VIEW_PAD_X + CX) * scale);
  const dy = rect.top + (VIEW_PAD_TOP + CY) * scale - clientY;
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

/** First labeled stick - a round thousand so the left end reads as a floor,
 *  not as zero. */
const FLOOR_MARK = 1000;
/** Landmark ticks stay inside the same ring as the minors - a hair longer,
 *  never an antenna past the rim. */
const MAJOR_INNER_R = INNER_R - 3;
const MAJOR_OUTER_R = OUTER_R + 3;
/** Two marks closer than this share one stick; keep the later / more important. */
const MARK_MERGE_T = 0.07;

function formatMarkAmount(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-SG")}`;
}

interface ScaleMark {
  t: number;
  amount: number;
  label: string;
  /** Past the approved end - drawn in the locked grey so the reserve reads. */
  isLocked: boolean;
  /** The approved cap itself: the stick the intro parks under at the crest. */
  isApproved: boolean;
}

function buildScaleMarks(maxToday: number, limit: number): ScaleMark[] {
  const safeLimit = limit > 0 ? limit : 1;
  const candidates = [
    { amount: FLOOR_MARK, isApproved: false },
    { amount: maxToday / 2, isApproved: false },
    { amount: maxToday, isApproved: true },
    { amount: safeLimit * 0.75, isApproved: false },
    { amount: safeLimit, isApproved: false },
  ];

  const marks: ScaleMark[] = [];
  for (const candidate of candidates) {
    if (candidate.amount <= 0 || candidate.amount > safeLimit + 0.5) continue;
    const t = Math.min(1, Math.max(0, candidate.amount / safeLimit));
    const last = marks[marks.length - 1];
    if (last && t - last.t < MARK_MERGE_T) {
      if (candidate.isApproved || candidate.amount === safeLimit) {
        marks[marks.length - 1] = {
          t,
          amount: candidate.amount,
          label: formatMarkAmount(candidate.amount),
          isLocked: candidate.amount > maxToday + 0.5,
          isApproved: candidate.isApproved,
        };
      }
      continue;
    }
    marks.push({
      t,
      amount: candidate.amount,
      label: formatMarkAmount(candidate.amount),
      isLocked: candidate.amount > maxToday + 0.5,
      isApproved: candidate.isApproved,
    });
  }
  return marks;
}

function markLabelStyle(t: number): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  const deg = angleAt(t);
  if (t < 0.08) {
    const end = polar(OUTER_R, 180);
    return { x: end.x - 7, y: end.y, anchor: "end" };
  }
  if (t > 0.92) {
    const end = polar(OUTER_R, 0);
    return { x: end.x + 7, y: end.y, anchor: "start" };
  }
  const point = polar(OUTER_R + 13, deg);
  if (t < 0.38) return { x: point.x - 1, y: point.y, anchor: "end" };
  if (t > 0.62) return { x: point.x + 1, y: point.y, anchor: "start" };
  return { x: point.x, y: point.y - 1, anchor: "middle" };
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
  const onChangeRef = useRef(onChange);
  const gradientId = "credit-gauge-fill";

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Intro: wait until the card is on screen, hold on an empty tank, then
  // ride the needle up to the visual middle of the arc and back down to
  // halfway along the approved side - so the first thing the customer sees
  // is that the dial moves, and that it does not have to sit at the max.
  const [displayAmount, setDisplayAmount] = useState(0);
  const [isIntro, setIsIntro] = useState(true);
  const [canPlay, setCanPlay] = useState(false);
  const [showFullAvailable, setShowFullAvailable] = useState(false);
  const skipIntro = () => {
    setIsIntro(false);
    setCanPlay(true);
    setShowFullAvailable(true);
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

    const peakAmount = Math.min(maxToday, safeLimit / 2);
    const restAmount = clampInt(Math.round(maxToday / 2 / step) * step, min, maxToday);
    const hasOvershoot = peakAmount - restAmount > step;

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

      const afterHold = elapsed - INTRO_HOLD_MS;
      if (afterHold < INTRO_UP_MS) {
        const t = easeInOutCubic(afterHold / INTRO_UP_MS);
        setDisplayAmount(lerp(0, hasOvershoot ? peakAmount : restAmount, t));
        raf = requestAnimationFrame(frame);
        return;
      }

      if (!hasOvershoot) {
        setDisplayAmount(restAmount);
        onChangeRef.current(restAmount);
        skipIntro();
        return;
      }

      const afterUp = afterHold - INTRO_UP_MS;
      if (afterUp < INTRO_CREST_MS) {
        setDisplayAmount(peakAmount);
        setShowFullAvailable(true);
        raf = requestAnimationFrame(frame);
        return;
      }

      const afterCrest = afterUp - INTRO_CREST_MS;
      if (afterCrest < INTRO_DOWN_MS) {
        setShowFullAvailable(true);
        const t = easeInOutCubic(afterCrest / INTRO_DOWN_MS);
        setDisplayAmount(lerp(peakAmount, restAmount, t));
        raf = requestAnimationFrame(frame);
        return;
      }

      setDisplayAmount(restAmount);
      onChangeRef.current(restAmount);
      skipIntro();
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [canPlay, isIntro, prefersReducedMotion, disabled, maxToday, min, step, safeLimit]);

  const fillCount =
    displayAmount <= 0
      ? 0
      : clampInt(Math.round((displayAmount / safeLimit) * TICK_COUNT), 1, availableCount || TICK_COUNT);
  const litCount = isIntro ? fillCount : liveLitCount;
  // During the rise, ticks ahead of the wave stay grey so the blue reads as
  // liquid moving into an empty tank. From the crest down, the rest of the
  // approved side lights mid-blue - that leftover band is what teaches that
  // the needle can still move.
  const shownAvailable = isIntro && !showFullAvailable ? fillCount : availableCount;
  const displayValue = isIntro ? Math.round(displayAmount) : value;
  const knobAmount = isIntro ? displayAmount : value;

  // Handle rides the crest of the fill, then parks on the chosen amount. It is
  // the main signal that the dial can be dragged at all.
  const knob = polar(KNOB_R, angleAt(Math.min(1, knobAmount / safeLimit)));
  const scaleMarks = buildScaleMarks(maxToday, safeLimit);

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
    <div className="credit-gauge relative mx-auto w-[calc(100%+2rem)] max-w-[440px] -mx-4" data-disabled={disabled}>
      <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`${-VIEW_PAD_X} ${-VIEW_PAD_TOP} ${VIEW_W + VIEW_PAD_X * 2} ${VIEW_H + VIEW_PAD_TOP}`}
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

        {/* Landmark ticks share the minor ring - just a longer, darker hash -
            so the scale reads without sticks hanging off the rim. */}
        {scaleMarks.map((mark) => {
          const deg = angleAt(mark.t);
          const inner = polar(MAJOR_INNER_R, deg);
          const outer = polar(MAJOR_OUTER_R, deg);
          const label = markLabelStyle(mark.t);
          const stroke = mark.isLocked
            ? "rgba(60, 60, 67, 0.45)"
            : mark.isApproved
              ? "var(--brand-blue-hex)"
              : "oklch(0.48 0.13 245)";
          return (
            <g key={mark.label} pointerEvents="none">
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={stroke}
                strokeWidth={mark.isApproved ? 2.75 : 2}
                strokeLinecap="round"
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor={label.anchor}
                dominantBaseline="middle"
                fill={mark.isLocked ? "var(--text-tertiary)" : "var(--text-primary)"}
                style={{
                  fontSize: 10,
                  fontWeight: mark.isApproved ? 700 : 600,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {mark.label}
              </text>
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[46%] flex flex-col items-center justify-start text-center [&_button]:pointer-events-auto [&_input]:pointer-events-auto">
        {children({ value: displayValue, isIntro })}
      </div>

      </div>

      <p className="sr-only">
        Scale from {formatMarkAmount(FLOOR_MARK)} up to {formatMarkAmount(safeLimit)},
        with {formatMarkAmount(maxToday)} approved today.
      </p>

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
