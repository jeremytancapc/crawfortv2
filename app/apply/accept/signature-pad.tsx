"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowCounterClockwise, PenNib, SealCheck } from "@phosphor-icons/react";

// ── Canvas drawing helpers ───────────────────────────────────────────────────

type Point = { x: number; y: number };
type Phase = "input" | "signing" | "signed";

/** Deep ink navy — reads as pen ink on paper rather than a UI accent color. */
const INK_COLOR = "#1c2b45";
const STROKE_WIDTH = 2.25;
const SIGNING_CEREMONY_MS = 950;

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Renders one freehand stroke as a single smoothed path through quadratic curves. */
function drawStroke(ctx: CanvasRenderingContext2D, points: Point[]) {
  if (points.length === 0) return;

  if (points.length === 1) {
    const [p] = points;
    ctx.beginPath();
    ctx.arc(p.x, p.y, STROKE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fillStyle = INK_COLOR;
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const mid = midpoint(points[i], points[i + 1]);
    ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function formatSignedAt(date: Date): string {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// ── Signature pad ────────────────────────────────────────────────────────────

interface SignaturePadProps {
  /** Dims and locks input, e.g. until the checkboxes above are all ticked. */
  disabled?: boolean;
  /**
   * Fires once the signing ceremony completes with a PNG data URL of the
   * signature. Ceremonial only for now — nothing is persisted. Future step:
   * POST this to an API route (mirroring app/api/apply/select-plan/route.ts)
   * to store it against the lead record.
   */
  onSigned: (dataUrl: string) => void;
  onCleared?: () => void;
}

export function SignaturePad({ disabled = false, onSigned, onCleared }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const strokesRef = useRef<Point[][]>([]);
  const currentStrokeRef = useRef<Point[]>([]);
  const isDrawingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const signingTimeoutRef = useRef<number | null>(null);

  const [isEmpty, setIsEmpty] = useState(true);
  const [phase, setPhase] = useState<Phase>("input");
  const [signedAt, setSignedAt] = useState<Date | null>(null);

  const prefersReducedMotion = useReducedMotion();

  const renderAll = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke);
    if (currentStrokeRef.current.length > 0) drawStroke(ctx, currentStrokeRef.current);
  }, []);

  const scheduleRender = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      renderAll();
    });
  }, [renderAll]);

  // Set up (and rescale on resize) the backing bitmap at device pixel density
  // so strokes stay crisp, then replay stored strokes since resizing a
  // canvas element clears its bitmap and resets context state.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setupCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = STROKE_WIDTH;
      ctx.strokeStyle = INK_COLOR;
      ctxRef.current = ctx;
      renderAll();
    };

    setupCanvas();
    const ro = new ResizeObserver(setupCanvas);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [renderAll]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (signingTimeoutRef.current != null) window.clearTimeout(signingTimeoutRef.current);
    };
  }, []);

  const getPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled || phase !== "input") return;
      e.currentTarget.setPointerCapture(e.pointerId);
      currentStrokeRef.current = [getPos(e)];
      isDrawingRef.current = true;
    },
    [disabled, phase, getPos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      currentStrokeRef.current.push(getPos(e));
      scheduleRender();
    },
    [getPos, scheduleRender],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = [];
      setIsEmpty(false);
    }
    renderAll();
  }, [renderAll]);

  const clearCanvas = useCallback(() => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setIsEmpty(true);
    renderAll();
  }, [renderAll]);

  function handleClear() {
    clearCanvas();
    onCleared?.();
  }

  function handleReSign() {
    if (signingTimeoutRef.current != null) window.clearTimeout(signingTimeoutRef.current);
    clearCanvas();
    setPhase("input");
    setSignedAt(null);
    onCleared?.();
  }

  function handleConfirm() {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty || phase !== "input") return;
    const dataUrl = canvas.toDataURL("image/png");
    const now = new Date();
    setSignedAt(now);

    if (prefersReducedMotion) {
      setPhase("signed");
      onSigned(dataUrl);
      return;
    }

    setPhase("signing");
    signingTimeoutRef.current = window.setTimeout(() => {
      setPhase("signed");
      onSigned(dataUrl);
    }, SIGNING_CEREMONY_MS);
  }

  const isSigned = phase === "signed";
  const isSigning = phase === "signing";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-1.5 text-center pt-1">
        <div className="flex items-center gap-2">
          <PenNib size={16} weight="bold" style={{ color: "var(--brand-blue-hex, #0033AA)" }} />
          <span
            className="text-[13px] font-bold tracking-[0.14em] uppercase"
            style={{ color: "var(--text-primary)" }}
          >
            Sign to accept
          </span>
        </div>
        <span className="text-[12.5px] leading-snug font-medium" style={{ color: "var(--text-secondary)" }}>
          Draw your signature below to confirm this offer
        </span>
      </div>

      <motion.div
        className="relative w-full overflow-hidden rounded-[var(--radius-lg)]"
        style={{
          background: "var(--surface-elevated)",
          opacity: disabled ? 0.45 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
        animate={
          isSigning && !prefersReducedMotion
            ? {
                boxShadow: [
                  "0 0 0 1px var(--border-subtle)",
                  "0 0 0 2px #16a34a, 0 0 24px oklch(0.7 0.17 145 / 0.35)",
                  "0 0 0 1.5px #16a34a",
                ],
              }
            : { boxShadow: isSigned ? "0 0 0 1.5px #16a34a" : "0 0 0 1px var(--border-subtle)" }
        }
        transition={{ duration: SIGNING_CEREMONY_MS / 1000, ease: "easeOut" }}
      >
        <div className="relative px-4 pt-4 pb-3.5">
          {/* Signature baseline + placeholder hint, visible while empty */}
          {isEmpty && phase === "input" && (
            <div
              className="pointer-events-none absolute inset-x-4 bottom-[38px] flex flex-col items-center gap-1.5"
              aria-hidden="true"
            >
              <span className="text-[11px] font-medium tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                {disabled ? "Tick the boxes above first" : "Sign here with your finger or mouse"}
              </span>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="block w-full touch-none"
            style={{ height: 148, cursor: disabled || isSigned ? "default" : "crosshair" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
            role="img"
            aria-label={isSigned ? "Signature captured" : "Signature drawing area"}
          />

          {/* Baseline rule */}
          <div
            className="absolute inset-x-4 bottom-[34px] h-px"
            style={{
              background:
                "repeating-linear-gradient(to right, var(--border-medium) 0, var(--border-medium) 6px, transparent 6px, transparent 12px)",
            }}
            aria-hidden="true"
          />

          {/* Shimmer sweep during the signing ceremony */}
          <AnimatePresence>
            {isSigning && !prefersReducedMotion && (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-1/3"
                style={{
                  background:
                    "linear-gradient(105deg, transparent 0%, oklch(1 0 0 / 0.55) 45%, oklch(1 0 0 / 0.85) 50%, oklch(1 0 0 / 0.55) 55%, transparent 100%)",
                }}
                initial={{ left: "-40%" }}
                animate={{ left: "110%" }}
                exit={{ opacity: 0 }}
                transition={{ duration: SIGNING_CEREMONY_MS / 1000, ease: "easeInOut" }}
              />
            )}
          </AnimatePresence>

          {/* "Signed" stamp — appears once signed, with a metallic gold shine */}
          <AnimatePresence>
            {(isSigning || isSigned) && (
              <motion.div
                className="absolute right-3 top-3 flex items-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.97 0.10 95) 0%, oklch(0.87 0.17 92) 50%, oklch(0.97 0.10 95) 100%)",
                  boxShadow:
                    "0 0 0 1.5px oklch(0.72 0.16 85), 0 2px 10px oklch(0.75 0.17 88 / 0.55)",
                  transform: "rotate(-6deg)",
                }}
                initial={
                  prefersReducedMotion
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 1.9, rotate: 8 }
                }
                animate={{ opacity: 1, scale: 1, rotate: -6 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 320, damping: 16, delay: SIGNING_CEREMONY_MS / 1000 * 0.35 }
                }
              >
                {!prefersReducedMotion && (
                  <motion.div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 w-1/4"
                    style={{
                      background:
                        "linear-gradient(105deg, transparent 0%, oklch(1 0 0 / 0.85) 50%, transparent 100%)",
                    }}
                    initial={{ left: "-60%" }}
                    animate={{ left: "140%" }}
                    transition={{
                      duration: 1.1,
                      ease: "easeInOut",
                      delay: SIGNING_CEREMONY_MS / 1000 + 0.15,
                      repeat: Infinity,
                      repeatDelay: 2.4,
                    }}
                  />
                )}
                <SealCheck size={13} weight="fill" style={{ color: "#713f12" }} className="relative" />
                <span
                  className="relative text-[10px] font-extrabold tracking-[0.1em] uppercase"
                  style={{ color: "#713f12" }}
                >
                  Signed
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer: controls or signed confirmation */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5"
          style={{ background: "var(--surface-secondary)" }}
        >
          {isSigned ? (
            <>
              <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                Signed{signedAt ? ` · ${formatSignedAt(signedAt)}` : ""}
              </span>
              <button
                type="button"
                onClick={handleReSign}
                className="flex items-center gap-1 text-[11px] font-semibold transition-opacity hover:opacity-70"
                style={{ color: "var(--text-tertiary)" }}
              >
                <ArrowCounterClockwise size={12} weight="bold" />
                Re-sign
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClear}
                disabled={isEmpty || isSigning}
                className="text-[11px] font-semibold transition-opacity hover:opacity-70 disabled:opacity-30"
                style={{ color: "var(--text-tertiary)" }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isEmpty || isSigning}
                className="rounded-[var(--radius-sm)] px-3.5 py-1.5 text-[11px] font-bold tracking-wide transition-all duration-150 disabled:opacity-30"
                style={{
                  background: "var(--brand-blue-hex)",
                  color: "#ffffff",
                }}
              >
                {isSigning ? "Signing…" : "Confirm signature"}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
