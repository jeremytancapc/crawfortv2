"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useClickOutside } from "./use-click-outside";

interface ActionPopoverProps {
  open: boolean;
  onClose: () => void;
  align?: "left" | "right";
  width?: string;
  children: React.ReactNode;
}

/** Shared floating panel used by note / message / book / snooze quick actions. */
export function ActionPopover({ open, onClose, align = "left", width = "w-80", children }: ActionPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose, open);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className={[
            "absolute top-full z-50 mt-2 rounded-xl border border-[var(--border-subtle)] bg-white p-3 shadow-xl",
            align === "left" ? "left-0" : "right-0",
            width,
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
