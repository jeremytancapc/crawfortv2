"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react";

import { useApplyPath } from "@/app/use-apply-path";
import { v2ProgressFills, type V2Progress } from "@/app/v2/ui/progress";
import { setV2Progress } from "@/app/v2/ui/progress-store";

/**
 * Fixed-height screen: header | body | footer. Nothing inside may scroll
 * vertically, so in development we shout when a body overflows its track.
 */
export function V2Screen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const root = ref.current;
    if (!root) return;

    const check = () => {
      const body = root.querySelector<HTMLElement>("[data-v2-body]");
      const overflowing: string[] = [];
      if (root.scrollHeight > root.clientHeight + 1) {
        overflowing.push(`screen ${root.scrollHeight}px > ${root.clientHeight}px`);
      }
      if (body && body.scrollHeight > body.clientHeight + 1) {
        overflowing.push(`body ${body.scrollHeight}px > ${body.clientHeight}px`);
      }
      if (overflowing.length) {
        console.warn(
          `[v2] screen does not fit ${window.innerWidth}x${window.innerHeight}:`,
          overflowing.join("; "),
        );
      }
    };

    const frame = requestAnimationFrame(check);
    const observer = new ResizeObserver(check);
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={cx("v2-screen", className)}>
      <V2Navbar />
      {children}
    </div>
  );
}

/**
 * Persistent brand strip, full-bleed above every phone screen (the desktop
 * rail carries the same branding there, so this hides at that breakpoint).
 * Unlike `V2Header` below it, this never changes between steps - it is the
 * one piece of chrome that says "Crawfort" no matter where the customer is
 * in the funnel.
 */
function V2Navbar() {
  const applyHref = useApplyPath();
  return (
    <div className="v2-navbar">
      <Link href={applyHref("/")} aria-label="Crawfort home">
        <Image
          src="/images/crawfort-white-color-dot.png"
          alt="Crawfort"
          width={1261}
          height={155}
          className="h-4 w-auto"
          priority
        />
      </Link>
    </div>
  );
}

/** 56px header row: back control, progress bar, optional right slot. */
export function V2Header({
  onBack,
  backHref,
  progress,
  right,
}: {
  onBack?: () => void;
  backHref?: string;
  progress?: V2Progress;
  right?: ReactNode;
}) {
  const stage = progress?.stage;
  const fraction = progress?.fraction;

  // Mirror this screen's stage to the desktop sidebar stepper.
  useEffect(() => {
    setV2Progress(stage ? { stage, fraction } : null);
  }, [stage, fraction]);

  return (
    <header className="v2-header">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="v2-icon-button"
          aria-label="Back"
        >
          <CaretLeft size={22} weight="bold" />
        </button>
      ) : backHref ? (
        <Link href={backHref} className="v2-icon-button" aria-label="Back">
          <CaretLeft size={22} weight="bold" />
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}

      {progress ? <V2ProgressBar progress={progress} /> : <span aria-hidden="true" />}

      <div className="flex items-center justify-end">{right}</div>
    </header>
  );
}

export function V2ProgressBar({ progress }: { progress: V2Progress }) {
  const fills = v2ProgressFills(progress);
  const done = Math.round(
    (fills.reduce((sum, fill) => sum + fill, 0) / fills.length) * 100,
  );
  return (
    <div
      className="v2-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={done}
      aria-label="Application progress"
    >
      {fills.map((fill, index) => (
        <span key={index} style={{ ["--fill" as string]: fill }} />
      ))}
    </div>
  );
}

/** Title (max two lines) with a single supporting line. */
export function V2Title({
  title,
  subtitle,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("v2-enter flex-none pt-2", className)}>
      <h1 className="v2-title">{title}</h1>
      {subtitle ? <p className="v2-sub">{subtitle}</p> : null}
    </div>
  );
}

/**
 * The middle grid track. Children are laid out top-to-bottom with `gap`; use
 * `justify` to push content toward the centre or bottom when the screen has
 * spare room.
 */
export function V2Body({
  children,
  className,
  justify = "start",
}: {
  children: ReactNode;
  className?: string;
  justify?: "start" | "center" | "between" | "end";
}) {
  const justifyClass =
    justify === "center"
      ? "justify-center"
      : justify === "between"
        ? "justify-between"
        : justify === "end"
          ? "justify-end"
          : "justify-start";
  return (
    <div
      data-v2-body
      className={cx(
        "v2-body flex min-h-0 min-w-0 flex-col overflow-hidden",
        justifyClass,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Bottom track: the CTA (or CTAs) plus an optional one-line note beneath. */
export function V2Footer({
  children,
  note,
  className,
}: {
  children?: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <footer className={cx("flex flex-none flex-col gap-3 pt-4", className)}>
      {children}
      {note ? <p className="v2-note text-center">{note}</p> : null}
    </footer>
  );
}

/** Wraps an illustration so it sizes with the viewport and hides when short. */
export function V2Illustration({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("v2-illustration v2-enter", className)} aria-hidden="true">
      {children}
    </div>
  );
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
