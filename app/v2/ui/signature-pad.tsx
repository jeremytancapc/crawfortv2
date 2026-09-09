"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@/app/v2/ui/screen";

type Point = { x: number; y: number };

const STROKE_WIDTH = 2.4;

/**
 * Minimal signature capture for the v2 accept flow: a bare canvas over a
 * baseline hairline with a text "Clear" affordance. Fires `onChange` with a
 * PNG data URL after each stroke, or `null` once cleared, so the screen's
 * primary CTA can gate on it without an extra "confirm" step.
 */
export function V2SignaturePad({
  onChange,
  className,
}: {
  onChange: (dataUrl: string | null) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const strokesRef = useRef<Point[][]>([]);
  const currentRef = useRef<Point[]>([]);
  const drawingRef = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Point[]) => {
    if (stroke.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i += 1) {
      const prev = stroke[i - 1];
      const cur = stroke[i];
      ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2);
    }
    ctx.stroke();
  }, []);

  const renderAll = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke);
    drawStroke(ctx, currentRef.current);
  }, [drawStroke]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setup = () => {
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
      ctx.strokeStyle = getComputedStyle(canvas).color;
      ctxRef.current = ctx;
      renderAll();
    };
    setup();
    const observer = new ResizeObserver(setup);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [renderAll]);

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handleDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some synthetic or already-released pointers cannot be captured; drawing still works.
    }
    currentRef.current = [pointFrom(event)];
    drawingRef.current = true;
  };

  const handleMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    currentRef.current.push(pointFrom(event));
    renderAll();
  };

  const handleUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentRef.current.length > 0) {
      strokesRef.current.push(currentRef.current);
      currentRef.current = [];
      setIsEmpty(false);
      renderAll();
      onChange(canvasRef.current?.toDataURL("image/png") ?? null);
    }
  };

  const clear = () => {
    strokesRef.current = [];
    currentRef.current = [];
    setIsEmpty(true);
    renderAll();
    onChange(null);
  };

  return (
    <div className={cx("v2-sign", className)}>
      <canvas
        ref={canvasRef}
        className="v2-sign-canvas"
        aria-label="Signature"
        role="img"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onPointerLeave={handleUp}
      />
      <div className="v2-sign-baseline" aria-hidden="true" />
      <div className="v2-sign-foot">
        <span className={cx("v2-note transition-opacity", !isEmpty && "opacity-0")}>
          Sign with your finger
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={isEmpty}
          className="v2-note underline underline-offset-2 disabled:opacity-0"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
