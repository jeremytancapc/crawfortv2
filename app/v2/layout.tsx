import type { Viewport } from "next";
import type { ReactNode } from "react";

import "./v2.css";

/**
 * Split-test funnel chrome. Every `/v2` screen is a fixed-height phone column
 * (see `v2.css`), so the viewport must cover the home indicator.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function V2Layout({ children }: { children: ReactNode }) {
  return <div className="theme-v2 v2-root">{children}</div>;
}
