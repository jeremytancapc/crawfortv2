"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

/**
 * Circular icon badge with a landing animation: the icon drops in with a
 * spring bounce, a brief expanding ring pulses outward, and a soft
 * conic-gradient halo drifts slowly around it on loop. Used for the
 * milestone moments in the apply funnel (approval, booking) so each feels
 * like a small celebratory beat rather than a static icon.
 */
export function AnimatedIconBadge({
  background,
  ringColor,
  children,
}: {
  background: string;
  ringColor: string;
  children: ReactNode;
}) {
  return (
    <span className="relative flex h-14 w-14 items-center justify-center" aria-hidden="true">
      {/* Perpetual soft halo - a blurred ring of light drifting slowly around
          the badge, like a faint cloud orbiting it. Fades in once the badge
          has landed and loops for as long as it's on screen. */}
      <motion.span
        className="absolute -inset-2.5 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${ringColor} 110deg, transparent 200deg, ${ringColor} 300deg, transparent 360deg)`,
          WebkitMaskImage:
            "radial-gradient(closest-side, transparent calc(100% - 10px), black calc(100% - 10px) calc(100% - 4px), transparent calc(100% - 4px))",
          maskImage:
            "radial-gradient(closest-side, transparent calc(100% - 10px), black calc(100% - 10px) calc(100% - 4px), transparent calc(100% - 4px))",
          filter: "blur(2.5px)",
        }}
        initial={{ opacity: 0, rotate: 0 }}
        animate={{ opacity: 1, rotate: 360 }}
        transition={{
          opacity: { duration: 0.6, delay: 0.5 },
          rotate: { duration: 7, delay: 0.5, repeat: Infinity, ease: "linear" },
        }}
      />
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ border: `2px solid ${ringColor}` }}
        initial={{ scale: 0.55, opacity: 0 }}
        animate={{ scale: 1.55, opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.55, delay: 0.32, ease: "easeOut" }}
      />
      <motion.span
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background }}
        initial={{ scale: 1.7, rotate: -18, opacity: 0, y: -12 }}
        animate={{ scale: 1, rotate: 0, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 13, mass: 0.9, delay: 0.08 }}
      >
        <motion.span
          className="flex items-center justify-center"
          initial={{ scale: 1 }}
          animate={{ scale: [1, 0.8, 1.06, 1] }}
          transition={{ duration: 0.32, delay: 0.34, ease: "easeOut" }}
        >
          {children}
        </motion.span>
      </motion.span>
    </span>
  );
}
