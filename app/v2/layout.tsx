import type { Viewport } from "next";
import type { ReactNode } from "react";

import { V2Sidebar } from "@/app/v2/ui/sidebar";

import "./v2.css";

/**
 * Split-test funnel chrome. Every `/v2` screen is a fixed-height column (see
 * `v2.css`), so the viewport must cover the home indicator. From 1024px up a
 * left rail with branding and a worded stepper appears; the screen itself is
 * unchanged.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <div className="theme-v2 v2-root">
      <V2Sidebar />
      <main className="v2-main">{children}</main>
    </div>
  );
}
